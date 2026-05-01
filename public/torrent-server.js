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
      maxConnections: 2000, // Double the limits for difficult swarms
      upnp: true,
      torrentPort: Math.floor(Math.random() * (65535 - 49152) + 49152),
      dht: true,
      tracker: {
        getAnnounceOpts: () => ({ numwant: 100 }) // Request 100 peers instead of 20
      },
      lsd: true,
      webSeeds: true,
      utp: true // Enable uTP for better firewall penetration
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

  // HTTP video proxy — forwards requests to Torrentio Quick Play URLs with custom headers
  // Needed because <video> cannot send custom headers (e.g. behaviorHints.proxyHeaders)
  if (url.pathname === '/api/http-proxy') {
    const targetUrl = url.searchParams.get('url');
    const headersParam = url.searchParams.get('headers');

    if (!targetUrl) return sendJSON(res, 400, { error: 'url param required' });

    const https = require('https');
    const httpModule = require('http');

    let extraHeaders = {};
    if (headersParam) {
      try { extraHeaders = JSON.parse(headersParam); } catch (e) {}
    }

    try {
      const parsed = new URL(targetUrl);
      const protocol = parsed.protocol === 'https:' ? https : httpModule;

      const reqHeaders = {
        ...extraHeaders,
        'Accept-Encoding': 'identity', // Prevent compression so Range works correctly
      };
      if (req.headers.range) reqHeaders['Range'] = req.headers.range;

      const proxyReq = protocol.request({
        method: 'GET',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: reqHeaders,
      }, (proxyRes) => {
        const fwd = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
        };
        if (proxyRes.headers['content-length'])  fwd['Content-Length']  = proxyRes.headers['content-length'];
        if (proxyRes.headers['content-range'])   fwd['Content-Range']   = proxyRes.headers['content-range'];
        if (proxyRes.headers['accept-ranges'])   fwd['Accept-Ranges']   = proxyRes.headers['accept-ranges'];
        if (proxyRes.headers['cache-control'])   fwd['Cache-Control']   = proxyRes.headers['cache-control'];

        res.writeHead(proxyRes.statusCode, fwd);
        proxyRes.pipe(res);
        req.on('close', () => proxyRes.destroy());
      });

      proxyReq.setTimeout(30000, () => {
        proxyReq.destroy();
        if (!res.headersSent) sendJSON(res, 504, { error: 'Proxy request timeout' });
      });
      proxyReq.on('error', (err) => {
        if (!res.headersSent) sendJSON(res, 502, { error: err.message });
      });
      proxyReq.end();
    } catch (err) {
      sendJSON(res, 400, { error: `Invalid URL: ${err.message}` });
    }
    return;
  }

  // Subtitle CORS proxy — fetches external subtitle files and returns them with CORS headers
  // Needed because Electron's renderer process cannot fetch cross-origin URLs directly.
  // Follows redirects server-side — critical because OpenSubtitles URLs are 302 redirects to CDN.
  if (url.pathname === '/api/subtitle/proxy') {
    const subtitleUrl = url.searchParams.get('url');
    if (!subtitleUrl) return sendJSON(res, 400, { error: 'url param required' });

    const https = require('https');
    const httpModule = require('http');

    const fetchWithRedirects = (targetUrl, hops = 0) => {
      if (hops > 5) return sendJSON(res, 502, { error: 'Too many redirects' });
      try {
        const parsed = new URL(targetUrl);
        const protocol = parsed.protocol === 'https:' ? https : httpModule;

        const proxyReq = protocol.get(targetUrl, (proxyRes) => {
          // Follow redirects server-side so the renderer never sees a cross-origin redirect
          if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode)) {
            const location = proxyRes.headers.location;
            proxyRes.destroy();
            if (!location) return sendJSON(res, 502, { error: 'Redirect with no Location header' });
            const next = location.startsWith('http') ? location : new URL(location, targetUrl).toString();
            return fetchWithRedirects(next, hops + 1);
          }

          res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          });
          proxyRes.pipe(res);
        });

        proxyReq.setTimeout(15000, () => {
          proxyReq.destroy();
          if (!res.headersSent) sendJSON(res, 504, { error: 'Subtitle fetch timeout' });
        });
        proxyReq.on('error', (err) => {
          if (!res.headersSent) sendJSON(res, 500, { error: err.message });
        });
      } catch (err) {
        if (!res.headersSent) sendJSON(res, 400, { error: 'Invalid URL: ' + err.message });
      }
    };

    fetchWithRedirects(subtitleUrl);
    return;
  }

  // New Status API for frontend feedback
  if (url.pathname === '/api/torrent/status') {
    const hash = url.searchParams.get('infoHash');
    const t = client?.get(hash);
    if (!t) return sendJSON(res, 404, { error: 'Not found' });
    
    return sendJSON(res, 200, {
      numPeers: t.numPeers,
      downloadSpeed: t.downloadSpeed,
      progress: t.progress,
      ready: t.ready,
      paused: t.paused
    });
  }

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
  // Massive, curated tracker list for maximum peer discovery on difficult swarms
  const DEFAULT_TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://open.stealth.si:80/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://tracker.tiny-vps.com:6969/announce',
    'udp://tracker.moeking.me:6969/announce',
    'udp://tracker.bitsearch.to:1337/announce',
    'udp://62.138.0.158:6969/announce',
    'udp://93.158.213.92:1337/announce',
    'udp://185.19.105.234:2710/announce',
    'udp://188.165.141.139:6969/announce',
    'udp://157.230.134.195:1337/announce',
    'udp://9.rarbg.me:2970/announce',
    'udp://p4p.arenabg.com:1337/announce',
    'udp://tracker.leechers-paradise.org:6969/announce',
    'udp://explodie.org:6969/announce',
    'udp://ipv4.tracker.harry.lu:80/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://tracker.cyberia.is:6969/announce',
    'udp://tracker.port443.xyz:6969/announce',
    'udp://vibe.community:6969/announce',
    'udp://movies.zsw.ca:6969/announce',
    'udp://tracker.filemail.com:6969/announce',
    'udp://tracker0.ufaball.xyz:6969/announce',
    'udp://tracker.birkenwald.de:6969/announce',
    'udp://tracker.auctor.tv:6969/announce',
    'udp://tk.greedland.net:80/announce',
    'udp://tracker.dutchtracking.com:6969/announce',
    'udp://tracker.skyts.net:6969/announce',
    'udp://tracker.shasof.fun:6969/announce',
    'udp://tracker.srv00.com:6969/announce',
    'udp://tracker.lilithraws.org:6969/announce',
    'udp://tracker.army:6969/announce',
    'udp://tracker.monitorit4.me:6969/announce',
    'udp://tracker.bt4g.com:2095/announce',
    'http://tracker.files.fm:6969/announce',
    'http://tracker.mywaifu.best:6969/announce',
    'http://vps02.net.orel.ru:80/announce',
    'https://tracker.nanoha.org:443/announce',
    'https://tracker.lilithraws.org:443/announce',
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.btorrent.xyz',
    'wss://tracker.files.fm:7073/announce',
  ];

  let magnetURI = magnet || `magnet:?xt=urn:btih:${infoHash}`;

  // Parse Torrentio sources — split tracker URLs and DHT nodes
  const parsedSources = sourcesParam ? sourcesParam.split(',') : [];

  const extraTrackers = parsedSources
    .map(s => s.startsWith('tracker:') ? s.slice('tracker:'.length) : s)
    .filter(s => s.startsWith('http') || s.startsWith('udp') || s.startsWith('ws'));

  // DHT node addresses from Torrentio — these are nodes that already know this torrent's swarm.
  // Injecting them before wt.add() bypasses cold DHT bootstrap (60-120s → seconds).
  const dhtNodes = parsedSources
    .filter(s => s.startsWith('dht:'))
    .map(s => {
      const addr = s.slice('dht:'.length);
      const lastColon = addr.lastIndexOf(':');
      return lastColon !== -1
        ? { host: addr.slice(0, lastColon), port: parseInt(addr.slice(lastColon + 1)) }
        : null;
    })
    .filter(Boolean);

  const wt = getClient();

  // Inject DHT nodes BEFORE adding the torrent so discovery starts from a warm state
  if (dhtNodes.length > 0 && wt.dht) {
    dhtNodes.forEach(node => {
      try { wt.dht.addNode(node); } catch (e) { /* ignore if dht not ready */ }
    });
    console.log('[Torrent] Injected', dhtNodes.length, 'DHT nodes for fast peer discovery');
  }

  const allTrackers = [...new Set([...extraTrackers, ...DEFAULT_TRACKERS])];
  allTrackers.forEach(tr => {
    const trParam = `tr=${encodeURIComponent(tr)}`;
    if (!magnetURI.includes(trParam)) {
      magnetURI += (magnetURI.includes('?') ? '&' : '?') + trParam;
    }
  });

  console.log('[Torrent] Adding torrent | infoHash:', infoHash, '| trackers:', allTrackers.length, '| DHT nodes:', dhtNodes.length);
  const downloadPath = path.join(os.tmpdir(), 'cinelog-torrents');

  try {
    const existingHash = infoHash ||
      (magnet && (
        magnet.match(/btih:([a-fA-F0-9]{40})/i)?.[1] ||
        magnet.match(/btih:([a-zA-Z2-7]{32})/i)?.[1]
      ));
    let torrent = existingHash ? wt.get(existingHash) : null;

    if (!torrent) {
      torrent = await new Promise((resolve, reject) => {
        // Passing trackers explicitly in 'announce' option for maximum reliability
        const t = wt.add(magnetURI, { 
          path: downloadPath,
          announce: allTrackers 
        }, (tor) => resolve(tor));
        
        t.on('metadata', () => console.log('[Torrent] Metadata received for:', infoHash));
        t.on('error', (err) => reject(err));
        setTimeout(() => reject(new Error('Torrent metadata timeout after 120s')), 120000);
      });
    } else if (!torrent.ready) {
      torrent = await new Promise((resolve, reject) => {
        torrent.once('ready', () => resolve(torrent));
        torrent.once('metadata', () => console.log('[Torrent] Metadata received for:', infoHash));
        torrent.once('error', reject);
        setTimeout(() => reject(new Error('Torrent metadata timeout after 120s')), 120000);
      });
    }

    console.log('[Torrent] Swarm info: peers =', torrent.numPeers, '| speed =', torrent.downloadSpeed);

    console.log('[Torrent] Files in torrent:', torrent.files.map(f => `${f.name} (${f.length})`));

    const requestedIdx = parseInt(fileIdx);
    const season = req.url.includes('season=') ? new URL(req.url, 'http://localhost').searchParams.get('season') : null;
    const episode = req.url.includes('episode=') ? new URL(req.url, 'http://localhost').searchParams.get('episode') : null;

    let file;

    if (!isNaN(requestedIdx) && torrent.files[requestedIdx]) {
      file = torrent.files[requestedIdx];
    } else if (season && episode) {
      // MEGA-PACK SURGERY: Find the specific episode in a list of thousands
      console.log(`[Torrent] Searching for S${season}E${episode} in ${torrent.files.length} files...`);
      const s = season.padStart(2, '0');
      const e = episode.padStart(2, '0');
      
      // Pattern 1: S01E01 or 1x01 or E01
      const p1 = new RegExp(`s${s}e${e}|${season}x${e}|e${e}`, 'i');
      // Pattern 2: Simple " 01 " or " 1 " (only for smaller packs to avoid false positives)
      const p2 = new RegExp(`\\b${e}\\b|\\b${episode}\\b`);
      
      const matches = torrent.files.filter(f => 
        VIDEO_EXTENSIONS.test(f.name) && 
        (p1.test(f.name) || (torrent.files.length < 50 && p2.test(f.name)))
      );

      // If multiple (e.g. 720p and 1080p in same pack), pick largest/best
      file = matches.sort((a, b) => b.length - a.length)[0];
      
      if (!file) {
        console.log('[Torrent] No exact match, falling back to largest video file');
        const videoFiles = torrent.files.filter((f) => VIDEO_EXTENSIONS.test(f.name));
        file = videoFiles.sort((a, b) => b.length - a.length)[0];
      }
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

    // Deselect other files to focus all bandwidth on the chosen video file
    torrent.files.forEach(f => { if (f !== file) f.deselect(); });
    file.select();
    console.log(`[Torrent] Streaming "${file.name}" (${(file.length / 1e9).toFixed(2)} GB)`);

    // Wait until at least one piece of the file is available before opening the read stream.
    // This prevents the HTTP response from hanging indefinitely when peers are choked.
    // Max wait: 90 seconds. After that, open the stream anyway and let it buffer naturally.
    if (torrent.downloadSpeed === 0) {
      await new Promise((resolve) => {
        const start = Date.now();
        const check = setInterval(() => {
          if (torrent.downloadSpeed > 0 || (Date.now() - start) > 90000) {
            clearInterval(check);
            resolve();
          }
        }, 1000);
        torrent.once('download', () => { clearInterval(check); resolve(); });
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
      // Overdrive: Use tiny 128KB chunk for initial request to start playing instantly.
      // 5MB chunks for all subsequent requests to maintain buffer.
      const defaultChunk = start === 0 ? 128 * 1024 : 5 * 1024 * 1024;
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + defaultChunk, fileSize - 1);
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
  // Pre-bootstrap the DHT network immediately so it's warmed up before the user clicks Watch.
  // Without this, the first torrent add starts DHT from scratch, causing 0-1 peers for 60+ seconds.
  if (WebTorrent) {
    getClient();
    console.log('[CineLog] DHT bootstrap started');
  }
});
