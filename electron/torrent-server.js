// Self-contained local torrent streaming server.
// Binds to 127.0.0.1 only — not accessible from outside the machine.
// No auth needed: localhost-only access is the security boundary.

const express = require('express');
const path = require('path');
const os = require('os');

const PORT = 5001;
const app = express();

let WebTorrent;
try {
  WebTorrent = require('webtorrent');
} catch (e) {
  console.error('[Torrent] WebTorrent not available:', e.message);
}

let client = null;

function getClient() {
  if (!client && WebTorrent) {
    client = new WebTorrent();
    client.on('error', (err) => console.error('[Torrent] Client error:', err.message));
  }
  return client;
}

const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|mov|webm|ts|m4v|wmv|flv)$/i;

// Allow requests from file:// and localhost origins (Electron renderer)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/torrent/stream', async (req, res) => {
  if (!WebTorrent) {
    return res.status(503).json({ error: 'WebTorrent not available in this build' });
  }

  const { magnet, infoHash, fileIdx } = req.query;
  if (!magnet && !infoHash) {
    return res.status(400).json({ error: 'magnet or infoHash query param required' });
  }

  const magnetURI = magnet || `magnet:?xt=urn:btih:${infoHash}`;
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
    }

    const requestedIdx = parseInt(fileIdx);
    let file;

    if (!isNaN(requestedIdx) && torrent.files[requestedIdx]) {
      file = torrent.files[requestedIdx];
    } else {
      const videoFiles = torrent.files.filter((f) => VIDEO_EXTENSIONS.test(f.name));
      file = videoFiles.sort((a, b) => b.length - a.length)[0] || torrent.files[0];
    }

    if (!file) {
      return res.status(404).json({ error: 'No suitable video file found in torrent' });
    }

    const fileSize = file.length;
    const mimeType = file.name.endsWith('.mkv') ? 'video/x-matroska'
      : file.name.endsWith('.webm') ? 'video/webm'
      : 'video/mp4';

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : Math.min(start + 10 * 1024 * 1024, fileSize - 1);
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      });
      file.createReadStream({ start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      file.createReadStream().pipe(res);
    }
  } catch (err) {
    console.error('[Torrent] Stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Failed to stream torrent' });
    }
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[CineLog] Torrent server running on http://127.0.0.1:${PORT}`);
});
