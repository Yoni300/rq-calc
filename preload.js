// Small bridge for the page: updates and the boss alert window.
const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('rqcApp', {
  onUpdate: cb => ipcRenderer.on('rqc-update', (_e, state) => cb(state)),
  updateState: () => ipcRenderer.invoke('rqc-update-state'),
  installUpdate: () => ipcRenderer.send('rqc-install-update'),
  version: () => ipcRenderer.invoke('rqc-app-version'),
  // boss timer: a message in the screen corner, above all windows (main.js → app/alert.html)
  bossAlert: a => ipcRenderer.send('rqc-boss-alert', a),
  onOpenBosses: cb => ipcRenderer.on('rqc-open-bosses', () => cb()),
  // settings only the app has: tray, start with Windows
  appSettings: s => ipcRenderer.send('rqc-app-settings', s),
  // interface scale: the window's own zoom (like Ctrl+ in a browser), so mouse coordinates, 100vh and @media stay right
  setZoom: f => webFrame.setZoomFactor(f),
  // card scanner: { enabled, hotkey } → main.js; results of the hotkey and whether the hotkey could be taken
  cardSettings: s => ipcRenderer.send('rqc-card-settings', s),
  onCardResult: cb => ipcRenderer.on('rqc-card-result', (_e, r) => cb(r)),
  onCardStatus: cb => ipcRenderer.on('rqc-card-status', (_e, st) => cb(st)),
  // installing the Russian text recognition: { state: 'start' | 'ok' | 'cancel' | 'fail', reason }
  onCardOcr: cb => ipcRenderer.on('rqc-card-ocr', (_e, st) => cb(st)),
  // the buttons of the card scanner's total message: 'card-total-undo' | 'card-total-reset'
  onCardAction: cb => ipcRenderer.on('rqc-card-action', (_e, id) => cb(id)),
  copyText: text => ipcRenderer.send('rqc-copy-text', text),
  // RQ Stats overlay: { on, lang, action } → main.js; its state back ({ on, hasRegion, keys })
  stats: cmd => ipcRenderer.send('rqc-stats', cmd),
  // «Обмен» (trade/): { on, lang, signs, price, link, action } → main.js; its state back
  trade: cmd => ipcRenderer.send('rqc-trade', cmd),
  onTrade: cb => ipcRenderer.on('rqc-trade-state', (_e, st) => cb(st)),
  tradeKnown: q => ipcRenderer.invoke('rqc-trade-known', q),
  tradeHistory: f => ipcRenderer.invoke('rqc-trade-history', f),
  tradeDelete: id => ipcRenderer.invoke('rqc-trade-delete', id),
  onStats: cb => ipcRenderer.on('rqc-stats-state', (_e, st) => cb(st)), // the clipboard (works while the game has the focus)
  // server status: the first call starts asking Steam + the game every minute; each answer comes to onServer
  server: () => ipcRenderer.invoke('rqc-server'),
  onServer: cb => ipcRenderer.on('rqc-server', (_e, st) => cb(st)),
});

// used only by app/alert.html (the corner window)
contextBridge.exposeInMainWorld('rqcAlert', {
  onAlert: cb => ipcRenderer.on('rqc-alert-show', (_e, a) => cb(a)),
  size: (w, h) => ipcRenderer.send('rqc-alert-size', w, h),
  open: () => ipcRenderer.send('rqc-alert-open'),
  action: id => ipcRenderer.send('rqc-alert-action', id), // a button inside a message
});
