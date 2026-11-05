// Card scanner (installed app only): on the hotkey, reads the screen around the mouse with the OCR built into Windows
// (ocr/ocr-server.ps1) and finds the card whose tooltip is shown there. It never touches the game: it only looks at the
// screen, like a screenshot. The OCR helper starts once (when the scanner is turned on) and then answers at once.
// RQC_CARD_DEBUG=1: saves each capture to %TEMP%\rqc-card-scan.png and prints what was read.
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const { screen } = require('electron');
const { makeMatcher } = require('./card-match');

// inside the installed app the script is unpacked next to app.asar (package.json → build.asarUnpack)
const HELPER = path.join(__dirname, 'ocr', 'ocr-server.ps1').replace('app.asar', 'app.asar.unpacked');
// the area around the mouse (screen pixels): the tooltip can open on any side of it
// SCALE: the capture is enlarged before OCR; RETRY_SCALE: a second read when nothing was found (the small tooltip
// font reads better larger, the rest of the screen worse, so only as a retry)
const AREA_W = 1400, AREA_H = 1200, SCALE = 2, RETRY_SCALE = 3;

let proc = null, ready = null, seq = 0, match = null, lastError = null;
const pending = new Map();

function start() {
  if (proc) return ready;
  const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HELPER, '-ParentPid', String(process.pid)], { windowsHide: true });
  proc = p;
  let buf = '', onReady;
  ready = new Promise(res => { onReady = res; });
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.type === 'ready') { lastError = null; onReady(true); continue; }
      const job = pending.get(String(msg.id));
      if (msg.type === 'error') {
        lastError = msg.code === 'no-ru-ocr' ? 'no-ru-ocr' : msg.message;
        if (job) { pending.delete(String(msg.id)); job.reject(new Error(lastError)); } else onReady(false);
        continue;
      }
      if (msg.type === 'frame' && job) { pending.delete(String(msg.id)); job.resolve(msg.lines || []); }
    }
  });
  p.on('exit', () => {
    if (p !== proc) return;
    proc = null; onReady(false);
    for (const job of pending.values()) job.reject(new Error(lastError || 'ocr stopped'));
    pending.clear();
  });
  return ready;
}
function stop() {
  if (!proc) return;
  const p = proc; proc = null;
  try { p.stdin.end(); p.kill(); } catch { /* gone */ }
}

async function ocr(rect, scale = SCALE) {
  if (!(await start()) || !proc) throw new Error(lastError || 'ocr not started');
  const id = String(++seq);
  const save = process.env.RQC_CARD_DEBUG ? ' ' + path.join(os.tmpdir(), 'rqc-card-scan.png') : '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, 10000);
    pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
    proc.stdin.write(`${id} ${rect.x} ${rect.y} ${rect.width} ${rect.height} ${scale}${save}\n`);
  });
}

/** skip: the alert window bounds (DIP), its text is ignored. Reads the card under the mouse → { ok, name, signs, ms } or { ok: false, reason: 'none' | 'no-ru-ocr' | <error>, read } */
async function scan(skip) {
  const t0 = Date.now();
  if (!match) match = makeMatcher(require('./data/card-signs.js'));
  // Electron works in DIP; the helper captures physical pixels
  const dip = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(dip);
  const toPx = p => (screen.dipToScreenPoint ? screen.dipToScreenPoint(p) : { x: Math.round(p.x * display.scaleFactor), y: Math.round(p.y * display.scaleFactor) });
  const cur = toPx(dip);
  const tl = toPx({ x: display.bounds.x, y: display.bounds.y });
  const br = toPx({ x: display.bounds.x + display.bounds.width, y: display.bounds.y + display.bounds.height });
  const x0 = Math.max(tl.x, cur.x - AREA_W / 2), y0 = Math.max(tl.y, cur.y - AREA_H / 2);
  const rect = { x: x0, y: y0, width: Math.min(br.x, x0 + AREA_W) - x0, height: Math.min(br.y, y0 + AREA_H) - y0 };
  // our own alert in the corner (an earlier result) is on the screen too: not a card under the mouse
  const a = skip && toPx({ x: skip.x, y: skip.y }), b = skip && toPx({ x: skip.x + skip.width, y: skip.y + skip.height });
  const read = async scale => {
    let lines = await ocr(rect, scale);
    if (skip) lines = lines.filter(l => !(l.x >= a.x && l.r <= b.x && l.y >= a.y && l.b <= b.y));
    const found = match(lines, cur);
    if (process.env.RQC_CARD_DEBUG) console.log('[card-scan]', JSON.stringify({ scale, rect, cur, found, lines: lines.map(l => l.text) }));
    return found;
  };
  let found;
  try {
    found = await read(SCALE);
    if (!found || found.miss) found = (await read(RETRY_SCALE)) || found;
  } catch (e) { return { ok: false, reason: e.message }; }
  if (!found || found.miss) return { ok: false, reason: 'none', read: found && found.miss, ms: Date.now() - t0 };
  return { ok: true, name: found.name, signs: found.signs, ms: Date.now() - t0 };
}

// The Windows component «Optical character recognition» for Russian (a keyboard layout alone does not bring it).
// Installing needs admin rights: Windows asks (UAC), then downloads it, which can take a few minutes.
// → { ok: true } or { ok: false, reason: 'cancel' (the UAC prompt was declined) | 'no-package' | <code> }
function installRuOcr() {
  const inner = [
    "$ErrorActionPreference = 'Stop'",
    'try {',
    "  $c = Get-WindowsCapability -Online | Where-Object { $_.Name -like 'Language.OCR~~~ru-RU~*' } | Select-Object -First 1",
    '  if (-not $c) { exit 3 }',
    "  if ($c.State -ne 'Installed') { Add-WindowsCapability -Online -Name $c.Name | Out-Null }",
    '  exit 0',
    '} catch { exit 1 }',
  ].join('\n');
  const enc = s => Buffer.from(s, 'utf16le').toString('base64');
  const outer = 'try { $p = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru ' +
    `-ArgumentList '-NoProfile','-EncodedCommand','${enc(inner)}'; exit $p.ExitCode } catch { exit 1223 }`;
  return new Promise(res => {
    const p = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', enc(outer)], { windowsHide: true });
    p.on('error', e => res({ ok: false, reason: e.message }));
    p.on('exit', code => res(code === 0 ? { ok: true } : { ok: false, reason: code === 1223 ? 'cancel' : code === 3 ? 'no-package' : 'code ' + code }));
  });
}

module.exports = { start, stop, scan, installRuOcr };
