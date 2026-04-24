import axios from 'axios';
import config from '../config';

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export const getInstalledAddons = async () => {
    const res = await axios.get(`${config.API_URL}/api/addons`, { headers: auth() });
    return res.data; // { installedAddons, featuredAddons }
};

export const installAddon = async (manifestUrl) => {
    const res = await axios.post(
        `${config.API_URL}/api/addons/install`,
        { manifestUrl },
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
    const params = { type };
    if (imdbId) params.imdbId = imdbId;
    if (tmdbId) params.tmdbId = String(tmdbId);
    if (season) params.season = season;
    if (episode) params.episode = episode;

    const res = await axios.get(`${config.API_URL}/api/addons/streams`, {
        headers: auth(),
        params,
    });
    return res.data; // { streams, imdbId, noAddons? }
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
