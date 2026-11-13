// «Обмен» tool (installed app only): a panel over the game that values both sides of the trade window —
// cards by their signs × your sign price, other items by your own prices, plus the gold — and shows the difference.
// Based on TradeCounterRQ by w-stus (github.com/w-stus/tradecounterRQ), used under its non-commercial license
// (trade/LICENSE-TradeCounterRQ.txt): the trade window reading and the valuation are ported from it (trade/engine).
// How it works: a hidden page captures the game window (like screen sharing, the game is never touched),
// the frames go to a background process (trade/engine/worker.js) that finds and reads the trade window,
// its result goes to the panel (trade/overlay). Prices live in <RQ Tools data>\trade.
'use strict';
const { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer, utilityProcess, MessageChannelMain } = require('electron');
const path = require('path');
const fs = require('fs');

const PANEL_W = 380, PANEL_H = 560;
// packaged: the OCR / OpenCV files and the worker's dependencies sit unpacked next to app.asar (package.json asarUnpack)
const unpacked = p => p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
const ASSETS = unpacked(path.join(__dirname, 'assets'));

const dataDir = () => path.join(app.getPath('userData'), 'trade');
const file = n => path.join(dataDir(), n);
const readJson = (n, def) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return def; } };
const writeJson = (n, v) => { try { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(file(n), JSON.stringify(v, null, 1)); } catch (err) { console.error('[trade] save', n, err); } };

// settings: sign prices (buy = what you pay for a sign when you receive cards, sell = when you give them), hotkey, panel place
let settings = null;
// Alt+Shift+T, next to the stats overlay's Alt+Shift+S (F12 is often taken: Steam screenshots)
const loadSettings = () => { settings = { buySign: null, sellSign: null, hotkey: 'Alt+Shift+T', panel: null, ...readJson('settings.json', {}) }; };
// the price list: { items: { name: { category, buy, sell, signs } }, aliases: { NORMALIZED READ TEXT: name } }
let prices = null;
const loadPrices = () => { prices = readJson('prices.json', null) || { items: {}, aliases: {} }; prices.items ||= {}; prices.aliases ||= {}; };

// ---------- every item name the game has: cards with their signs, the rest without a price ----------
let known = null; // Map name → { name, category, signs }
function knownItems() {
  if (known) return known;
  known = new Map();
  const add = (name, category, signs = null) => { if (name && !known.has(name)) known.set(name, { name, category, signs }); };
  const req = p => { try { return require(path.join(__dirname, '..', 'data', p)); } catch { return null; } };
  const signs = req('card-signs.js') || {};
  for (const [name, n] of Object.entries(signs)) add(name, 'card', n);
  for (const it of req('market-items.js') || []) add(it.name, it.cat === 'card' ? 'card' : 'regular');
  for (const g of req('base-goods.js') || []) add(g.name, g.cat === 'Экипировка' ? 'unique' : 'regular');
  const rq = req('rqdata.js');
  for (const e of (rq && rq.Equipment) || []) add(e.Name, 'unique');
  return known;
}
// the catalog the worker values with: known items + the player's prices (a price for a name the game data lacks adds it)
function catalog() {
  const items = new Map();
  for (const k of knownItems().values()) items.set(k.name, { id: k.name, name: k.name, category: k.category, signs: k.signs, buy: null, sell: null });
  for (const [name, p] of Object.entries(prices.items)) {
    const base = items.get(name) || { id: name, name, category: 'regular', signs: null };
    items.set(name, { ...base, ...p, id: name, name, signs: p.signs ?? base.signs });
  }
  return { items: [...items.values()], aliases: prices.aliases };
}
const pricing = () => ({ buySign: settings.buySign, sellSign: settings.sellSign });
// what the reader says goes to <data>\trade\trade.log (kept short): the place to look when a player reports a problem
function log(line) {
  console.log('[trade]', line);
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    const f = file('trade.log');
    if (fs.existsSync(f) && fs.statSync(f).size > 256 * 1024) fs.renameSync(f, file('trade.old.log'));
    fs.appendFileSync(f, `${new Date().toISOString()} ${line}\n`);
  } catch { /* logging never breaks the tool */ }
}

// ---------- state ----------
let worker = null, captureWin = null, panel = null, onChange = () => {}, lang = 'ru';
let st = { on: false, ready: false, game: null, reading: false, issue: null, error: null, hotkeyOk: true, lastOutcome: null };
let last = null; // the newest worker state (observation + value)
let findTimer = null, captureSource = null, workerPort = null;
const emit = () => { onChange(state()); };
function state() {
  return { ...st, buySign: settings?.buySign ?? null, sellSign: settings?.sellSign ?? null, hotkey: settings?.hotkey, prices: prices ? prices.items : {}, aliasCount: prices ? Object.keys(prices.aliases).length : 0, trade: last && last.observation ? { state: last.state } : null };
}

function startWorker() {
  worker = utilityProcess.fork(path.join(__dirname, 'engine', 'worker.js'), [], { serviceName: 'RQ Tools trade reader', stdio: 'pipe' });
  worker.stdout?.on('data', d => log(String(d).trim()));
  worker.stderr?.on('data', d => log('ERR ' + String(d).trim()));
  worker.on('message', m => {
    if (m.type === 'ready') { log('reader ready'); st.ready = true; st.error = null; emit(); connectCapture(); }
    else if (m.type === 'error') { log('ERR ' + m.message); st.error = m.message.split('\n')[0]; emit(); }
    else if (m.type === 'state') onWorkerState(m);
    else if (m.type === 'completed') saveTrade(m.trade);
  });
  worker.on('exit', code => { log('reader exited ' + code); worker = null; workerPort = null; if (st.on) { st.error = `reader stopped (${code})`; st.ready = false; emit(); } });
  worker.postMessage({ type: 'init', assets: ASSETS, catalog: catalog(), pricing: pricing(), workerPath: unpacked(require.resolve('tesseract.js/src/worker-script/node/index.js')) });
}

let hideAfterOutcome = false, hideTimer = null;
function onWorkerState(m) {
  last = m;
  const was = st.reading, wasIssue = st.issue, wasOutcome = st.lastOutcome;
  st.reading = !!m.observation; st.issue = m.issue;
  if (m.accounting && m.accounting.lastOutcome) st.lastOutcome = m.accounting.lastOutcome;
  if (m.justOpened) { clearTimeout(hideTimer); hideAfterOutcome = false; if (panel && !panel.isVisible()) panel.showInactive(); }
  // closed: the panel stays until the history has its answer (the gold can take a few seconds), shows it, then hides
  if (m.justClosed && panel && panel.isVisible() && !panelPinned) hideAfterOutcome = true;
  if (hideAfterOutcome && !(m.accounting && m.accounting.open)) {
    hideAfterOutcome = false; clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (panel && !panelPinned && !(last && last.observation)) panel.hide(); }, 5000);
  }
  sendPanel();
  if (was !== st.reading || wasIssue !== st.issue || wasOutcome !== st.lastOutcome) emit();
}

// ---------- the history: <data>\trade\history.jsonl, one completed trade per line ----------
function loadHistory() {
  try {
    const seen = new Set(), out = [];
    for (const line of fs.readFileSync(file('history.jsonl'), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const t = JSON.parse(line); if (t && t.id && !seen.has(t.id)) { seen.add(t.id); out.push(t); } } catch { /* a broken line is skipped */ }
    }
    return out;
  } catch { return []; }
}
function saveTrade(t) {
  if (!t || !t.id || !(t.amount > 0) || !(t.initialGold >= 0) || !(t.finalGold >= 0)) return;
  if (loadHistory().some(x => x.id === t.id)) return;
  try { fs.mkdirSync(dataDir(), { recursive: true }); fs.appendFileSync(file('history.jsonl'), JSON.stringify(t) + '\n'); }
  catch (err) { log('history save failed ' + err); return; }
  log(`trade counted: ${t.direction} ${t.amount} (${t.initialGold} → ${t.finalGold}, ${t.reconciliation})`);
  onChange({ ...state(), historyChanged: Date.now() });
}
function historyReport(filter) {
  const { report } = require('./engine/accounting');
  return report(loadHistory(), filter || {});
}
function deleteTrade(id) {
  const rest = loadHistory().filter(t => t.id !== id);
  try { fs.writeFileSync(file('history.jsonl'), rest.map(t => JSON.stringify(t)).join('\n') + (rest.length ? '\n' : '')); } catch (err) { log('history delete failed ' + err); }
}

// ---------- the game window ----------
async function findGame() {
  if (!st.on) return;
  try {
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
    const own = new Set(BrowserWindow.getAllWindows().map(w => w.getMediaSourceId()));
    const game = sources.find(s => !own.has(s.id) && /^royal\s*quest/i.test(s.name.trim()));
    if (game && (!captureSource || captureSource.id !== game.id)) { captureSource = game; st.game = game.name; emit(); connectCapture(); }
    else if (!game && st.game) { captureSource = null; st.game = null; st.reading = false; emit(); stopCapture(); }
  } catch (err) { log('sources ' + err); }
}

function connectCapture() {
  if (!st.on || !st.ready || !captureSource || !worker) return;
  if (!captureWin || captureWin.isDestroyed()) {
    captureWin = new BrowserWindow({ show: false, width: 200, height: 200, webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } });
    captureWin.loadFile(path.join(__dirname, 'capture.html'));
    captureWin.on('closed', () => { captureWin = null; });
  }
  const begin = () => {
    // frames go straight from the capture page to the worker
    const { port1, port2 } = new MessageChannelMain();
    worker.postMessage({ type: 'port' }, [port2]);
    captureWin.webContents.postMessage('trade:start', { sourceId: captureSource.id }, [port1]);
    workerPort = port1;
  };
  if (captureWin.webContents.isLoading()) captureWin.webContents.once('did-finish-load', begin); else begin();
}
function stopCapture() { if (captureWin && !captureWin.isDestroyed()) captureWin.webContents.send('trade:stop'); if (worker) worker.postMessage({ type: 'reset' }); last = null; sendPanel(); }

// ---------- the panel ----------
let panelPinned = false, dragFrom = null;
function createPanel() {
  const wa = screen.getPrimaryDisplay().workArea;
  const pos = settings.panel || { x: wa.x + 40, y: wa.y + 120 };
  panel = new BrowserWindow({
    x: pos.x, y: pos.y, width: PANEL_W, height: PANEL_H, frame: false, transparent: true, resizable: false, skipTaskbar: true, show: false,
    alwaysOnTop: true, hasShadow: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  panel.setAlwaysOnTop(true, 'screen-saver');
  panel.loadFile(path.join(__dirname, 'overlay', 'index.html'), { query: { lang } });
  panel.on('closed', () => { panel = null; });
  panel.webContents.once('did-finish-load', sendPanel);
}
function sendPanel() {
  if (!panel || panel.isDestroyed()) return;
  panel.webContents.send('trade:panel', { lang, game: st.game, ready: st.ready, error: st.error, issue: st.issue, pinned: panelPinned, hotkey: settings.hotkey,
    signs: pricing(), outcome: st.lastOutcome, accounting: last ? last.accounting : null, backpackGold: last ? last.backpackGold : null,
    last: last ? { state: last.state, observation: last.observation, value: last.value } : null });
}
function togglePanel() {
  if (!panel) return;
  if (panel.isVisible()) { panel.hide(); panelPinned = false; } else { panel.showInactive(); panelPinned = true; sendPanel(); }
}
function registerKey() {
  try { globalShortcut.unregister(settings.hotkey); } catch { /* not registered */ }
  try { st.hotkeyOk = globalShortcut.register(settings.hotkey, togglePanel); } catch { st.hotkeyOk = false; }
}

ipcMain.on('trade:drag-start', () => { if (!panel) return; const [x, y] = panel.getPosition(); dragFrom = { x, y }; });
ipcMain.on('trade:drag', (_e, dx, dy) => { if (panel && dragFrom) panel.setBounds({ x: Math.round(dragFrom.x + dx), y: Math.round(dragFrom.y + dy), width: PANEL_W, height: PANEL_H }); });
ipcMain.on('trade:drag-end', () => { if (!panel) return; dragFrom = null; const [x, y] = panel.getPosition(); settings.panel = { x, y }; writeJson('settings.json', settings); });
ipcMain.on('trade:hide', () => { if (panel) { panel.hide(); panelPinned = false; } });
ipcMain.on('trade:focus', () => { if (panel) panel.focus(); });
ipcMain.handle('trade:known', (_e, q) => searchKnown(q));
ipcMain.on('trade:price', (_e, p) => setPrice(p));
ipcMain.on('trade:link', (_e, read, name) => link(read, name));
ipcMain.on('trade:signs', (_e, s) => setSigns(s));
ipcMain.on('trade:capture-ended', () => { captureSource = null; st.game = null; st.reading = false; emit(); setTimeout(findGame, 500); });
ipcMain.on('trade:capture-error', (_e, msg) => { log('capture error ' + msg); st.error = msg; emit(); });

// ---------- prices ----------
const NORM = s => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();
function pushCatalog() { if (worker) { worker.postMessage({ type: 'catalog', catalog: catalog() }); worker.postMessage({ type: 'pricing', pricing: pricing() }); } emit(); sendPanel(); }
/** { name, category, buy, sell, signs } — null / empty prices remove them; remove: true drops the entry */
function setPrice(p) {
  if (!p || !p.name) return;
  const name = String(p.name).trim();
  if (p.remove) delete prices.items[name];
  else {
    const num = v => { const n = Math.floor(Number(v)); return Number.isSafeInteger(n) && n >= 1 ? n : null; };
    const k = knownItems().get(name);
    const e = { category: ['regular', 'card', 'unique'].includes(p.category) ? p.category : (k ? k.category : 'regular'), buy: num(p.buy), sell: num(p.sell) };
    const signs = num(p.signs);
    if (signs != null && signs !== (k && k.signs)) e.signs = signs;
    prices.items[name] = e;
  }
  writeJson('prices.json', prices); pushCatalog();
}
// a misread name, tied to the right item: the same reading resolves to it from now on
function link(read, name) {
  if (!read || !name) return;
  prices.aliases[NORM(read)] = name;
  writeJson('prices.json', prices); pushCatalog();
}
function setSigns(s) {
  const num = v => { const n = Math.floor(Number(v)); return Number.isSafeInteger(n) && n >= 1 ? n : null; };
  if ('buySign' in s) settings.buySign = num(s.buySign);
  if ('sellSign' in s) settings.sellSign = num(s.sellSign);
  writeJson('settings.json', settings); pushCatalog();
}
function searchKnown(q) {
  const { norm } = require('../card-match');
  const t = norm(q);
  if (t.length < 2) return [];
  const out = [];
  for (const k of knownItems().values()) { if (norm(k.name).includes(t)) { out.push({ ...k, price: prices.items[k.name] || null }); if (out.length >= 40) break; } }
  for (const [name, p] of Object.entries(prices.items)) if (!knownItems().has(name) && norm(name).includes(t)) out.push({ name, category: p.category, signs: p.signs ?? null, price: p });
  return out;
}

// ---------- on / off ----------
function start(opts = {}) {
  if (opts.lang) lang = opts.lang;
  if (opts.onChange) onChange = opts.onChange;
  if (st.on) return state();
  loadSettings(); loadPrices();
  st = { on: true, ready: false, game: null, reading: false, issue: null, error: null, hotkeyOk: true, lastOutcome: null };
  createPanel(); registerKey(); startWorker();
  findGame(); findTimer = setInterval(findGame, 3000);
  return state();
}
function stop() {
  if (!st.on) return;
  st.on = false;
  clearInterval(findTimer); findTimer = null;
  try { globalShortcut.unregister(settings.hotkey); } catch { /* fine */ }
  if (captureWin && !captureWin.isDestroyed()) captureWin.destroy();
  if (panel && !panel.isDestroyed()) panel.destroy();
  if (worker) worker.kill();
  captureWin = panel = worker = null; captureSource = null; last = null;
  st = { on: false, ready: false, game: null, reading: false, issue: null, error: null, hotkeyOk: true, lastOutcome: null };
}
function setLang(l) { lang = l; sendPanel(); }
function api(cmd) {
  if (!settings) { loadSettings(); loadPrices(); }
  if (cmd.signs) setSigns(cmd.signs);
  if (cmd.price) setPrice(cmd.price);
  if (cmd.link) link(cmd.link.read, cmd.link.name);
  if (cmd.action === 'show' && panel) { panel.showInactive(); panelPinned = true; sendPanel(); }
  return state();
}

module.exports = { history: f => historyReport(f), deleteTrade, start, stop, state: () => { if (!settings) { loadSettings(); loadPrices(); } return state(); }, setLang, api, searchKnown: q => { if (!settings) { loadSettings(); loadPrices(); } return searchKnown(q); } };
