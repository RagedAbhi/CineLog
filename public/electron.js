const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron');
Menu.setApplicationMenu(null);
// Lazy loaded modules
let autoUpdater;

// Enable Hardware Acceleration and HEVC decoding
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

const path = require('path');
const isDev = !app.isPackaged;

// Torrent server will be lazy loaded in whenReady to avoid blocking startup

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
  // Inject CORS headers only for non-API requests (subtitle files, CDN resources).
  // Must NOT modify Render API responses — if the backend sends
  // Access-Control-Allow-Credentials: true, Chrome rejects responses with origin *,
  // which causes every API call (including login) to fail with "network error".
  const { session } = require('electron');
  const API_HOST = 'cuerates.onrender.com';
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...(details.responseHeaders || {}) };
    
    // Normalize header keys for checking (case-insensitive)
    const lowerHeaders = Object.keys(headers).reduce((acc, key) => {
      acc[key.toLowerCase()] = key;
      return acc;
    }, {});

    // If it's the Render API or our local Torrent server, we trust their own CORS settings
    if (details.url.includes(API_HOST) || details.url.includes('127.0.0.1') || details.url.includes('localhost')) {
      return callback({ responseHeaders: headers });
    }

    // For other external resources (subtitle CDNs, etc.), ensure CORS is enabled
    // Only set if not already present or if it needs to be *
    const originKey = lowerHeaders['access-control-allow-origin'];
    if (!originKey) {
      headers['access-control-allow-origin'] = ['*'];
    }

    const allowHeadersKey = lowerHeaders['access-control-allow-headers'];
    if (!allowHeadersKey) {
      headers['access-control-allow-headers'] = ['*'];
    }

    callback({ responseHeaders: headers });
  });

  // Start local torrent server asynchronously to not block UI thread
  setTimeout(() => {
    require('./torrent-server');
    console.log('[Electron] Torrent server initiated');
  }, 100);

  createWindow();

  if (!isDev) {
    setTimeout(() => {
      autoUpdater = require('electron-updater').autoUpdater;
      autoUpdater.checkForUpdatesAndNotify();
    }, 5000);
  }

  // Detect installed media players after window is shown (non-blocking)
  setTimeout(detectMediaPlayers, 500);

  // ── IPC Handlers ───────────────────────────────────────────────────────────
  ipcMain.handle('get-media-players', async () => {
    console.log('[IPC] get-media-players invoked');
    return availablePlayers;
  });

  ipcMain.on('launch-with-player', (event, playerPath, url) => {
    if (!playerPath || !url) return;
    const { execFile } = require('child_process');
    execFile(playerPath, [url], { detached: true }, (err) => {
      if (err) console.error('[Players] Launch failed:', err.message);
    });
    console.log('[Players] Launched', playerPath, 'with stream URL');
  });

  ipcMain.on('open-external', (event, url, title) => {
    if (!url) return;

    if (url.includes('127.0.0.1:5001')) {
      const fs = require('fs');
      const os = require('os');
      const { spawn, execFile } = require('child_process');

      const launchVLC = (vlcExe) => {
        console.log('[Electron] Launching VLC at:', vlcExe);
        const child = spawn(vlcExe, [url], { detached: true, stdio: 'ignore' });
        child.on('error', (err) => {
          console.error('[Electron] VLC spawn failed:', err.message);
          // If VLC was found but failed to launch, open with system default
          shell.openExternal(url);
        });
        child.unref();
      };

      // VLC confirmed at this path from registry — check it first
      const knownPath = 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe';
      try {
        if (fs.existsSync(knownPath)) { launchVLC(knownPath); return; }
      } catch {}

      // Also check env-var paths for non-English Windows installs
      const pf  = (process.env.PROGRAMFILES        || '').trim();
      const pfx = (process.env['PROGRAMFILES(X86)'] || '').trim();
      const loc = (process.env.LOCALAPPDATA         || '').trim();
      const candidates = [
        pf  && path.join(pf,  'VideoLAN', 'VLC', 'vlc.exe'),
        pfx && path.join(pfx, 'VideoLAN', 'VLC', 'vlc.exe'),
        loc && path.join(loc, 'Programs', 'VideoLAN', 'VLC', 'vlc.exe'),
      ].filter(Boolean);
      const found = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
      if (found) { launchVLC(found); return; }

      // Try `where vlc.exe` (searches PATH)
      execFile('where', ['vlc.exe'], { windowsHide: true }, (err, stdout) => {
        if (!err && stdout.trim()) {
          const p = stdout.trim().split(/\r?\n/)[0].trim();
          if (p) { launchVLC(p); return; }
        }
        // Try HKCR file-association — extract path from quoted value like
        // "C:\Program Files\VideoLAN\VLC\vlc.exe" --started-from-file "%1"
        execFile('reg', ['query', 'HKCR\\Applications\\vlc.exe\\shell\\Open\\command'],
          { windowsHide: true }, (err2, regOut) => {
          console.log('[VLC] HKCR query result:', err2?.message || regOut?.substring(0, 150));
          // Match quoted path: "C:\...\vlc.exe"
          const m = regOut && regOut.match(/"([^"]+vlc\.exe)"/i);
          if (!err2 && m) {
            const vlcPath = m[1].trim();
            try {
              if (fs.existsSync(vlcPath)) { launchVLC(vlcPath); return; }
            } catch {}
          }
          // All detection failed — open with system default player via .m3u
          const tmpPath = path.join(os.tmpdir(), 'cinelog-stream.m3u');
          const m3u = `#EXTM3U\n#EXTINF:-1,${title || 'CineLog Stream'}\n${url}\n`;
          try { fs.writeFileSync(tmpPath, m3u, 'utf8'); shell.openPath(tmpPath); }
          catch { shell.openExternal(url); }
        });
      });
    } else {
      shell.openExternal(url);
    }
  });

  console.log('[IPC] Registered handlers');
});

app.on('window-all-closed', () => app.quit());

// ── Media player detection ────────────────────────────────────────────────────
let availablePlayers = [];

function detectMediaPlayers() {
  const fs = require('fs');
  const pf  = (process.env.PROGRAMFILES         || 'C:\\Program Files').trim();
  const pfx = (process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)').trim();
  const loc = (process.env.LOCALAPPDATA          || '').trim();

  const candidates = [
    { name: 'VLC', paths: [
      path.join(pf,  'VideoLAN', 'VLC', 'vlc.exe'),
      path.join(pfx, 'VideoLAN', 'VLC', 'vlc.exe'),
      loc && path.join(loc, 'Programs', 'VideoLAN', 'VLC', 'vlc.exe'),
    ]},
    { name: 'MPC-HC', paths: [
      path.join(pf,  'MPC-HC', 'mpc-hc64.exe'),
      path.join(pfx, 'MPC-HC', 'mpc-hc64.exe'),
      path.join(pfx, 'K-Lite Codec Pack', 'MPC-HC64', 'mpc-hc64.exe'),
    ]},
    { name: 'PotPlayer', paths: [
      path.join(pf,  'DAUM', 'PotPlayer', 'PotPlayerMini64.exe'),
      path.join(pfx, 'DAUM', 'PotPlayer', 'PotPlayerMini64.exe'),
      path.join(pf,  'PotPlayer', 'PotPlayerMini64.exe'),
    ]},
    { name: 'MPV', paths: [
      path.join(pf,  'mpv', 'mpv.exe'),
      path.join(pfx, 'mpv', 'mpv.exe'),
    ]},
    { name: 'Windows Media Player', paths: [
      path.join(pf,  'Windows Media Player', 'wmplayer.exe'),
      'C:\\Program Files\\Windows Media Player\\wmplayer.exe',
    ]},
  ];

  availablePlayers = [];
  for (const { name, paths } of candidates) {
    const found = paths.filter(Boolean).find(p => { try { return fs.existsSync(p); } catch { return false; } });
    if (found) {
      availablePlayers.push({ name, path: found });
      console.log('[Players] Found:', name, '→', found);
    }
  }
  console.log('[Players] Detected', availablePlayers.length, 'media player(s)');
}
