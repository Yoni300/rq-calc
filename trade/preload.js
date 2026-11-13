// «Обмен» panel ↔ trade/index.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('trade', {
  onPanel: cb => ipcRenderer.on('trade:panel', (_e, s) => cb(s)),
  dragStart: () => ipcRenderer.send('trade:drag-start'),
  drag: (dx, dy) => ipcRenderer.send('trade:drag', dx, dy),
  dragEnd: () => ipcRenderer.send('trade:drag-end'),
  hide: () => ipcRenderer.send('trade:hide'),
  focus: () => ipcRenderer.send('trade:focus'),
  known: q => ipcRenderer.invoke('trade:known', q),
  price: p => ipcRenderer.send('trade:price', p),
  link: (read, name) => ipcRenderer.send('trade:link', read, name),
  signs: s => ipcRenderer.send('trade:signs', s),
});
