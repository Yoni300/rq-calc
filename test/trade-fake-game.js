// A window titled «Royal Quest» that shows a drawn trade window (test/trade-fake-page.js), for test/trade-live.js.
// Run: electron test/trade-fake-game.js [case number]
'use strict';
const { app, BrowserWindow } = require('electron');
const { CASES, page } = require('./trade-fake-page');
const k = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a)) || 0);
app.whenReady().then(() => {
  const win = new BrowserWindow({ x: 100, y: 60, width: 1280, height: 860, useContentSize: true, title: 'Royal Quest', show: true });
  win.on('page-title-updated', e => e.preventDefault());
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page(CASES[k])));
});
