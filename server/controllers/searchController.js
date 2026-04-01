const searchService = require('../services/searchService');
const UserBehavior = require('../models/UserBehavior');
const embeddingService = require('../services/embeddingService');
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
 * AI-Powered Semantic Search
 * GET /api/search/semantic?q=
 */
exports.semanticSearch = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ message: 'Query is required' });

        // 1. Generate Query Embedding
        const queryVector = await embeddingService.generateEmbedding(q);
        if (!queryVector) {
            return res.status(500).json({ message: 'Failed to generate search vector' });
        }

        // 2. Perform MongoDB Atlas Vector Search
        // Note: Needs a Vector Search Index named 'vector_index' on the 'media' collection
        const results = await Media.aggregate([
            {
                $vectorSearch: {
                    index: "vector_index", 
                    path: "embedding",
                    queryVector: queryVector,
                    numCandidates: 100,
                    limit: 12
                }
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    poster: 1,
                    year: 1,
                    plot: 1,
                    mediaType: 1,
                    genre: 1,
                    score: { $meta: "vectorSearchScore" }
                }
            }
        ]);

        res.status(200).json(results);
    } catch (error) {
        logger.error('[SearchController] Semantic search failed:', error);
        res.status(500).json({ message: 'AI Search failed', error: error.message });
    }
};

/**
 * Get Watch Providers for a movie/tv show
 * GET /api/search/providers/:type/:id
 */
exports.getProviders = async (req, res) => {
    try {
        const { type, id } = req.params;
        const { region } = req.query; // Optional

        const providers = await searchService.getWatchProviders(type, id, region || 'IN');
        res.status(200).json(providers);
    } catch (error) {
        console.error('Provider fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch watch providers' });
    }
};
