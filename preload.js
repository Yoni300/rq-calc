// Small bridge for the page: updates and the boss alert window.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rqcApp', {
  onUpdate: cb => ipcRenderer.on('rqc-update', (_e, state) => cb(state)),
  updateState: () => ipcRenderer.invoke('rqc-update-state'),
  installUpdate: () => ipcRenderer.send('rqc-install-update'),
  version: () => ipcRenderer.invoke('rqc-app-version'),
  // boss timer: a message in the screen corner, above all windows (main.js → app/alert.html)
  bossAlert: a => ipcRenderer.send('rqc-boss-alert', a),
  onOpenBosses: cb => ipcRenderer.on('rqc-open-bosses', () => cb()),
});

// used only by app/alert.html (the corner window)
contextBridge.exposeInMainWorld('rqcAlert', {
  onAlert: cb => ipcRenderer.on('rqc-alert-show', (_e, a) => cb(a)),
  size: (w, h) => ipcRenderer.send('rqc-alert-size', w, h),
  open: () => ipcRenderer.send('rqc-alert-open'),
});
