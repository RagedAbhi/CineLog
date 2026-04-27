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

// Step 1: ask backend to resolve the IMDB ID + get addon list
export const resolveImdbId = async ({ imdbId, tmdbId, type = 'movie', title, year }) => {
    const res = await axios.get(`${config.API_URL}/api/addons/resolve`, {
        headers: auth(),
        params: { imdbId, tmdbId, type, title, year },
        timeout: 20000,
    });
    return res.data; // { imdbId, addons }
};

// Step 2: call each addon directly from the browser (avoids cloud IP blocking)
export const fetchStreamsFromBrowser = async ({ imdbId, addons, type = 'movie', season, episode }) => {
    if (!imdbId || !addons?.length) return [];

    const streamPath = (type === 'series' && season && episode)
        ? `/stream/series/${imdbId}:${season}:${episode}.json`
        : `/stream/movie/${imdbId}.json`;

    const results = await Promise.allSettled(
        addons.map(async (addon) => {
            const url = `${addon.baseUrl.replace(/\/$/, '')}${streamPath}`;
            const res = await axios.get(url, { timeout: 15000 });
            return (res.data?.streams || []).map(s => ({
                ...s,
                addonName: addon.name,
                addonId: addon.id,
            }));
        })
    );

    return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
};

export const fetchSubtitles = async ({ imdbId, addons, type = 'movie', season, episode }) => {
    if (!imdbId || !addons?.length) return [];

    const subtitlePath = (type === 'series' && season && episode)
        ? `/subtitles/series/${imdbId}:${season}:${episode}.json`
        : `/subtitles/movie/${imdbId}.json`;

    // Try all installed addons, many don't declare resources correctly
    const subAddons = addons;

    const results = await Promise.allSettled(
        subAddons.map(async (addon) => {
            const url = `${addon.baseUrl.replace(/\/$/, '')}${subtitlePath}`;
            const res = await axios.get(url, { timeout: 10000 });
            return (res.data?.subtitles || []).map(s => ({
                ...s,
                addonName: addon.name,
            }));
        })
    );

    return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
};

// Legacy proxy path (kept for fallback)
export const fetchStreams = async ({ imdbId, tmdbId, type = 'movie', season, episode, title, year }) => {
    try {
        const params = { type, imdbId, tmdbId, season, episode, title, year };
        const res = await axios.get(`${config.API_URL}/api/addons/streams`, {
            headers: auth(),
            params,
            timeout: 25000
        });
        return {
            streams: res.data?.streams || [],
            imdbId: res.data?.imdbId,
            addons: res.data?.addons || []
        };
    } catch (error) {
        console.error('Proxy fetch failed:', error);
        return { streams: [], error: error.message };
    }
};

export const buildTorrentStreamUrl = ({ magnet, infoHash, fileIdx, sources = [] }) => {
    const params = new URLSearchParams();
    if (magnet) params.set('magnet', magnet);
    if (infoHash) params.set('infoHash', infoHash);
    if (fileIdx !== undefined && fileIdx !== null) params.set('fileIdx', String(fileIdx));
    if (sources.length > 0) params.set('sources', sources.join(','));

    if (config.IS_ELECTRON) {
        return `${config.TORRENT_SERVER_URL}/api/torrent/stream?${params.toString()}`;
    }
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
