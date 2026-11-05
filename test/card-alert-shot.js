// Pictures of the card scanner: its block in the settings and the corner alerts it makes (found with a price,
// found without a price, not found). Run: SHOT_DIR=<dir> electron test/card-alert-shot.js → settings.png, alert.png
'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const outDir = process.env.SHOT_DIR;
const root = path.join(__dirname, '..');
app.setPath('userData', path.join(outDir, 'profile'));
app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const alerts = [];
  ipcMain.on('rqc-boss-alert', (_e, a) => alerts.push(a));
  ipcMain.on('rqc-app-settings', () => {});
  ipcMain.on('rqc-card-settings', () => {});
  ipcMain.handle('rqc-update-state', () => ({}));
  const win = new BrowserWindow({ width: 1300, height: 900, webPreferences: { preload: path.join(root, 'preload.js') } });
  await win.loadFile(path.join(root, 'app', 'index.html'));
  await win.webContents.executeJavaScript(`
    document.querySelector('.upd.site')?.remove();
    lang = 'ru'; T = RQC_I18N.ru; renderAll();
    SETTINGS.cardScan = true; SETTINGS.cardServer = 'fenix'; SETTINGS.cardPrice_fenix = 55000; saveSettings();
    openSettings(); const b = document.querySelector('.set-body'); b.scrollTop = b.scrollHeight;
    cardShowResult({ ok: true, name: 'Карта Воко', signs: 190 });
    SETTINGS.cardPrice_fenix = 0; cardShowResult({ ok: true, name: 'Карта Королевы Крыс', signs: 150 }); SETTINGS.cardPrice_fenix = 55000;
    cardShowResult({ ok: false, reason: 'none' });
  `);
  await new Promise(r => setTimeout(r, 600));
  fs.writeFileSync(path.join(outDir, 'settings.png'), (await win.webContents.capturePage()).toPNG());

  const aw = new BrowserWindow({ width: 380, height: 360, backgroundColor: '#3a3f44', webPreferences: { preload: path.join(root, 'preload.js') } });
  await aw.loadFile(path.join(root, 'app', 'alert.html'));
  alerts.forEach((a, i) => aw.webContents.send('rqc-alert-show', { ...a, key: 'card' + i })); // the app replaces one with the next; here all three
  await new Promise(r => setTimeout(r, 900));
  fs.writeFileSync(path.join(outDir, 'alert.png'), (await aw.webContents.capturePage()).toPNG());
  console.log(JSON.stringify(alerts.map(a => [a.title, a.big, a.sub])));
  app.quit();
});
