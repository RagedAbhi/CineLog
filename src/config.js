const API_URL = process.env.REACT_APP_API_URL || 'https://cuerates.onrender.com';

// window.__ELECTRON__ is injected by electron/preload.js at runtime.
// In a regular browser it is undefined, so IS_ELECTRON is false.
const IS_ELECTRON = (typeof window !== 'undefined' && !!window.__ELECTRON__?.isElectron) || 
                     (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes(' electron/'));
const TORRENT_PORT = typeof window !== 'undefined' ? (window.__ELECTRON__?.torrentPort ?? 5001) : 5001;
const TORRENT_SERVER_URL = IS_ELECTRON ? `http://127.0.0.1:${TORRENT_PORT}` : null;

export default {
    API_URL,
    BASE_API_URL: `${API_URL}/api`,
    SOCKET_URL: API_URL,
    IS_ELECTRON,
    TORRENT_SERVER_URL,
    DESKTOP_APP_URL: 'https://github.com/RagedAbhi/CineLog/releases/download/v1.0.0/CineLog.1.0.0.exe',
};
