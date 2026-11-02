// Phone-size screenshots of the page (the site's layout, no app bridge).
// Run: SHOT_DIR=<out-dir> [SHOT_W=390 SHOT_H=844] electron test/mobile-shot.js   → <out-dir>/<view>.png for each view below.
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outDir = process.env.SHOT_DIR, W = +process.env.SHOT_W || 390, H = +process.env.SHOT_H || 844;
process.on('uncaughtException', e => { fs.mkdirSync(outDir, { recursive: true }); fs.appendFileSync(path.join(outDir, 'error.txt'), String(e.stack)); app.quit(); });
// view name → script run on the page before the shot
const VIEWS = {
  gear: "switchTool('calc'); tab='gear'; renderCenter();",
  talents: "tab='talents'; renderCenter();",
  effects: "tab='effects'; renderCenter();",
  result: "tab='gear'; renderCenter(); document.getElementById('right').scrollIntoView();",
  menu: "document.getElementById('brandBtn').click();",
  timer: "switchTool('timer');",
  market: "switchTool('market');",
  base: "switchTool('base');",
  baseItem: "switchTool('base'); openBase('monster', 'Пещерный Волк', { push: false });",
  editor: "switchTool('calc'); openEditor('1:0');",
  settings: "openSettings();",
  builds: "switchTool('calc'); tab='builds'; renderCenter(); renderTop();",
  report: "openReport();",
};

app.whenReady().then(async () => { try {
  fs.mkdirSync(outDir, { recursive: true });
  const win = new BrowserWindow({ x: 20, y: 20, width: W, height: H, useContentSize: true, minWidth: 200, minHeight: 200 });
  for (const [name, js] of Object.entries(VIEWS)) {
    await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
    win.setContentSize(W, H);
    await win.webContents.executeJavaScript("document.querySelector('.upd.site')?.remove(); localStorage.setItem('rqc.lang', JSON.stringify('ru')); lang='ru'; T=RQC_I18N.ru; renderAll();");
    await win.webContents.executeJavaScript(js).catch(e => console.error(name, e.message));
    await new Promise(r => setTimeout(r, 700));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, name + '.png'), img.toPNG());
    const wide = await win.webContents.executeJavaScript('document.documentElement.scrollWidth');
    // the elements that stick out past the right edge (deepest first)
    const over = await win.webContents.executeJavaScript(`[...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).filter(e => ![...e.children].some(c => c.getBoundingClientRect().right > innerWidth + 1)).slice(0, 6).map(e => e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + ' → ' + Math.round(e.getBoundingClientRect().right) + ' (parent ' + (e.parentElement.className || e.parentElement.tagName) + ')').join(' | ')`);
    if (over) fs.appendFileSync(path.join(outDir, 'widths.txt'), `  sticks out: ${over}
`);
    fs.appendFileSync(path.join(outDir, 'widths.txt'), `${name}: page width ${wide}px (screen ${W})\n`);
  }
  } catch (e) { fs.appendFileSync(path.join(outDir, 'error.txt'), String(e.stack)); }
  app.quit();
});
