const axios = require('axios');
const Media = require('../models/Media');

const TMDB_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

const getLanguageFromTMDB = async (imdbID, title, mediaType) => {
    try {
        const tmdbType = mediaType === 'series' ? 'tv' : 'movie';

        let tmdbId = null;

        if (imdbID && /^tt\d+/.test(imdbID)) {
            const res = await axios.get(`${BASE_URL}/find/${imdbID}`, {
                params: { api_key: TMDB_KEY, external_source: 'imdb_id' },
                timeout: 5000
            });
            tmdbId = res.data.movie_results?.[0]?.id || res.data.tv_results?.[0]?.id;
        }

        if (!tmdbId && title) {
            const res = await axios.get(`${BASE_URL}/search/${tmdbType}`, {
                params: { api_key: TMDB_KEY, query: title },
                timeout: 5000
            });
            tmdbId = res.data.results?.[0]?.id;
        }

        if (!tmdbId) return null;

        const detail = await axios.get(`${BASE_URL}/${tmdbType}/${tmdbId}`, {
            params: { api_key: TMDB_KEY },
            timeout: 5000
        });
        return detail.data.original_language || null;
    } catch {
        return null;
    }
};

// POST /api/media/migrate-language — backfills language for items that don't have one
exports.migrateLanguage = async (req, res) => {
    if (!TMDB_KEY) return res.status(500).json({ message: 'TMDB API key not configured' });

    try {
        const itemsToFix = await Media.find({ userId: req.user.id, language: { $in: ['', null, undefined] } });

        let updated = 0;
        let failed = 0;

        for (const item of itemsToFix) {
            const lang = await getLanguageFromTMDB(item.imdbID, item.title, item.mediaType);
            if (lang) {
                await Media.updateOne({ _id: item._id }, { language: lang });
                updated++;
            } else {
                failed++;
            }
            // Small delay to avoid hammering TMDB
            await new Promise(r => setTimeout(r, 100));
        }

        res.json({ message: 'Language migration complete', updated, failed, total: itemsToFix.length });
    } catch (err) {
        res.status(500).json({ message: 'Migration failed', error: err.message });
    }
};
