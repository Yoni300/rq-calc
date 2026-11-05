// RQ Stats inside RQ Tools (installed app only): an overlay over the game with DPS, gold, exp, kills and loot.
// Data comes from the game's chat only: the screen (Windows OCR reads the «Stats» chat tab several times a second)
// and the chat history files (chatlogs\Stats (YYYY.MM).htm, written by the game later but exactly).
// It never touches the game. main.js turns it on / off from the «Статистика» tool page (app/stats-tool.js).
'use strict';
const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');
const { ScreenTracker } = require('./src/screen-tracker');
const { LogWatcher, findChatlogsDir } = require('./src/log-watcher');
const { mergeSources, exactUntil } = require('./src/merge');
const { computeStats } = require('./src/stats');
const { mobIcon, itemIcon } = require('./icons');

const OVERLAY_W = 410;
const OVERLAY_H = 760;
const KEY_TOGGLE = 'Alt+Shift+S', KEY_CALIB = 'Alt+Shift+R';

// settings and the saved session: <RQ Tools data>\stats; the first time, taken over from the standalone RQ Stats
const dataDir = () => path.join(app.getPath('userData'), 'stats');
const configPath = () => path.join(dataDir(), 'config.json');
const sessionPath = () => path.join(dataDir(), 'session.json');
function takeOverStandalone() {
  if (fs.existsSync(configPath())) return;
  const old = path.join(app.getPath('appData'), 'rq-stats');
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    for (const f of ['config.json', 'session.json']) if (fs.existsSync(path.join(old, f))) fs.copyFileSync(path.join(old, f), path.join(dataDir(), f));
  } catch { /* nothing to take over */ }
}

let config = {};
function loadConfig() {
  try { config = JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { config = {}; }
  config.tab = config.tab || 'Stats';
}
function saveConfig() {
  try { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(configPath(), JSON.stringify(config, null, 2)); } catch (err) { console.error('[stats] config save failed', err); }
}

// ---------- session: survives closing the overlay and the app; time while it was off is not counted ----------
// pauses: [{ from, to }] (to = null while paused): their time is not counted and nothing that happened then counts
let sessionStart = Date.now(), closedMs = 0, screenEvents = [], pauses = [], paused = false;
const pausedMs = now => pauses.reduce((sum, p) => sum + Math.max(0, Math.min(p.to ?? now, now) - p.from), 0);
const inPause = t => pauses.some(p => t >= p.from && t < (p.to ?? Infinity));
function loadSession() {
  try {
    const s = JSON.parse(fs.readFileSync(sessionPath(), 'utf8'));
    if (typeof s.start !== 'number' || !Array.isArray(s.screenEvents)) return;
    sessionStart = s.start;
    closedMs = (s.closedMs || 0) + Math.max(0, Date.now() - (s.lastSeen || Date.now()));
    screenEvents = s.screenEvents.filter(e => e && typeof e.time === 'number' && e.time >= sessionStart);
    pauses = Array.isArray(s.pauses) ? s.pauses.filter(p => p && typeof p.from === 'number') : [];
    paused = !!s.paused;
    // paused when closed: the closed time is already left out (closedMs), so the open pause restarts now
    const open = pauses.find(p => p.to == null);
    if (open) { open.to = Math.max(open.from, s.lastSeen || open.from); if (paused) pauses.push({ from: Date.now(), to: null }); }
  } catch { /* no saved session: a new one */ }
}
function saveSession() {
  const data = JSON.stringify({ version: 1, start: sessionStart, closedMs, lastSeen: Date.now(), screenEvents, pauses, paused });
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(sessionPath() + '.tmp', data);
    fs.renameSync(sessionPath() + '.tmp', sessionPath());
  } catch (err) { console.error('[stats] session save failed', err); }
}
function newSession() { sessionStart = Date.now(); closedMs = 0; screenEvents = []; pauses = []; paused = false; saveSession(); }
function setPaused(v) {
  if (v === paused) return;
  const now = Date.now();
  if (v) pauses.push({ from: now, to: null });
  else { const open = pauses.find(p => p.to == null); if (open) open.to = now; }
  paused = v;
  saveSession();
}

// ---------- saved sessions: the player names a session and keeps its results (stats\sessions.json) ----------
const savedPath = () => path.join(dataDir(), 'sessions.json');
function listSaved() { try { const a = JSON.parse(fs.readFileSync(savedPath(), 'utf8')); return Array.isArray(a) ? a : []; } catch { return []; } }
function writeSaved(list) {
  try { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(savedPath() + '.tmp', JSON.stringify(list)); fs.renameSync(savedPath() + '.tmp', savedPath()); }
  catch (err) { console.error('[stats] sessions save failed', err); }
}
function saveCurrent(name) {
  const s = current();
  const entry = {
    id: Date.now().toString(36), name: String(name || '').trim().slice(0, 80) || new Date().toLocaleString(), savedAt: Date.now(),
    start: s.start, durationMs: s.durationMs, gold: s.gold, exp: s.exp, totalKills: s.totalKills, totalItems: s.totalItems, cards: s.cards,
    dealt: s.dealt, recv: s.recv, heal: s.heal, hits: s.hits, misses: s.misses, avgDps: s.avgDps, peakDps: s.peakDps, maxHit: s.maxHit,
    level: s.level, levelsGained: s.levelsGained,
    mobs: s.mobs.map(m => ({ name: m.name, count: m.count, exp: m.exp, icon: m.icon })),
    items: s.items.map(i => ({ name: i.name, qty: i.qty, rarity: i.rarity, card: i.card, icon: i.icon })),
  };
  writeSaved([entry, ...listSaved()].slice(0, 300));
  return entry;
}
function deleteSaved(id) { writeSaved(listSaved().filter(e => e.id !== id)); }

let tracker = new ScreenTracker();
let files = { monthly: null, exported: null };
const status = { screen: 'starting', error: '', lastFrameAt: 0, lastEventAt: 0, chatlogsDir: '' };
let on = false, lang = 'ru', onChange = () => {};
let overlay = null, calib = null, ocr = null, ocrStopping = false, watcher = null, dragFrom = null, timers = [];

// ---------- screen reading ----------
function stopOcr() {
  if (!ocr) return;
  ocrStopping = true;
  try { ocr.kill(); } catch { /* already gone */ }
  ocr = null;
}
function startOcr() {
  stopOcr();
  const r = config.region;
  if (!r || r.w < 20 || r.h < 20) { status.screen = 'no-region'; return; }
  ocrStopping = false;
  status.screen = 'starting'; status.error = '';
  // inside the installed app the script is unpacked next to app.asar (package.json → build.asarUnpack)
  const script = path.join(__dirname, 'ocr', 'ocr-helper.ps1').replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
  const proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
    '-X', String(r.x), '-Y', String(r.y), '-W', String(r.w), '-H', String(r.h), '-IntervalMs', '250', '-ParentPid', String(process.pid)], { windowsHide: true });
  ocr = proc;
  readline.createInterface({ input: proc.stdout }).on('line', line => {
    let msg;
    try { msg = JSON.parse(line.replace(/^﻿/, '')); } catch { return; }
    if (msg.type === 'ready') status.screen = 'ok';
    if (msg.type === 'error') { status.screen = 'error'; status.error = msg.code || msg.message || ''; }
    if (msg.type === 'frame') {
      status.screen = 'ok'; status.lastFrameAt = Date.now();
      const evs = tracker.push(msg);
      if (evs.length) { status.lastEventAt = Date.now(); screenEvents.push(...evs); pushSnapshot(); }
    }
  });
  proc.stderr.on('data', d => console.error('[stats ocr]', d.toString()));
  proc.on('exit', () => {
    if (ocr === proc) ocr = null;
    if (!ocrStopping && on) { status.screen = 'error'; setTimeout(() => { if (on && !ocr && !ocrStopping) startOcr(); }, 3000); }
  });
}

// ---------- chat history files ----------
function startWatcher() {
  const dir = config.chatlogsDir || findChatlogsDir();
  status.chatlogsDir = dir || '';
  if (!dir) return;
  watcher = new LogWatcher({ dir, tab: config.tab, since: sessionStart - 60_000 });
  watcher.on('update', s => { files = s; pushSnapshot(); });
  watcher.on('error', err => console.error('[stats logs]', err.message));
  watcher.start();
}

function current() {
  const now = Date.now();
  screenEvents = screenEvents.filter(e => e.time >= sessionStart);
  const events = mergeSources({ ...files, screen: screenEvents, start: sessionStart }).filter(e => !inPause(e.time));
  const s = computeStats(events, sessionStart, now, Math.max(0, now - sessionStart - closedMs - pausedMs(now)));
  // pictures (paths inside data/) for the lists
  for (const m of s.mobs) m.icon = mobIcon(m.name);
  for (const i of s.items) i.icon = itemIcon(i.name);
  return s;
}
function pushSnapshot() {
  if (!overlay || overlay.isDestroyed()) return;
  const now = Date.now();
  const snap = current();
  snap.paused = paused;
  const exact = exactUntil(files);
  snap.status = {
    screen: status.screen, error: status.error, reading: now - status.lastFrameAt < 5000, lastEventAt: status.lastEventAt,
    exactUntil: exact && exact >= sessionStart ? exact : null, chatlogsFound: !!status.chatlogsDir, tab: config.tab,
  };
  overlay.webContents.send('snapshot', snap);
}

// ---------- windows ----------
function createOverlay() {
  const wa = screen.getPrimaryDisplay().workArea;
  const pos = config.overlayPos || { x: wa.x + wa.width - OVERLAY_W - 20, y: wa.y + 80 };
  overlay = new BrowserWindow({
    x: pos.x, y: pos.y, width: OVERLAY_W, height: OVERLAY_H,
    frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: false, focusable: true, show: false, title: 'RQ Stats',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadFile(path.join(__dirname, 'overlay', 'index.html'), { query: { lang } });
  overlay.once('ready-to-show', () => { overlay.showInactive(); pushSnapshot(); });
  overlay.on('closed', () => { overlay = null; });
}
function openCalibration() {
  if (!on) return;
  if (calib) { calib.focus(); return; }
  const d = screen.getPrimaryDisplay();
  calib = new BrowserWindow({
    x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
    frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true,
    alwaysOnTop: true, fullscreenable: false, hasShadow: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  calib.setAlwaysOnTop(true, 'screen-saver');
  calib.loadFile(path.join(__dirname, 'overlay', 'calibrate.html'), { query: { lang } });
  calib.once('ready-to-show', () => {
    let current = null;
    if (config.region) {
      const r = screen.screenToDipRect(null, { x: config.region.x, y: config.region.y, width: config.region.w, height: config.region.h });
      current = { x: r.x - d.bounds.x, y: r.y - d.bounds.y, w: r.width, h: r.height };
    }
    calib.webContents.send('calib:init', { current });
    calib.show(); calib.focus();
  });
  calib.on('closed', () => { calib = null; });
}
function toggleVisible() {
  if (!overlay) return;
  if (overlay.isVisible()) overlay.hide(); else overlay.showInactive();
}

// ---------- messages from the overlay pages ----------
ipcMain.on('overlay:interactive', (_e, v) => { if (overlay && !dragFrom) overlay.setIgnoreMouseEvents(!v, { forward: true }); });
ipcMain.on('overlay:drag-start', () => { if (!overlay) return; const [x, y] = overlay.getPosition(); dragFrom = { x, y }; });
ipcMain.on('overlay:drag', (_e, dx, dy) => {
  if (overlay && dragFrom) overlay.setBounds({ x: Math.round(dragFrom.x + dx), y: Math.round(dragFrom.y + dy), width: OVERLAY_W, height: OVERLAY_H });
});
ipcMain.on('overlay:drag-end', () => {
  if (!overlay) return;
  dragFrom = null;
  const [x, y] = overlay.getPosition();
  config.overlayPos = { x, y }; saveConfig();
});
ipcMain.on('overlay:action', (_e, name) => {
  if (name === 'reset') { newSession(); pushSnapshot(); }
  else if (name === 'calibrate') openCalibration();
  else if (name === 'pause') { setPaused(!paused); pushSnapshot(); onChange(); }
  else if (name === 'quit') { stop(); onChange(); } // the overlay's ✕: off, the tool page shows it
});
// the overlay's «save» with the name typed there
ipcMain.on('overlay:save', (_e, name) => { saveCurrent(name); onChange(); });
ipcMain.on('calib:done', (_e, r) => {
  const d = screen.getPrimaryDisplay();
  const phys = screen.dipToScreenRect(null, { x: d.bounds.x + r.x, y: d.bounds.y + r.y, width: r.w, height: r.h });
  config.region = { x: phys.x, y: phys.y, w: phys.width, h: phys.height };
  tracker = new ScreenTracker();
  saveConfig();
  if (calib) calib.close();
  startOcr(); pushSnapshot();
});
ipcMain.on('calib:cancel', () => { if (calib) calib.close(); });

// ---------- on / off ----------
let loaded = false;
/** opts: { lang, onChange: called when the overlay changed something (✕, pause, save) } → state + { keys: whether the hotkeys could be taken } */
function start(opts = {}) {
  if (opts.lang) lang = opts.lang;
  if (opts.onChange) onChange = opts.onChange;
  if (on) { if (overlay) overlay.showInactive(); return state(); }
  on = true;
  if (!loaded) { takeOverStandalone(); loadConfig(); loadSession(); loaded = true; }
  else { loadSession(); } // counts the time it was off as «closed»
  tracker = new ScreenTracker(); files = { monthly: null, exported: null };
  createOverlay(); startWatcher(); startOcr();
  timers = [setInterval(pushSnapshot, 1000), setInterval(saveSession, 5000)];
  let keys = true;
  try { keys = globalShortcut.register(KEY_TOGGLE, toggleVisible) && keys; } catch { keys = false; }
  try { keys = globalShortcut.register(KEY_CALIB, openCalibration) && keys; } catch { keys = false; }
  if (!config.region) setTimeout(openCalibration, 800);
  return { ...state(), keys };
}
function stop() {
  if (!on) return;
  on = false;
  saveSession();
  for (const t of timers) clearInterval(t);
  timers = [];
  try { globalShortcut.unregister(KEY_TOGGLE); globalShortcut.unregister(KEY_CALIB); } catch { /* not ours */ }
  stopOcr();
  if (watcher) { watcher.stop(); watcher = null; }
  if (calib) calib.close();
  if (overlay) overlay.close();
}
function state() {
  if (!loaded) { takeOverStandalone(); loadConfig(); loadSession(); loaded = true; } // the page asks before it was ever on
  return { on, paused, hasRegion: !!(config.region), chatlogs: status.chatlogsDir || '', sessions: listSaved() };
}
function setLang(l) { lang = l; }

module.exports = {
  start, stop, state, setLang, calibrate: openCalibration, show: () => overlay && overlay.showInactive(),
  newSession: () => { state(); newSession(); pushSnapshot(); },
  pause: v => { state(); setPaused(v); pushSnapshot(); },
  save: name => { state(); return saveCurrent(name); },
  remove: id => deleteSaved(id),
};
