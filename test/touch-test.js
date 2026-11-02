// Touch behaviour on a phone-size page: a tap must not leave a tip, a long press shows one inside the screen.
// Run: SHOT_DIR=<dir> electron test/touch-test.js   → <dir>/touch.txt and <dir>/longpress.png
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const out = process.env.SHOT_DIR;
const log = s => fs.appendFileSync(path.join(out, 'touch.txt'), s + '\n');
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'touch.txt'), '');
  const win = new BrowserWindow({ x: 20, y: 20, width: 390, height: 844, useContentSize: true, minWidth: 200 });
  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  win.setContentSize(390, 844);
  const dbg = win.webContents.debugger; dbg.attach('1.3');
  await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await dbg.sendCommand('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  const js = s => win.webContents.executeJavaScript(s);
  await js("document.querySelector('.upd.site')?.remove(); lang='ru'; T=RQC_I18N.ru; renderAll();");
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const touch = async (x, y, holdMs) => {
    await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await wait(holdMs);
    await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(400);
  };
  // a stat row in the results (has a tip, no action)
  const stat = JSON.parse(await js("(() => { const el = [...document.querySelectorAll('#right *')].find(e => e._tip); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
  await wait(300);
  await touch(stat.x, stat.y, 80);
  log('tap on a stat: tip ' + (await js('document.getElementById("tip").hidden') ? 'hidden (ok)' : 'SHOWN (bad)'));
  await touch(stat.x, stat.y, 700);
  const t = JSON.parse(await js("(() => { const t = document.getElementById('tip'); const r = t.getBoundingClientRect(); return JSON.stringify({ hidden: t.hidden, left: r.left, right: r.right, w: innerWidth }); })()"));
  log('long press on a stat: tip ' + (t.hidden ? 'HIDDEN (bad)' : `shown, x ${Math.round(t.left)}–${Math.round(t.right)} of ${t.w} ` + (t.left >= 0 && t.right <= t.w ? '(inside, ok)' : '(OUTSIDE, bad)')));
  fs.writeFileSync(path.join(out, 'longpress.png'), (await win.webContents.capturePage()).toPNG());
  // a gear slot: a tap opens the editor, no tip left behind
  const slot = JSON.parse(await js("(() => { const el = document.querySelector('.gslot'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
  await wait(300);
  await touch(slot.x, slot.y, 80);
  log('tap on a gear slot: editor ' + (await js("!document.getElementById('modal').hidden") ? 'opened (ok)' : 'NOT opened (bad)') + ', tip ' + (await js('document.getElementById("tip").hidden') ? 'hidden (ok)' : 'SHOWN (bad)'));
  app.quit();
});
