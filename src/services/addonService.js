import axios from 'axios';
import config from '../config';

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export const getInstalledAddons = async () => {
    const res = await axios.get(`${config.API_URL}/api/addons`, { headers: auth() });
    return res.data; // { installedAddons, featuredAddons }
};

export const installAddon = async (manifestUrl) => {
    let manifest = null;
    try {
        // Try to fetch manifest in the browser first (uses user's IP, avoids server blocks)
        const browserRes = await axios.get(manifestUrl, { timeout: 8000 });
        if (browserRes.data && browserRes.data.id) {
            manifest = browserRes.data;
        }
    } catch (e) {
        console.warn('Browser-side manifest fetch failed, falling back to server fetch:', e.message);
    }

    const res = await axios.post(
        `${config.API_URL}/api/addons/install`,
        { manifestUrl, manifest },
        { headers: auth() }
    );
    return res.data; // { success, addon }
};

export const uninstallAddon = async (addonId) => {
    const res = await axios.delete(
        `${config.API_URL}/api/addons/${encodeURIComponent(addonId)}`,
        { headers: auth() }
    );
    return res.data;
};

export const fetchStreams = async ({ imdbId, tmdbId, type = 'movie', season, episode }) => {
    try {
        // 1. Resolve IMDB ID via TMDB if missing or invalid (CRITICAL for Torrentio)
        let finalImdbId = imdbId;
        // If imdbId is missing OR is a numeric TMDB ID (doesn't start with 'tt')
        if (!finalImdbId || !String(finalImdbId).startsWith('tt')) {
            const idToUse = finalImdbId || tmdbId;
            if (idToUse) {
                const tmdbType = type === 'series' ? 'tv' : 'movie';
                const tmdbKey = process.env.REACT_APP_TMDB_API_KEY;
                const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${tmdbType}/${idToUse}/external_ids`, {
                    params: { api_key: tmdbKey }
                });
                finalImdbId = tmdbRes.data.imdb_id;
            }
        }

        if (!finalImdbId) {
            throw new Error('IMDB ID required for stream searching.');
        }

        // 2. Try our masked backend proxy first
        const params = { type, imdbId: finalImdbId, tmdbId, season, episode };
        try {
            const res = await axios.get(`${config.API_URL}/api/addons/streams`, {
                headers: auth(),
                params,
                timeout: 15000
            });
            if (res.data?.streams?.length > 0) {
                return res.data;
            }
        } catch (e) {
            console.warn('Backend proxy failed, trying public CORS proxy...', e.message);
        }

        // 3. NUCLEAR OPTION: Public CORS Proxy (AllOrigins)
        // This bypasses both Cloudflare server blocks AND browser CORS
        const { installedAddons } = await getInstalledAddons();
        const streamPath = (type === 'series' && season && episode)
            ? `/stream/series/${finalImdbId}:${season}:${episode}.json`
            : `/stream/movie/${finalImdbId}.json`;

        const promises = (installedAddons || []).map(async (addon) => {
            try {
                const base = addon.baseUrl.replace(/\/$/, '');
                const targetUrl = `${base}${streamPath}`;
                // Using AllOrigins to bypass CORS and Cloudflare
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
                
                const res = await axios.get(proxyUrl);
                const data = JSON.parse(res.data.contents);
                const streams = data?.streams || [];
                
                return streams.map(s => ({
                    ...s,
                    addonName: addon.name,
                    addonId: addon.id,
                }));
            } catch (err) {
                return [];
            }
        });

        const results = await Promise.all(promises);
        const allStreams = results.flat();

        return { streams: allStreams, imdbId: finalImdbId, addons: installedAddons };
    } catch (error) {
        console.error('Triple-layer fetch failed:', error);
        return { streams: [], error: error.message };
    }
};

export const buildTorrentStreamUrl = ({ magnet, infoHash, fileIdx }) => {
    const params = new URLSearchParams();
    if (magnet) params.set('magnet', magnet);
    if (infoHash) params.set('infoHash', infoHash);
    if (fileIdx !== undefined && fileIdx !== null) params.set('fileIdx', String(fileIdx));
    params.set('token', localStorage.getItem('token') || '');
    return `${config.API_URL}/api/torrent/stream?${params.toString()}`;
};

// Parse quality label from stream name/title strings
export const parseStreamQuality = (stream) => {
    const text = `${stream.name || ''} ${stream.title || ''}`.toLowerCase();
    if (text.includes('2160') || text.includes('4k') || text.includes('uhd')) return '4K';
    if (text.includes('1080')) return '1080p';
    if (text.includes('720')) return '720p';
    if (text.includes('480')) return '480p';
    if (text.includes('360')) return '360p';
    return 'Unknown';
};

// Extract seeder count from stream title (e.g. "👤 1234" or "Seeds: 1234")
export const parseSeeders = (stream) => {
    const title = stream.title || stream.name || '';
    const match = title.match(/👤\s*(\d[\d,]*)|seeds?:?\s*(\d[\d,]*)/i);
    if (!match) return null;
    return parseInt((match[1] || match[2]).replace(/,/g, ''), 10);
};
