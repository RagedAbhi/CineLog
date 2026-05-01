const searchService = require('../services/searchService');
const UserBehavior = require('../models/UserBehavior');
const Media = require('../models/Media');
const logger = require('../utils/logger');

/**
 * Enhanced Search Proxy with Personalization
 * GET /api/search?q=&type=
 */
exports.proxySearch = async (req, res) => {
    try {
        const { q, type } = req.query;
        const userId = req.user.id;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter "q" is required' });
        }

        // 1. Log search to User Behavior for future personalization
        await UserBehavior.findOneAndUpdate(
            { userId },
            { 
                $push: { 
                    searchHistory: { 
                        $each: [{ query: q, timestamp: new Date() }],
                        $slice: -20 // Keep last 20 searches
                    } 
                }
            },
            { upsert: true, new: true }
        );

        // 2. Execute Search with Service (Caching + Personalization inside)
        const results = await searchService.searchMulti(q, type, userId);

        res.status(200).json(results);
    } catch (error) {
        console.error('Search Proxy Error:', error);
        res.status(500).json({ message: 'Search failed', error: error.message });
    }
};

/**
 * Get Detailed Person Filmography
 * GET /api/person/:id
 */
exports.getPersonFilmography = async (req, res) => {
    try {
        const { id } = req.params;
        const results = await searchService.getPersonDetails(id);
        res.status(200).json(results);
    } catch (error) {
        console.error('Person Detail Error:', error);
        res.status(500).json({ message: 'Failed to fetch person details', error: error.message });
    }
};

/**
 * Track Item Interaction (Click/View)
 * POST /api/search/track
 */
exports.trackInteraction = async (req, res) => {
    try {
        const { id, title, mediaType, genreIds } = req.body;
        const userId = req.user.id;

        const update = {
            $push: { 
                clickedItems: { 
                    $each: [{ id, title, mediaType, genreIds, timestamp: new Date() }],
                    $slice: -50 // Keep last 50 interactions
                } 
            }
        };

        // Update preferred genres based on this interaction
        if (genreIds && genreIds.length > 0) {
            // This would normally be a more complex aggregation, 
            // but for now we'll just track the latest
            update.$set = { lastInteractionGenres: genreIds };
        }

        await UserBehavior.findOneAndUpdate({ userId }, update, { upsert: true });

        res.status(200).json({ message: 'Interaction tracked' });
    } catch (error) {
        res.status(500).json({ message: 'Tracking failed', error: error.message });
    }
};

/**
 * AI-Powered Semantic Search (Temporarily Disabled)
 * GET /api/search/semantic?q=
 */
exports.semanticSearch = async (req, res) => {
    try {
        // OpenAI disabled temporarily as per request
        res.status(200).json([]); 
    } catch (error) {
        logger.error('[SearchController] Semantic search failed:', error);
        res.status(500).json({ message: 'AI Search failed', error: error.message });
    }
};

/**
 * Get Watch Providers for a movie/tv show (legacy — by TMDB type/id)
 * GET /api/search/providers/:type/:id
 */
exports.getProviders = async (req, res) => {
    try {
        const { type, id } = req.params;
        const { region } = req.query;
        const providers = await searchService.getWatchProviders(type, id, region || 'IN');
        res.status(200).json(providers);
    } catch (error) {
        console.error('Provider fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch watch providers' });
    }
};

/**
 * Get Watch Providers by IMDB ID (or TMDB ID) — WatchMode primary, TMDB fallback
 * GET /api/search/providers/imdb/:imdbID?title=&type=&year=
 */
exports.getProvidersById = async (req, res) => {
    try {
        const { imdbID } = req.params;
        const { title, type, year } = req.query;
        // 'search' is a sentinel used when there is no ID at all — title-only lookup
        const resolvedId = imdbID === 'search' ? null : imdbID;
        const providers = await searchService.getProvidersByImdbId(resolvedId, title, type, year);
        res.status(200).json(providers);
    } catch (error) {
        console.error('Provider by IMDB ID fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch watch providers' });
    }
};
/**
 * Get Personalized Discovery Feed
 * GET /api/search/discover
 */
exports.getDiscoverFeed = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const { type, genre, language } = req.query;
        
        const results = await searchService.getDiscoveryFeed(userId, page, limit, { type, genre, language });
        res.status(200).json(results);
    } catch (error) {
        console.error('Discover Feed Error:', error);
        res.status(500).json({ message: 'Failed to generate discovery feed', error: error.message });
    }
};
