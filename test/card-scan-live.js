// Live check of the card scanner on the real screen: shows a fake card tooltip next to the mouse for a moment,
// runs card-scan.js like the hotkey does and prints what it found. It draws on the screen — run it when that's fine.
// Run: electron test/card-scan-live.js   (RQC_CARD_DEBUG=1 also saves the capture to %TEMP%\rqc-card-scan.png)
'use strict';
const { app, BrowserWindow, screen } = require('electron');
const cardScan = require('../card-scan');

const NAME = process.env.CARD || 'Карта Королевы Крыс';
app.whenReady().then(async () => {
  const p = screen.getCursorScreenPoint();
  const win = new BrowserWindow({ x: p.x + 16, y: p.y + 12, width: 320, height: 110, frame: false, alwaysOnTop: true, focusable: false, skipTaskbar: true, show: false });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<body style="margin:0;background:#0b0b0f;color:#ddd;font:12px Tahoma;padding:8px;border:1px solid #777;box-sizing:border-box;height:110px">
    <div style="color:#c07cff;font-weight:bold">${NAME}</div><div>Карта босса</div><div style="color:#7f7">+3% к Силе критического урона</div><div>Требуемый уровень: 50</div></body>`));
  win.showInactive();
  await new Promise(r => setTimeout(r, 300));
  const t0 = Date.now();
  const first = await cardScan.scan(); // includes starting the OCR helper
  const t1 = Date.now();
  const second = await cardScan.scan(); // the helper is warm now
  console.log(JSON.stringify({ first, firstMs: t1 - t0, second, secondMs: Date.now() - t1 }));
  win.destroy();
  cardScan.stop();
  app.quit();
});
