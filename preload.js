// Small bridge for the page: update notifications only.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rqcApp', {
  onUpdate: cb => ipcRenderer.on('rqc-update', (_e, state) => cb(state)),
  updateState: () => ipcRenderer.invoke('rqc-update-state'),
  installUpdate: () => ipcRenderer.send('rqc-install-update'),
  version: () => ipcRenderer.invoke('rqc-app-version'),
});
