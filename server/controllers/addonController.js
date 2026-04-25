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
    let { manifestUrl, manifest } = req.body;
    if (!manifestUrl) return res.status(400).json({ error: 'manifestUrl is required' });

    try {
        // If the frontend couldn't fetch it (e.g. CORS), we try one last time from server
        // but usually the frontend will pass the manifest data here to bypass 403s.
        if (!manifest) {
            const manifestRes = await axios.get(manifestUrl, { 
                timeout: 12000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            });
            manifest = manifestRes.data;
        }

        if (!manifest || !manifest.id || !manifest.name) {
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
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Guard: initialise field if missing on older documents
        if (!user.installedAddons) user.installedAddons = [];

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
        if (err.response?.status === 403) {
            return res.status(403).json({ error: 'Addon Error: Access Denied (403). The addon server is blocking our connection. Try again later or use a different URL.' });
        }
        const remoteMsg = err.response?.data?.error || err.response?.data?.message || err.message;
        res.status(400).json({ error: `Addon Error: ${remoteMsg || 'Installation failed'}` });
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
    let { imdbId, tmdbId, type, season, episode, title, year } = req.query;
    if (!type) type = 'movie';

    try {
        const accountData = await User.findById(req.user.id).select('installedAddons');
        const addons = accountData?.installedAddons || [];

        const tmdbType = type === 'series' ? 'tv' : 'movie';
        let finalImdbId = (imdbId && String(imdbId).startsWith('tt')) ? imdbId : null;

        // Step 1: numeric tmdbId → resolve IMDB ID via /external_ids
        const numericTmdbId = (tmdbId && /^\d+$/.test(String(tmdbId))) ? tmdbId : null;
        if (!finalImdbId && numericTmdbId && TMDB_API_KEY) {
            try {
                const extRes = await axios.get(
                    `https://api.themoviedb.org/3/${tmdbType}/${numericTmdbId}/external_ids`,
                    { params: { api_key: TMDB_API_KEY }, timeout: 8000 }
                );
                finalImdbId = extRes.data.imdb_id || null;
            } catch (e) {
                console.error('[AddonProxy] tmdbId→IMDB resolution failed:', e.message);
            }
        }

        // Step 2: title+year search → get TMDB ID → resolve IMDB ID
        if (!finalImdbId && title && TMDB_API_KEY) {
            try {
                const searchRes = await axios.get(
                    `https://api.themoviedb.org/3/search/${tmdbType}`,
                    { params: { api_key: TMDB_API_KEY, query: title, ...(year ? { year } : {}) }, timeout: 8000 }
                );
                const hit = searchRes.data.results?.[0];
                if (hit?.id) {
                    const extRes = await axios.get(
                        `https://api.themoviedb.org/3/${tmdbType}/${hit.id}/external_ids`,
                        { params: { api_key: TMDB_API_KEY }, timeout: 8000 }
                    );
                    finalImdbId = extRes.data.imdb_id || null;
                }
            } catch (e) {
                console.error('[AddonProxy] Title search fallback failed:', e.message);
            }
        }

        if (!finalImdbId || !String(finalImdbId).startsWith('tt')) {
            console.warn(`[AddonProxy] Could not resolve IMDB ID for "${title || imdbId}"`);
            return res.status(200).json({ streams: [], imdbId: null, addons });
        }

        if (addons.length === 0) {
            return res.json({ streams: [], imdbId: finalImdbId, noAddons: true });
        }

        const streamPath = (type === 'series' && season && episode)
            ? `/stream/series/${finalImdbId}:${season}:${episode}.json`
            : `/stream/movie/${finalImdbId}.json`;

        // 2. INTERNAL PROXY WITH DESKTOP MASKING
        const results = await Promise.allSettled(
            addons.map(async (addon) => {
                const url = `${addon.baseUrl.replace(/\/$/, '')}${streamPath}`;
                try {
                    const response = await axios.get(url, { 
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Stremio/4.4.159',
                            'Accept': 'application/json, text/plain, */*',
                            'X-Stremio-Client': 'stremio-desktop'
                        },
                        timeout: 10000 
                    });
                    const streams = response.data?.streams || [];
                    return streams.map(s => ({
                        ...s,
                        addonName: addon.name,
                        addonId: addon.id,
                    }));
                } catch (e) {
                    return [];
                }
            })
        );

        const allStreams = [];
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                allStreams.push(...result.value);
            }
        });

        res.json({
            streams: allStreams,
            imdbId: finalImdbId,
            addons: addons.map(a => ({ id: a.id, name: a.name }))
        });
    } catch (err) {
        logger.error('fetchStreams Proxy Error:', err);
        res.status(500).json({ error: 'Failed to fetch streams via proxy' });
    }
};
