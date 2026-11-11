// Phone and tablet audit of the whole site: serves the working tree the way GitHub Pages does (index at the root, web.js),
// opens every view at the given size with touch media, lists what sticks out / is cut / is too small to tap, saves screenshots.
// Run: SHOT_DIR=<out-dir> [SITE_DIR=<built _site with the search pages>] electron test/phone-audit.js [view-name-regex|all] [width] [height]
//   → <out-dir>/<width>/<view>-<n>.png and report.txt (report-part.txt with a filter). Sizes worth running: 320 360 390 430 768 1024 1099.
// A clean report has no «PAGE WIDER», «sticks out», «cut text» or «dialog off screen» lines; «scrolls sideways» is fine for tables.
const { app, BrowserWindow } = require('electron');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const LANDING = process.env.SITE_DIR || ''; // the built search pages (tools/build-landing.mjs); without it those views are skipped
const FILTER = process.argv[2] && process.argv[2] !== 'all' ? new RegExp(process.argv[2]) : null;
const W = +process.argv[3] || 390, H = +process.argv[4] || 844;
const OUT = path.join(process.env.SHOT_DIR || path.join(require('os').tmpdir(), 'rqc-phone-audit'), String(W));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const index = () => fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8')
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <base href="app/">')
  .replace('<script src="builds.js"></script>', '<script src="web.js"></script>\n  <script src="builds.js"></script>');
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  const send = (code, type, body) => { r.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); r.end(body); };
  if (p === '/' || p === '/index.html') return send(200, types['.html'], index());
  if (p === '/app/build.json') return send(200, types['.json'], '{"build":"dev","version":"dev"}');
  if (p.endsWith('/')) p += 'index.html';
  const f = p === '/app/web.js' || p === '/app/favicon.png' || p === '/app/apple-touch-icon.png' ? path.join(ROOT, 'web', path.basename(p))
    : /^\/(app|data|src)\//.test(p) ? path.join(ROOT, p) : path.join(LANDING, p);
  fs.readFile(f, (e, b) => (e ? send(404, 'text/plain', 'not found') : send(200, types[path.extname(f).toLowerCase()] || 'application/octet-stream', b)));
});

const BUILD = `{ const c = ctx.defaultCharacter(); c.classId = 2; c.level = 65; for (const id of ctx.editStatIds(2)) c.stats[id] = 1; c.stats[4] = 100; c.stats[8] = 100; c.stats[7] = 57;
  for (const key of ['21:0', '3:0', '1:0', '4:0', '5:0', '6:0', '7:0', '11:0', '11:1', '12:0']) { const item = ctx.itemsForSlot(c, key)[0]; if (item) c.equipment[key] = { itemId: item.id, upgrade: Math.min(10, ctx.maxUpgrade(item)), cards: [] }; }
  loadBuild({ name: 'Крестоносец 65', ch: c }); }`;
const calc = t => `switchTool('calc'); tab='${t}'; renderCenter(); renderTop();`;
const base = (kind, key) => `switchTool('base'); openBase(${JSON.stringify(kind)}, ${key});`;
const q = s => JSON.stringify(s);
// name → script run on the page (after the sample build is loaded). `shots` = how many screens down to capture.
const VIEWS = {
  'calc-gear': { js: calc('gear'), shots: 4 },
  'calc-talents': { js: calc('talents'), shots: 3 },
  'calc-effects': { js: calc('effects'), shots: 3 },
  'calc-collection': { js: calc('collection'), shots: 2 },
  'calc-builds': { js: calc('builds'), shots: 2, wait: 2500 },
    'calc-editor-weapon': { js: calc('gear') + "openEditor('21:0');", shots: 1 },
  'calc-editor-detail': { js: calc('gear') + "openEditor('1:0');", shots: 2 },
  'calc-editor-list': { js: calc('gear') + "openEditor('1:0'); editor.setPane('list');", shots: 1 },
  'calc-editor-empty': { js: calc('gear') + "openEditor('2:0');", shots: 1 },
  'calc-class': { js: calc('gear') + "document.querySelector('.cls-btn').click();", shots: 1 },
  'menu-tools': { js: calc('gear') + "document.getElementById('brandBtn').click();", shots: 1 },
  'menu-builds': { js: calc('gear') + "document.getElementById('btnBuilds').click();", shots: 1 },
  'dlg-code': { js: calc('gear') + "document.getElementById('btnCode').click();", shots: 1 },
  'dlg-buildcard': { js: calc('gear') + 'openBuildCard();', shots: 1, wait: 2500 },
  'dlg-publish': { js: calc('gear') + 'openPublish();', shots: 1 },
  'dlg-settings': { js: calc('gear') + 'openSettings();', shots: 2 },
  'dlg-report': { js: calc('gear') + 'openReport();', shots: 1 },
  'dlg-news': { js: calc('gear') + "document.getElementById('btnNews').click();", shots: 1 },
  'timer': { js: "switchTool('timer');", shots: 2 },
  'timer-kill': { js: "switchTool('timer'); document.querySelector('.bt-act button:not(.bt-kill)')?.click();", shots: 1 },
  'timer-resp': { js: "switchTool('timer'); document.querySelector('.bt-resp')?.click();", shots: 1 },
  'timer-join': { js: "switchTool('timer'); [...document.querySelectorAll('.bt-room button')].pop()?.click();", shots: 1 },
  'base-list-monster': { js: "switchTool('base'); BS.cat='monster'; BS.pane='list'; renderCenter();", shots: 2 },
  'base-list-good': { js: "switchTool('base'); BS.cat='good'; BS.pane='list'; renderCenter();", shots: 1 },
  'base-list-ref': { js: "switchTool('base'); BS.cat='ref'; BS.pane='list'; renderCenter();", shots: 2 },
  'base-monster': { js: base('monster', q('Пещерный Волк')), shots: 3 },
  'base-boss': { js: base('monster', q('Тёмный Шаман')), shots: 2 },
  'base-loc': { js: base('loc', q('Элгор')), shots: 4 },
  'base-loc-all': { js: base('loc', q('Все локации')), shots: 3 },
  'base-npc': { js: base('npc', q('Кузнец Дарин')), shots: 3 },
  'base-quest': { js: base('quest', 'baseIndex().quests.find(x => (x.reward || []).length && (x.kill || []).length).name'), shots: 2 },
  'base-event': { js: base('event', q('Праздник урожая')), shots: 3 },
  'base-recipe': { js: base('recipe', q('Рецепт: Неоновые очки')), shots: 4 },
  'base-res': { js: base('res', 'baseIndex().nodes[0].name'), shots: 2 },
  'base-item': { js: base('item', '394'), shots: 2 },
  'base-weapon': { js: base('item', "baseIndex().items.find(i => i.info && i.info.kind === 'weapon' && i.level >= 60).id"), shots: 2 },
  'base-card': { js: base('card', 'baseIndex().cards[0].id'), shots: 2 },
  'base-stamp': { js: base('stamp', 'baseIndex().stamps[0].id'), shots: 2 },
  'base-good': { js: base('good', q('Мифриловая руда')), shots: 2 },
  'base-search': { js: "switchTool('base'); BS.q='мифрил'; renderCenter();", shots: 1 },
  'ref-exp': { js: base('ref', q('exp')), shots: 2 },
  'ref-elements': { js: base('ref', q('elements')), shots: 2 },
  'ref-upgrade': { js: base('ref', q('upgrade')), shots: 4 },
  'ref-trials': { js: base('ref', q('trials')), shots: 2 },
  'ref-daily': { js: base('ref', q('daily')), shots: 2 },
  'ref-dailyq': { js: base('ref', q('dailyQuests')), shots: 2 },
  'ref-achievements': { js: base('ref', q('achievements')) + "document.querySelector('.rf-fold').open = true;", shots: 2 },
  'ref-collections': { js: base('ref', q('collections')), shots: 2 },
  'ref-shop': { js: base('ref', q('shop')), shots: 2 },
  'ref-guilds': { js: base('ref', q('guilds')), shots: 3 },
  'ref-servers': { js: base('ref', q('servers')), shots: 2 },
  'steam': { js: "switchTool('steam');", shots: 2, wait: 3500 },
  'steam-post': { js: "switchTool('steam'); setTimeout(() => document.querySelector('.sn-row, .sn-item, .sn-card')?.click(), 2500);", shots: 3, wait: 4500 },
  'calendar': { js: "switchTool('calendar');", shots: 3, wait: 3500 },
  'stats': { js: "switchTool('stats');", shots: 2 },
  'land-calculator': { url: '/calculator/', shots: 4 },
  'land-boss-timer': { url: '/boss-timer/', shots: 3 },
  'land-base': { url: '/base/', shots: 3 },
  'land-calendar': { url: '/calendar/', shots: 3 },
  'land-program': { url: '/program/', shots: 4 },
};

// what is wrong on the page right now (run in the page)
const CHECK = `(() => {
  const W = innerWidth, Hh = innerHeight;
  const rect = e => e.getBoundingClientRect();
  const vis = e => { const r = rect(e); if (!r.width || !r.height) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
  const name = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/).join('.') : '')).slice(0, 60);
  const scroller = e => { for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1 && p !== document.body) return p; } return null; };
  const clippedBy = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.overflowX === 'hidden' || s.overflowX === 'clip') { const r = rect(p); if (rect(e).right > r.right + 1 || rect(e).left < r.left - 1) return p; } } return null; };
  const all = [...document.querySelectorAll('body *')].filter(vis);
  const out = { pageWidth: document.documentElement.scrollWidth, screen: W, pageHeight: document.documentElement.scrollHeight, over: [], cut: [], scrollers: [], tiny: [], small: [], dialogs: [] };
  // sticks out past the screen edge (the deepest ones only), unless it is inside something that scrolls sideways
  const outside = all.filter(e => (rect(e).right > W + 1 || rect(e).left < -1) && !scroller(e) && getComputedStyle(e).position !== 'fixed' || (getComputedStyle(e).position === 'fixed' && (rect(e).right > W + 1 || rect(e).left < -1)));
  for (const e of outside) if (!outside.some(o => o !== e && e.contains(o))) out.over.push(name(e) + ' ' + Math.round(rect(e).left) + '..' + Math.round(rect(e).right));
  // text cut off by a hidden overflow with no ellipsis
  for (const e of all) {
    if (!e.childElementCount && e.textContent.trim() && e.scrollWidth > e.clientWidth + 2) { const s = getComputedStyle(e); if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && s.textOverflow !== 'ellipsis' && s.whiteSpace === 'nowrap') out.cut.push(name(e) + ' «' + e.textContent.trim().slice(0, 30) + '»'); }
    else if (e.textContent.trim() && !e.childElementCount) { const p = clippedBy(e); if (p && !scroller(e)) out.cut.push(name(e) + ' «' + e.textContent.trim().slice(0, 30) + '» cut by ' + name(p)); }
  }
  // blocks that scroll sideways (fine for tables and tab strips; listed to be looked at)
  for (const e of all) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1) out.scrollers.push(name(e) + ' ' + e.clientWidth + '/' + e.scrollWidth); }
  // things to tap that are too small for a finger
  for (const e of document.querySelectorAll('button, a[href], input, select, summary, [role=button]')) {
    if (!vis(e)) continue; const r = rect(e); if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
    if (Math.min(r.width, r.height) < 26 && e.type !== 'checkbox' && e.type !== 'radio' && e.type !== 'range') out.tiny.push(name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  // text too small to read
  const smallSeen = new Set();
  for (const e of all) { if (!e.childElementCount || [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) { const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 10.5 && e.textContent.trim()) { const k = name(e) + ' ' + fs; if (!smallSeen.has(k)) { smallSeen.add(k); out.small.push(k); } } } }
  // a dialog taller or wider than the screen that cannot scroll
  for (const e of document.querySelectorAll('.dialog, .menu:not([hidden]), .pop, .news-menu:not([hidden])')) { if (!vis(e)) continue; const r = rect(e); if (r.bottom > Hh + 1 || r.right > W + 1 || r.top < -1) out.dialogs.push(name(e) + ' ' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' of ' + Hh + ', scrollable: ' + (e.scrollHeight > e.clientHeight)); }
  const cap = (l, n) => l.length > n ? l.slice(0, n).concat('… +' + (l.length - n)) : l;
  out.over = cap(out.over, 8); out.cut = cap([...new Set(out.cut)], 8); out.scrollers = cap(out.scrollers, 8); out.tiny = cap([...new Set(out.tiny)], 10); out.small = cap(out.small, 10);
  return out;
})()`;

fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, 'steps.txt');
fs.writeFileSync(LOG, '');
const step = m => fs.appendFileSync(LOG, new Date().toISOString().slice(11, 19) + ' ' + m + '\n');
process.on('uncaughtException', e => { step('uncaught ' + e.stack); app.exit(1); });
process.on('unhandledRejection', e => { step('rejection ' + (e && e.stack || e)); app.exit(1); });
app.setPath('userData', path.join(OUT, '..', 'profile'));
app.on('window-all-closed', () => {});
const sleep = ms => new Promise(r => setTimeout(r, ms));
app.whenReady().then(async () => {
  step('ready');
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + srv.address().port;
  step('server ' + origin);
  // rendered off screen: a hidden ordinary window hands out stale frames, so dialogs opened by a script were missing in the shots
  const win = new BrowserWindow({ width: W, height: H, useContentSize: true, minWidth: 200, minHeight: 200, show: false, webPreferences: { offscreen: true } });
  win.webContents.setFrameRate(30);
  const shot = async () => { win.webContents.invalidate(); await sleep(250); return (await win.webContents.capturePage()).toPNG(); };
  const errors = [];
  win.webContents.on('console-message', e => { if (e.level === 'error' || e.level === 3) errors.push(e.message); });
  // a phone: touch, no hover
  let emulated = false;
  const emulate = async () => {
    if (emulated) return; emulated = true;
    const cmd = (m, p) => Promise.race([win.webContents.debugger.sendCommand(m, p), new Promise((_, rej) => setTimeout(() => rej(new Error(m + ' timed out')), 4000))]);
    try { win.webContents.debugger.attach('1.3'); await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] }); step('touch media on'); } catch (e) { step('emulation failed: ' + e.message); }
  };
  const report = [];
  for (const [name, v] of Object.entries(VIEWS)) {
    if ((FILTER && !FILTER.test(name)) || (v.url && !LANDING)) continue;
    errors.length = 0;
    try {
      step('view ' + name);
      await win.loadURL(origin + (v.url || '/'));
      step('  loaded');
      if (!emulated) { await emulate(); await win.loadURL(origin + (v.url || '/')); }
      win.setContentSize(W, H);
      // a hidden window does not run animations: without this a dialog stays at the first frame of its fade-in (invisible)
      await win.webContents.insertCSS('*, *::before, *::after { animation: none !important; transition: none !important; }');
      // a phone's scrollbars lie over the page and take no width
      await win.webContents.insertCSS('html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; } html { scrollbar-width: none; }');
      if (!v.url) {
        await win.webContents.executeJavaScript(`localStorage.setItem('rqc.lang', JSON.stringify('ru')); lang = 'ru'; T = RQC_I18N.ru; applyGameLang(); ${BUILD}; renderAll(); 1`);
        await win.webContents.executeJavaScript(v.js + '; 1').catch(e => errors.push('script: ' + e.message));
      }
      await sleep(v.wait || 900);
      if (process.env.PROBE) { fs.writeFileSync(path.join(OUT, 'probe.txt'), JSON.stringify(await win.webContents.executeJavaScript(process.env.PROBE), null, 1)); fs.writeFileSync(path.join(OUT, 'probe.png'), await shot()); srv.close(); app.exit(0); return; }
      const r = await win.webContents.executeJavaScript(CHECK);
      const scrollerSel = v.url ? null : null;
      for (let i = 0; i < (v.shots || 1); i++) {
        // the page itself scrolls on a phone; dialogs scroll inside
        const more = await win.webContents.executeJavaScript(`(() => { const y = ${i} * (innerHeight - 80); const dlg = document.querySelector('#modal:not([hidden]) .dialog-body, #modal:not([hidden]) .dialog');
          if (dlg && dlg.scrollHeight > dlg.clientHeight + 10) { dlg.scrollTop = y; return y < dlg.scrollHeight - dlg.clientHeight + innerHeight - 80; }
          scrollTo(0, y); return y < document.documentElement.scrollHeight - innerHeight + (innerHeight - 80); })()`);
        if (i && !more) break;
        await sleep(350);
        fs.writeFileSync(path.join(OUT, `${name}-${i}.png`), await shot());
      }
      const bad = [];
      if (r.pageWidth > r.screen + 1) bad.push(`PAGE WIDER THAN SCREEN: ${r.pageWidth} > ${r.screen}`);
      if (r.over.length) bad.push('sticks out: ' + r.over.join(' | '));
      if (r.cut.length) bad.push('cut text: ' + r.cut.join(' | '));
      if (r.dialogs.length) bad.push('dialog off screen: ' + r.dialogs.join(' | '));
      if (r.tiny.length) bad.push('tiny taps: ' + r.tiny.join(' | '));
      if (r.small.length) bad.push('small text: ' + r.small.join(' | '));
      if (r.scrollers.length) bad.push('scrolls sideways: ' + r.scrollers.join(' | '));
      if (errors.length) bad.push('errors: ' + [...new Set(errors)].slice(0, 4).join(' | '));
      report.push(`== ${name} (page ${r.pageHeight}px tall)` + (bad.length ? '\n   ' + bad.join('\n   ') : '  ok'));
    } catch (e) { report.push(`== ${name}\n   FAILED: ${e.message}`); }
  }
  fs.writeFileSync(path.join(OUT, FILTER ? 'report-part.txt' : 'report.txt'), report.join('\n') + '\n');
  srv.close(); app.exit(0);
});
