const axios = require('axios');
const https = require('https');
const SearchCache = require('../models/SearchCache');
const UserBehavior = require('../models/UserBehavior');
const Media = require('../models/Media');
const Friendship = require('../models/Friendship');
const algoliaService = require('./algoliaService');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

// Force IPv4 to prevent ECONNRESET connection drops from TMDB via ISP routing
const httpsAgent = new https.Agent({ family: 4 });


const CACHE_TTL_HOURS = 24;

const GENRE_MAP = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
    27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
    10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
    10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

/**
 * Main Search Proxy with Caching and Personalization
 */
exports.searchMulti = async (query, type, userId) => {
    const cacheKey = `search_${type || 'all'}_${query.toLowerCase().trim()}`;
    
    // 1. Check MongoDB Cache
    const cached = await SearchCache.findOne({ query: cacheKey });
    let rawResults;

    if (cached) {
        rawResults = cached.results;
    } else {
        // 2. Fetch from TMDB
        let endpoint = '/search/multi';
        if (type === 'movie') endpoint = '/search/movie';
        else if (type === 'tv') endpoint = '/search/tv';
        else if (type === 'person') endpoint = '/search/person';

        const [response, algoliaHits] = await Promise.all([
            axios.get(`${BASE_URL}${endpoint}`, {
                httpsAgent,
                params: {
                    api_key: TMDB_API_KEY,
                    query: query,
                    include_adult: false,
                    language: 'en-US',
                    page: 1
                }
            }),
            algoliaService.searchAlgolia(query)
        ]);
        
        rawResults = response.data.results;

        // ----------------------------------------------------
        // DIRECTOR INTENT DETECTION & INJECTION
        // ----------------------------------------------------
        const topPerson = rawResults.find(r => r.media_type === 'person');
        let injectedDirectedMovies = [];
        
        if (
            topPerson && 
            topPerson.known_for_department === 'Directing' && 
            topPerson.name.toLowerCase().includes(query.toLowerCase())
        ) {
            try {
                const creditsRes = await axios.get(`${BASE_URL}/person/${topPerson.id}/movie_credits`, {
                    httpsAgent,
                    params: { api_key: TMDB_API_KEY, language: 'en-US' }
                });
                
                // Extract top explicitly directed movies
                injectedDirectedMovies = creditsRes.data.crew
                    .filter(c => c.job === 'Director')
                    .sort((a, b) => b.popularity - a.popularity)
                    .slice(0, 5) // Inject top 5
                    .map(m => ({
                        ...m,
                        media_type: 'movie',
                        popularity: m.popularity + 500 // Moderate boost below Algolia but above deep TMDB
                    }));
            } catch (err) {
                console.error('[Search] Failed to fetch director credits', err);
            }
        }

        if (injectedDirectedMovies.length > 0) {
            const rawIds = new Set(rawResults.map(r => r.id.toString()));
            const uniqueInjections = injectedDirectedMovies.filter(m => !rawIds.has(m.id.toString()));
            rawResults = [...uniqueInjections, ...rawResults];
        }
        // ----------------------------------------------------

        // Map and Merge Typo-Tolerant Algolia Hits
        if (algoliaHits && algoliaHits.length > 0) {
            const tmdbIds = new Set(rawResults.map(r => r.id.toString()));
            
            let algoliaMapped = algoliaHits
                .filter(hit => !tmdbIds.has(hit.objectID))
                .filter(hit => type === 'all' || !type || hit.mediaType === type);

            // If it's a director query, rigorously purge movies where they ONLY did a cameo (cast)
            if (topPerson && topPerson.known_for_department === 'Directing') {
                algoliaMapped = algoliaMapped.filter(hit => {
                    // Match if directed
                    if (hit.director && hit.director.toLowerCase().includes(query.toLowerCase())) return true;
                    // Reject if they are only in the cast for this movie
                    if (hit.cast && hit.cast.some(c => c.toLowerCase().includes(query.toLowerCase()))) return false;
                    return true;
                });
            }

            algoliaMapped = algoliaMapped.map(hit => ({
                id: hit.objectID,
                title: hit.title,
                name: hit.title,
                media_type: hit.mediaType,
                release_date: hit.year ? `${hit.year}-01-01` : '',
                poster_path: hit.poster ? hit.poster.replace('https://image.tmdb.org/t/p/w400', '') : null,
                overview: hit.overview,
                popularity: hit.popularity + 1000 // Ensure typo hits float to the top
            }));
                
            rawResults = [...algoliaMapped, ...rawResults];
        }

        // Inject media_type because TMDB omits it on specific endpoints
        if (type && type !== 'all') {
            rawResults = rawResults.map(r => ({ 
                ...r, 
                media_type: type === 'tv' ? 'tv' : type 
            }));
        }
        
        // 3. Save to Cache
        await SearchCache.create({
            query: cacheKey,
            results: rawResults,
            expiresAt: new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000)
        });
    }

    // 4. Process and Group Results
    const processed = await processResults(rawResults, userId);
    
    // 5. Categorize
    return {
        all: processed,
        movies: processed.filter(item => item.mediaType === 'movie'),
        tvShows: processed.filter(item => item.mediaType === 'series'),
        people: processed.filter(item => item.mediaType === 'person')
    };
};

/**
 * Fetch Person Filmography
 */
exports.getPersonDetails = async (personId) => {
    const cacheKey = `person_${personId}`;
    const cached = await SearchCache.findOne({ query: cacheKey });
    
    if (cached) return cached.results;

    // Fetch Details + Credits
    const [info, credits] = await Promise.all([
        axios.get(`${BASE_URL}/person/${personId}`, { httpsAgent, params: { api_key: TMDB_API_KEY } }),
        axios.get(`${BASE_URL}/person/${personId}/combined_credits`, { httpsAgent, params: { api_key: TMDB_API_KEY } })
    ]);

    const results = {
        info: {
            id: info.data.id,
            name: info.data.name,
            image: info.data.profile_path ? `https://image.tmdb.org/t/p/w300${info.data.profile_path}` : null,
            bio: info.data.biography,
            knownFor: info.data.known_for_department,
            birthday: info.data.birthday,
            placeOfBirth: info.data.place_of_birth
        },
        actedIn: credits.data.cast
            .filter(c => c.poster_path)
            .sort((a, b) => b.popularity - a.popularity)
            .map(mapMediaItem),
        directed: credits.data.crew
            .filter(c => c.job === 'Director' && c.poster_path)
            .sort((a, b) => b.popularity - a.popularity)
            .map(mapMediaItem)
    };

    await SearchCache.create({
        query: cacheKey,
        results: results,
        expiresAt: new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000)
    });

    return results;
};

/**
 * Internal Processor for Personalization and Social Boost
 */
async function processResults(results, userId) {
    // Fetch User Behavior, Friends, and User's own Library for reconciliation
    const [behavior, friends, userLibrary] = await Promise.all([
        UserBehavior.findOne({ userId }),
        Friendship.find({ 
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted'
        }),
        Media.find({ userId }).select('imdbID title mediaType status')
    ]);

    const friendIds = friends.map(f => 
        f.requester.toString() === userId.toString() ? f.recipient : f.requester
    );

    // Map and Score results
    const mapped = results.map(item => {
        let mappedItem = item.media_type === 'person' ? {
            id: item.id,
            name: item.name,
            image: item.profile_path ? `https://image.tmdb.org/t/p/w200${item.profile_path}` : null,
            mediaType: 'person',
            knownFor: item.known_for?.map(m => m.title || m.name).join(', '),
            popularity: item.popularity
        } : mapMediaItem(item);

        // Reconciliation: Check if this item is ALREADY in the user's library
        if (mappedItem.mediaType !== 'person') {
            const normalizedTitle = mappedItem.title.toLowerCase().trim();
            const existingInLibrary = userLibrary.find(libItem => 
                (libItem.imdbID && libItem.imdbID === mappedItem.id.toString()) ||
                (libItem.title.toLowerCase().trim() === normalizedTitle && libItem.mediaType === mappedItem.mediaType)
            );

            if (existingInLibrary) {
                mappedItem.libraryStatus = existingInLibrary.status;
                mappedItem.libraryId = existingInLibrary._id;
            }
        }

        return mappedItem;
    });

    // Score media items
    for (const item of mapped) {
        if (item.mediaType === 'person') continue;

        let score = 0;
        
        // 1. Genre Match (* 5)
        if (behavior && behavior.preferredGenres.length > 0) {
            const matchCount = item.genreIds.filter(gid => 
                behavior.preferredGenres.some(pg => pg.id === gid)
            ).length;
            score += Math.min(matchCount, 3) * 5;
        }

        // 2. User History Similarity (* 4)
        if (behavior && behavior.clickedItems.length > 0) {
            const historyMatch = behavior.clickedItems.some(h => h.id === item.id.toString());
            if (historyMatch) score += 10; // High boost for repeat interest
        }

        // 3. Friend Activity (* 3) + Social Metadata
        const friendActivity = await Media.find({
            imdbID: item.id.toString(), // Note: TMDB ID and IMDB ID differ, usually need both
            userId: { $in: friendIds }
        }).populate('userId', 'username name');

        if (friendActivity.length > 0) {
            score += friendActivity.length * 3;
            item.socialMetadata = {
                count: friendActivity.length,
                friends: friendActivity.slice(0, 2).map(f => f.userId.name || f.userId.username),
                text: `${friendActivity.length} friends watched this`
            };
        }

        // 4. Global Popularity (* 1)
        score += Math.min(item.popularity / 10, 10);

        item.personalizationScore = score;
    }

    // Re-rank based on personalization score
    return mapped.sort((a, b) => (b.personalizationScore || 0) - (a.personalizationScore || 0));
}

/**
 * Fetch Streaming Availability (Watch Providers)
 */
exports.getWatchProviders = async (type, id, region = 'IN') => {
    try {
        const endpoint = type === 'series' || type === 'tv' ? `/tv/${id}/watch/providers` : `/movie/${id}/watch/providers`;
        const response = await axios.get(`${BASE_URL}${endpoint}`, {
            httpsAgent,
            params: { api_key: TMDB_API_KEY }
        });

        const providers = response.data.results[region.toUpperCase()];
        if (!providers) return null;

        // Return a clean structure of icons and names
        return {
            flatrate: providers.flatrate?.map(p => ({
                name: p.provider_name,
                logo: `https://image.tmdb.org/t/p/original${p.logo_path}`
            })) || [],
            rent: providers.rent?.map(p => ({
                name: p.provider_name,
                logo: `https://image.tmdb.org/t/p/original${p.logo_path}`
            })) || [],
            buy: providers.buy?.map(p => ({
                name: p.provider_name,
                logo: `https://image.tmdb.org/t/p/original${p.logo_path}`
            })) || [],
            link: providers.link
        };
    } catch (err) {
        console.error('[SearchService] Error fetching watch providers:', err);
        return null;
    }
}

function mapMediaItem(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        year: (item.release_date || item.first_air_date || '').split('-')[0],
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w400${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        mediaType: item.media_type === 'tv' || item.first_air_date ? 'series' : 'movie',
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        overview: item.overview,
        genreIds: item.genre_ids || [],
        popularity: item.popularity
    };
}
