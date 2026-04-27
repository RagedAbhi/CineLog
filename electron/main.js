const { app, BrowserWindow, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

const isDev = !app.isPackaged;

// Start local torrent server (binds to 127.0.0.1 only)
require('./torrent-server');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b091c',
    show: false,
    title: 'CineLog',
    icon: path.join(__dirname, '../src/assets/cueratesLogo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // Matches the PORT=3006 defined in your .env file
    const port = process.env.PORT || 3006;
    win.loadURL(`http://localhost:${port}`);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // Open all target="_blank" links in the system browser, not Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  createWindow();
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => app.quit());
