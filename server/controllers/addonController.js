const axios = require('axios');
const User = require('../models/User');
const logger = require('../utils/logger');

const TMDB_API_KEY = process.env.TMDB_API_KEY;

const FEATURED_ADDONS = [
    {
        id: 'community.torrentio',
        name: 'Torrentio',
        description: 'Streams from major torrent providers (YTS, EZTV, RARGB, 1337x, TheRARBG). Best stream availability for movies & shows.',
        baseUrl: 'https://torrentio.strem.fun',
        logo: 'https://torrentio.strem.fun/static/images/logo.png',
    },
    {
        id: 'knightcrawler.elfhosted.com',
        name: 'Knightcrawler',
        description: 'High-quality torrent streams with seeder counts. Great alternative/complement to Torrentio.',
        baseUrl: 'https://knightcrawler.elfhosted.com',
        logo: 'https://elfhosted.com/images/logo.png',
    },
    {
        id: 'cyberflix.elfhosted.com',
        name: 'Cyberflix',
        description: 'Debrid-based streams via ElfHosted. Fast, cached downloads via Real-Debrid/AllDebrid.',
        baseUrl: 'https://cyberflix.elfhosted.com',
        logo: 'https://elfhosted.com/images/logo.png',
    },
];

exports.getAddons = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('installedAddons');
        res.json({
            installedAddons: user.installedAddons || [],
            featuredAddons: FEATURED_ADDONS,
        });
    } catch (err) {
        logger.error('getAddons error:', err);
        res.status(500).json({ error: 'Failed to fetch addons' });
    }
};

exports.installAddon = async (req, res) => {
    const { manifestUrl } = req.body;
    if (!manifestUrl) return res.status(400).json({ error: 'manifestUrl is required' });

    try {
        const manifestRes = await axios.get(manifestUrl, { timeout: 12000 });
        const manifest = manifestRes.data;

        if (!manifest.id || !manifest.name) {
            return res.status(400).json({ error: 'Invalid Stremio manifest (missing id or name)' });
        }

        let baseUrl;
        try {
            const url = new URL(manifestUrl);
            baseUrl = `${url.protocol}//${url.host}${url.pathname.replace('/manifest.json', '')}`;
        } catch {
            return res.status(400).json({ error: 'Invalid manifest URL format' });
        }

        const addonData = {
            id: manifest.id,
            name: manifest.name,
            description: manifest.description || '',
            baseUrl,
            logo: manifest.logo || manifest.icon || '',
            installedAt: new Date(),
        };

        const user = await User.findById(req.user._id);
        const existingIdx = user.installedAddons.findIndex(a => a.id === manifest.id);
        if (existingIdx >= 0) {
            user.installedAddons[existingIdx] = addonData;
        } else {
            user.installedAddons.push(addonData);
        }
        await user.save();

        res.json({ success: true, addon: addonData });
    } catch (err) {
        logger.error('installAddon error:', err);
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET') {
            return res.status(400).json({ error: 'Could not reach the addon URL. Check the URL and try again.' });
        }
        if (err.response?.status === 404) {
            return res.status(400).json({ error: 'Manifest not found at that URL (404).' });
        }
        res.status(500).json({ error: 'Failed to install addon' });
    }
};

exports.uninstallAddon = async (req, res) => {
    const { addonId } = req.params;
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { installedAddons: { id: decodeURIComponent(addonId) } },
        });
        res.json({ success: true });
    } catch (err) {
        logger.error('uninstallAddon error:', err);
        res.status(500).json({ error: 'Failed to uninstall addon' });
    }
};

exports.fetchStreams = async (req, res) => {
    let { imdbId, tmdbId, type, season, episode } = req.query;
    if (!type) type = 'movie';

    try {
        // Resolve IMDB ID via TMDB if needed
        if (!imdbId && tmdbId && TMDB_API_KEY) {
            const tmdbType = type === 'series' ? 'tv' : 'movie';
            const extRes = await axios.get(
                `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/external_ids`,
                { params: { api_key: TMDB_API_KEY }, timeout: 8000 }
            );
            imdbId = extRes.data.imdb_id;
        }

        if (!imdbId) {
            return res.status(400).json({ error: 'IMDB ID could not be resolved. Add this title to your library first.' });
        }

        const user = await User.findById(req.user._id).select('installedAddons');
        const addons = user.installedAddons || [];

        if (addons.length === 0) {
            return res.json({ streams: [], imdbId, noAddons: true });
        }

        const streamPath = (type === 'series' && season && episode)
            ? `/stream/series/${imdbId}:${season}:${episode}.json`
            : `/stream/movie/${imdbId}.json`;

        const results = await Promise.allSettled(
            addons.map(async (addon) => {
                const url = `${addon.baseUrl}${streamPath}`;
                const response = await axios.get(url, { timeout: 20000 });
                const streams = response.data?.streams || [];
                return streams.map(s => ({
                    ...s,
                    addonName: addon.name,
                    addonId: addon.id,
                }));
            })
        );

        const allStreams = [];
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                allStreams.push(...result.value);
            }
        });

        res.json({ streams: allStreams, imdbId });
    } catch (err) {
        logger.error('fetchStreams error:', err);
        res.status(500).json({ error: 'Failed to fetch streams' });
    }
};
