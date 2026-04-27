// Local torrent streaming server using only Node.js built-ins + WebTorrent.
// No Express — eliminates the entire express dependency chain from the Electron bundle.

const http = require('http');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const PORT = 5001;

let WebTorrent;
try {
  WebTorrent = require('webtorrent');
} catch (e) {
  console.error('[Torrent] WebTorrent not available:', e.message);
}

let client = null;

function getClient() {
  if (!client && WebTorrent) {
    client = new WebTorrent({
      maxConnections: 100, // Higher limit for faster discovery
      dht: true,
      tracker: true,
    });
    client.on('error', (err) => console.error('[Torrent] Client error:', err.message));
  }
  return client;
}

const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|mov|webm|ts|m4v|wmv|flv)$/i;

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  setCORSHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname !== '/api/torrent/stream') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  if (!WebTorrent) {
    return sendJSON(res, 503, { error: 'WebTorrent not available' });
  }

  const magnet   = url.searchParams.get('magnet');
  const infoHash = url.searchParams.get('infoHash');
  const fileIdx  = url.searchParams.get('fileIdx');
  const sourcesParam = url.searchParams.get('sources');

  if (!magnet && !infoHash) {
    return sendJSON(res, 400, { error: 'magnet or infoHash query param required' });
  }

  // Build magnet URI with trackers for better peer discovery
  const DEFAULT_TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://open.stealth.si:80/announce',
    'http://tracker.openbittorrent.com:80/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://tracker.bitsearch.to:1337/announce',
    'udp://tracker.tiny-vps.com:6969/announce',
    'udp://tracker.0x.tf:6969/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://explodie.org:6969/announce',
    'udp://ipv4.tracker.harry.lu:80/announce',
    'udp://9.rarbg.to:2920/announce',
    'udp://tracker.leechers-paradise.org:6969/announce',
    'udp://tracker.coppersurfer.tk:6969/announce'
  ];

  let magnetURI = magnet || `magnet:?xt=urn:btih:${infoHash}`;

  // Append trackers from Torrentio sources + public fallbacks
  const extraTrackers = sourcesParam
    ? sourcesParam.split(',').filter(s => s.startsWith('tracker:') || s.startsWith('http') || s.startsWith('udp'))
    : [];
  const allTrackers = [...new Set([...extraTrackers, ...DEFAULT_TRACKERS])];
  allTrackers.forEach(tr => {
    const encoded = encodeURIComponent(tr);
    if (!magnetURI.includes(encoded)) magnetURI += `&tr=${encoded}`;
  });

  console.log('[Torrent] Adding torrent with', allTrackers.length, 'trackers | infoHash:', infoHash);
  const downloadPath = path.join(os.tmpdir(), 'cinelog-torrents');

  try {
    const wt = getClient();

    const existingHash = infoHash ||
      (magnet && (
        magnet.match(/btih:([a-fA-F0-9]{40})/i)?.[1] ||
        magnet.match(/btih:([a-zA-Z2-7]{32})/i)?.[1]
      ));
    let torrent = existingHash ? wt.get(existingHash) : null;

    if (!torrent) {
      torrent = await new Promise((resolve, reject) => {
        const t = wt.add(magnetURI, { path: downloadPath }, (tor) => resolve(tor));
        t.on('error', (err) => reject(err));
        setTimeout(() => reject(new Error('Torrent metadata timeout after 45s')), 45000);
      });
    } else if (!torrent.ready) {
      // Torrent exists in client but metadata not yet received — wait for it
      torrent = await new Promise((resolve, reject) => {
        torrent.once('ready', () => resolve(torrent));
        torrent.once('error', reject);
        setTimeout(() => reject(new Error('Torrent metadata timeout after 45s')), 45000);
      });
    }

    console.log('[Torrent] Files in torrent:', torrent.files.map(f => `${f.name} (${f.length})`));

    const requestedIdx = parseInt(fileIdx);
    let file;

    if (!isNaN(requestedIdx) && torrent.files[requestedIdx]) {
      file = torrent.files[requestedIdx];
    } else {
      const videoFiles = torrent.files.filter((f) => VIDEO_EXTENSIONS.test(f.name));
      file = videoFiles.sort((a, b) => b.length - a.length)[0] || torrent.files[0];
    }

    if (!file) {
      return sendJSON(res, 404, {
        error: 'No suitable video file found in torrent',
        files: torrent.files.map(f => ({ name: f.name, size: f.length })),
      });
    }

    const fileSize = file.length;
    const mimeType = file.name.endsWith('.mkv') ? 'video/x-matroska'
      : file.name.endsWith('.webm') ? 'video/webm'
      : 'video/mp4';

    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end   = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 10 * 1024 * 1024, fileSize - 1);
      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': end - start + 1,
        'Content-Type':   mimeType,
      });
      file.createReadStream({ start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type':   mimeType,
        'Accept-Ranges':  'bytes',
      });
      file.createReadStream().pipe(res);
    }
  } catch (err) {
    console.error('[Torrent] Stream error:', err.message);
    if (!res.headersSent) sendJSON(res, 500, { error: err.message, debug: { infoHash, magnetURI: magnetURI?.substring(0, 100) } });
  }
});

// Bind to localhost only — not accessible from outside the machine
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[CineLog] Torrent server running on http://127.0.0.1:${PORT}`);
});
