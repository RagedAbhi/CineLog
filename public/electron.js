const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron');
Menu.setApplicationMenu(null);
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { exec } = require('child_process');

// Enable Hardware Acceleration and HEVC decoding
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

const isDev = !app.isPackaged;

// Start local torrent server (binds to 127.0.0.1 only)
require('./torrent-server');

// Silence non-fatal streaming errors that cause annoying popups
process.on('uncaughtException', (err) => {
  const msg = err.message || '';
  if (msg.includes('Writable stream closed prematurely') || msg.includes('ERR_STREAM_PREMATURE_CLOSE')) {
    return; // Ignore
  }
  console.error('Uncaught Exception:', err);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b091c',
    show: false,
    title: 'CineLog',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    const port = process.env.PORT || 3006;
    win.loadURL(`http://localhost:${port}`);
    win.webContents.openDevTools();
  } else {
    // In production __dirname = build/ inside the ASAR — index.html is right here
    win.loadFile(path.join(__dirname, 'index.html'));
  }

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

ipcMain.on('open-external', (event, url) => {
  if (url) {
    // If it's our local torrent server, try to open in VLC first
    if (url.includes('127.0.0.1:5001')) {
      const vlcPath = '"C:\\Program Files\\VideoLAN\\VLC\\vlc.exe"';
      const vlcPathX86 = '"C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe"';
      
      // Try 64-bit VLC, then 32-bit, then fallback to default browser
      exec(`${vlcPath} "${url}"`, (err) => {
        if (err) {
          exec(`${vlcPathX86} "${url}"`, (err2) => {
            if (err2) {
              shell.openExternal(url); // Fallback to browser if VLC isn't found
            }
          });
        }
      });
    } else {
      shell.openExternal(url);
    }
  }
});

app.on('window-all-closed', () => app.quit());
