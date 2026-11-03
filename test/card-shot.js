// Saves the build picture (app/build-card.js) of the current build for each language, plus a shot of its dialog.
// Run: SHOT_DIR=<out-dir> [RQC_USERDATA=<profile with a build>] electron test/card-shot.js
//   → <out-dir>/card-<lang>.png (full size) and dialog.png
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outDir = process.env.SHOT_DIR;
if (process.env.RQC_USERDATA) app.setPath('userData', process.env.RQC_USERDATA);
process.on('uncaughtException', e => { fs.mkdirSync(outDir, { recursive: true }); fs.appendFileSync(path.join(outDir, 'error.txt'), String(e.stack)); app.quit(); });

app.whenReady().then(async () => { try {
  fs.mkdirSync(outDir, { recursive: true });
  const win = new BrowserWindow({ x: 20, y: 20, width: 1400, height: 900, useContentSize: true });
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) console.error('page:', msg); });
  for (const lang of ['ru', 'uk', 'en']) {
    await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
    await win.webContents.executeJavaScript(`document.querySelector('.upd.site')?.remove(); lang='${lang}'; T=RQC_I18N['${lang}']; applyGameLang(); renderAll();`);
    const data = await win.webContents.executeJavaScript('drawBuildCard().then(cv => cv.toDataURL("image/png"))');
    fs.writeFileSync(path.join(outDir, `card-${lang}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  await win.webContents.executeJavaScript('openBuildCard()');
  await new Promise(r => setTimeout(r, 800));
  fs.writeFileSync(path.join(outDir, 'dialog.png'), (await win.webContents.capturePage()).toPNG());
  // CLIP=1: press «Copy picture» and check that the clipboard got the image (overwrites the clipboard)
  if (process.env.CLIP) {
    win.focus();
    await win.webContents.executeJavaScript("document.querySelector('.card-dlg .btn.primary').click()", true);
    await new Promise(r => setTimeout(r, 1500));
    console.log('copied — paste into Paint or Discord to check');
  }
  app.quit();
} catch (e) { fs.appendFileSync(path.join(outDir, 'error.txt'), String(e.stack)); app.quit(); } });
