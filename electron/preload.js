const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('__ELECTRON__', {
  isElectron: true,
  torrentPort: 5001,
});
