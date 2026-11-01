// Market scanner (installed app only). Reads the in-game market from the screen with the OCR built into Windows
// (ocr/ocr-helper.ps1) — it never touches the game itself, only looks at the screen like a screenshot.
// 1. locate: the whole primary screen every 2 s at normal size, until the header "Цена за штуку" shows up;
// 2. scan: only the market table, 3× enlarged, read again whenever it changes (the player turns a page).
// Three unreadable frames in a row (market closed or moved) → back to locate.
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const { screen } = require('electron');
const { makeMatcher, parsePage, norm } = require('./market-parse');

// inside the installed app the script is unpacked next to app.asar (package.json → build.asarUnpack)
const HELPER = path.join(__dirname, 'ocr', 'ocr-helper.ps1').replace('app.asar', 'app.asar.unpacked');
let match = null;
let proc = null, state = 'off', misses = 0, lastSig = '', emit = () => {};

function run(region, scale, interval, onFrame) {
  stopProc();
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HELPER, '-X', region.x, '-Y', region.y, '-W', region.w, '-H', region.h,
    '-Scale', scale, '-IntervalMs', interval, '-ParentPid', process.pid].map(String);
  const p = spawn('powershell.exe', args, { windowsHide: true });
  proc = p;
  let buf = '';
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line || p !== proc) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.type === 'frame') onFrame((msg.lines || []).map(l => ({ ...l, x: l.x + region.x, r: l.r + region.x, y: l.y + region.y, words: (l.words || []).map(w => ({ ...w, x: w.x + region.x })) })));
      else if (msg.type === 'error') setState('error', msg.code === 'no-ru-ocr' ? 'no-ru-ocr' : msg.message);
    }
  });
  p.on('exit', () => { if (p === proc) { proc = null; if (state !== 'off') setTimeout(() => state !== 'off' && locate(), 3000); } });
}
function stopProc() { if (proc) { const p = proc; proc = null; try { p.kill(); } catch { /* gone */ } } }
function setState(s, info) { state = s; emit({ type: 'status', state: s, info }); }

function locate() {
  const d = screen.getPrimaryDisplay(), sf = d.scaleFactor || 1;
  const full = { x: Math.round(d.bounds.x * sf), y: Math.round(d.bounds.y * sf), w: Math.round(d.bounds.width * sf), h: Math.round(d.bounds.height * sf) };
  setState('locating');
  run(full, 1, 2000, lines => {
    const head = lines.find(l => /цена за шту/.test(norm(l.text)));
    if (!head) return;
    const item = lines.find(l => norm(l.text) === 'предмет' && Math.abs(l.y - head.y) < 25 && l.x < head.x);
    const foot = lines.find(l => /^\d{1,3}\s*\/\s*\d{1,3}$/.test(l.text.trim()) && l.y > head.y);
    // the table: from the icons left of "Предмет" to past the price column, from the header to the page counter
    const x0 = Math.max(full.x, (item ? item.x : head.x - 250) - 110), x1 = Math.min(full.x + full.w, head.r + 140);
    const y0 = Math.max(full.y, head.y - 30), y1 = Math.min(full.y + full.h, foot ? foot.y + 30 : head.y + 640);
    const region = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    if (process.env.RQC_MARKET_DEBUG) emit({ type: 'debug', located: region, head });
    scan(region);
  });
}

function scan(region) {
  misses = 0;
  setState('scanning');
  run(region, 3, 700, lines => {
    const res = parsePage(lines, match);
    if (process.env.RQC_MARKET_DEBUG && !res.ok) emit({ type: 'debug', reason: res.reason, lines: lines.slice(0, 12).map(l => [l.x, l.y, l.text]) });
    if (!res.ok) { if (++misses >= 3) locate(); return; }
    misses = 0;
    if (!res.rows.length) return;
    const sig = (res.page || '') + '|' + res.rows.map(r => r.id + ':' + r.price).join(',');
    if (sig === lastSig) return;
    lastSig = sig;
    emit({ type: 'page', page: res.page, rows: res.rows.map(r => ({ id: r.id, name: r.name, price: r.price })), unknown: res.unknown.length });
  });
}

module.exports = {
  start(onEvent) {
    emit = onEvent;
    if (!match) match = makeMatcher(require('./data/market-items.js'));
    if (state === 'off' || state === 'error') { lastSig = ''; locate(); }
  },
  stop() { stopProc(); setState('off'); },
  state: () => state,
};
