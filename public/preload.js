const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__ELECTRON__', {
  isElectron: true,
  torrentPort: 5001,
  openExternal: (url, title) => ipcRenderer.send('open-external', url, title),
  getMediaPlayers: () => ipcRenderer.invoke('get-media-players'),
  launchWithPlayer: (playerPath, url) => ipcRenderer.send('launch-with-player', playerPath, url),
});
