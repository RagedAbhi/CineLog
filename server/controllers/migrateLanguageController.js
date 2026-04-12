const axios = require('axios');
const Media = require('../models/Media');

const TMDB_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Smarter TMDB language fetcher:
 * 1. Tries IMDb ID first (most accurate)
 * 2. Falls back to title search, but validates against year to avoid wrong matches
 */
const getLanguageFromTMDB = async (imdbID, title, mediaType, year) => {
    try {
        const tmdbType = mediaType === 'series' ? 'tv' : 'movie';
        const yearNum = parseInt(year, 10);

        let tmdbId = null;

        // --- Strategy 1: IMDb ID lookup (most reliable) ---
        if (imdbID && /^tt\d+/.test(imdbID)) {
            const res = await axios.get(`${BASE_URL}/find/${imdbID}`, {
                params: { api_key: TMDB_KEY, external_source: 'imdb_id' },
                timeout: 5000
            });
            tmdbId = res.data.movie_results?.[0]?.id || res.data.tv_results?.[0]?.id;
        }

        // --- Strategy 2: Numeric TMDB ID ---
        if (!tmdbId && imdbID && /^\d+$/.test(imdbID)) {
            tmdbId = imdbID;
        }

        // --- Strategy 3: Title search with year validation ---
        if (!tmdbId && title) {
            const res = await axios.get(`${BASE_URL}/search/${tmdbType}`, {
                params: { api_key: TMDB_KEY, query: title },
                timeout: 5000
            });

            const results = res.data.results || [];

            if (yearNum && results.length > 0) {
                // Prefer a result whose release year matches ±1 year
                const dateField = tmdbType === 'tv' ? 'first_air_date' : 'release_date';
                const yearMatched = results.find(r => {
                    const rYear = parseInt((r[dateField] || '').split('-')[0], 10);
                    return Math.abs(rYear - yearNum) <= 1;
                });
                tmdbId = yearMatched?.id || results[0]?.id; // Fall back to first if no year match
            } else {
                tmdbId = results[0]?.id;
            }
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

/**
 * POST /api/media/migrate-language
 * Query params:
 *   ?force=true  — re-processes ALL items, including ones that already have a language (fixes wrong values)
 */
exports.migrateLanguage = async (req, res) => {
    if (!TMDB_KEY) return res.status(500).json({ message: 'TMDB API key not configured' });

    const force = req.query.force === 'true';

    try {
        const query = force
            ? { userId: req.user.id }  // force: re-process everything
            : { userId: req.user.id, language: { $in: ['', null, undefined] } };

        const itemsToFix = await Media.find(query);

        let updated = 0;
        let failed = 0;

        for (const item of itemsToFix) {
            const lang = await getLanguageFromTMDB(item.imdbID, item.title, item.mediaType, item.year);
            if (lang) {
                await Media.updateOne({ _id: item._id }, { language: lang });
                updated++;
            } else {
                failed++;
            }
            // Small delay to avoid hammering TMDB
            await new Promise(r => setTimeout(r, 120));
        }

        res.json({ message: 'Language migration complete', updated, failed, total: itemsToFix.length });
    } catch (err) {
        res.status(500).json({ message: 'Migration failed', error: err.message });
    }
};
