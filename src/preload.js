// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveClipboard: () => ipcRenderer.invoke('save-clipboard')
});