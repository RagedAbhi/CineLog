const algoliasearch = require('algoliasearch');

// Initialize Algolia Client
let client = null;
let index = null;

if (process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_ADMIN_KEY) {
    client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_ADMIN_KEY);
    index = client.initIndex('cinelog_media');
    
    // Optional: Configure index settings on startup
    index.setSettings({
        searchableAttributes: [
            'title',
            'overview',
            'unordered(cast)',
            'unordered(director)'
        ],
        customRanking: [
            'desc(popularity)',
            'desc(year)'
        ]
    }).catch(err => console.error('Algolia setting error:', err));
}

/**
 * Adds or updates a movie/show in the Algolia Index.
 * Gracefully ignores the call if API keys are not provided.
 * @param {Object} mediaItem - The item to index
 */
exports.indexMedia = async (mediaItem) => {
    if (!index) return; // Silent fallback if not configured

    try {
        const algoliaObject = {
            objectID: mediaItem.imdbID || mediaItem.id, // Must be unique
            title: mediaItem.title,
            mediaType: mediaItem.mediaType,
            year: mediaItem.year,
            poster: mediaItem.poster,
            overview: mediaItem.overview,
            cast: mediaItem.cast ? mediaItem.cast.split(', ') : [],
            director: mediaItem.director,
            genres: mediaItem.genre ? mediaItem.genre.split(', ') : [],
            popularity: mediaItem.imdbRating || 0 // rough proxy for popularity
        };

        await index.saveObject(algoliaObject);
        console.log(`[Algolia] Indexed: ${mediaItem.title}`);
    } catch (error) {
        console.error('[Algolia] Indexing failed:', error);
    }
};

/**
 * Searches the Algolia index.
 * Gracefully returns null if keys are not provided, allowing fallback to TMDB.
 */
exports.searchAlgolia = async (query) => {
    if (!index) return null;

    try {
        const { hits } = await index.search(query, {
            hitsPerPage: 10,
            typoTolerance: 'min',
            minWordSizefor1Typo: 3,
            minWordSizefor2Typos: 7
        });
        return hits;
    } catch (error) {
        console.error('[Algolia] Search failed:', error);
        return null;
    }
};
