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
        // 1. Get user's installed addons from our backend
        const { installedAddons } = await getInstalledAddons();
        if (!installedAddons || installedAddons.length === 0) {
            return { streams: [], noAddons: true };
        }

        // 2. Ensure we have an IMDB ID (Torrentio needs it)
        let finalImdbId = imdbId;
        if (!finalImdbId && tmdbId) {
            const tmdbType = type === 'series' ? 'tv' : 'movie';
            const tmdbKey = process.env.REACT_APP_TMDB_API_KEY;
            const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/external_ids`, {
                params: { api_key: tmdbKey }
            });
            finalImdbId = tmdbRes.data.imdb_id;
        }

        if (!finalImdbId) {
            throw new Error('Could not resolve IMDB ID for this title.');
        }

        // 3. Fetch streams from each addon DIRECTLY in the browser
        const streamPath = (type === 'series' && season && episode)
            ? `/stream/series/${finalImdbId}:${season}:${episode}.json`
            : `/stream/movie/${finalImdbId}.json`;

        const promises = installedAddons.map(async (addon) => {
            try {
                // Normalize URL to prevent double slashes
                const base = addon.baseUrl.replace(/\/$/, '');
                const url = `${base}${streamPath}`;
                const res = await axios.get(url, { timeout: 15000 });
                const streams = res.data?.streams || [];
                return streams.map(s => ({
                    ...s,
                    addonName: addon.name,
                    addonId: addon.id,
                }));
            } catch (err) {
                console.error(`Failed to fetch streams from ${addon.name}:`, err.message);
                return [];
            }
        });

        const results = await Promise.all(promises);
        const allStreams = results.flat();

        return { streams: allStreams, imdbId: finalImdbId };
    } catch (error) {
        console.error('Error fetching streams client-side:', error);
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
