const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__ELECTRON__', {
  isElectron: true,
  torrentPort: 5001,
  openExternal: (url) => ipcRenderer.send('open-external', url)
});
