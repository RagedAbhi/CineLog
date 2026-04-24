const path = require('path');
const os = require('os');
const logger = require('../utils/logger');

let WebTorrent;
try {
    WebTorrent = require('webtorrent');
} catch (e) {
    logger.warn('WebTorrent not installed. Torrent streaming will be unavailable. Run: cd server && npm install webtorrent');
}

let client = null;

function getClient() {
    if (!client && WebTorrent) {
        client = new WebTorrent();
        client.on('error', (err) => logger.error('WebTorrent client error:', err.message));
    }
    return client;
}

const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|mov|webm|ts|m4v|wmv|flv)$/i;

exports.streamTorrent = async (req, res) => {
    if (!WebTorrent) {
        return res.status(503).json({
            error: 'Torrent streaming is not available. Install webtorrent: cd server && npm install webtorrent',
        });
    }

    const { magnet, infoHash, fileIdx } = req.query;

    if (!magnet && !infoHash) {
        return res.status(400).json({ error: 'magnet or infoHash query param required' });
    }

    const magnetURI = magnet || `magnet:?xt=urn:btih:${infoHash}`;
    const downloadPath = path.join(os.tmpdir(), 'cinelog-torrents');

    try {
        const wt = getClient();

        // Reuse existing torrent if already added
        const existingHash = infoHash ||
            (magnet && (magnet.match(/btih:([a-fA-F0-9]{40})/i)?.[1] || magnet.match(/btih:([a-zA-Z2-7]{32})/i)?.[1]));
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
            // Pick largest video file
            const videoFiles = torrent.files.filter(f => VIDEO_EXTENSIONS.test(f.name));
            file = videoFiles.sort((a, b) => b.length - a.length)[0] || torrent.files[0];
        }

        if (!file) {
            return res.status(404).json({ error: 'No suitable video file found in torrent' });
        }

        const fileSize = file.length;
        const mimeType = file.name.endsWith('.mkv') ? 'video/x-matroska' :
            file.name.endsWith('.webm') ? 'video/webm' : 'video/mp4';

        const rangeHeader = req.headers.range;

        if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 10 * 1024 * 1024, fileSize - 1);
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
        logger.error('Torrent stream error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'Failed to stream torrent' });
        }
    }
};
