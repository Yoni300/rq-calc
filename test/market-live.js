// Live test of the market scanner without the game: shows a market screenshot on the screen and runs
// market-scan.js on the real screen. Run: electron test/market-live.js [page-12.png]   (writes test/market/live.log)
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const img = path.join(__dirname, 'market', process.argv.find(a => /\.png$/.test(a)) || 'page-12.png');
const logFile = path.join(__dirname, 'market', 'live.log');
fs.writeFileSync(logFile, '');
const log = (...a) => fs.appendFileSync(logFile, a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n');

app.whenReady().then(() => {
  const win = new BrowserWindow({ x: 300, y: 150, width: 460, height: 600, frame: false, alwaysOnTop: true, backgroundColor: '#000' });
  win.loadURL('data:text/html,' + encodeURIComponent(`<body style="margin:0;background:#000"><img src="file:///${img.replace(/\\/g, '/')}"></body>`));
  const scan = require('../market-scan');
  const t0 = Date.now();
  scan.start(ev => {
    log(((Date.now() - t0) / 1000).toFixed(1) + 's', ev);
    if (ev.type === 'page') { scan.stop(); setTimeout(() => app.quit(), 300); }
  });
  setTimeout(() => { log('timeout'); scan.stop(); app.quit(); }, 40000);
});
