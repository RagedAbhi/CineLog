import axios from 'axios';
import config from '../config';

const TMDB_API_KEY = process.env.REACT_APP_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Fetches streaming availability for a movie/show.
 * Calls the backend /api/search/providers/imdb/:imdbID which uses WatchMode
 * (with TMDB fallback). Items without an imdbID return null — no OTT shown.
 */
export const fetchStreamingAvailability = async (title, type, year, imdbID = null) => {
    // Items with no imdbID skip OTT lookup entirely
    if (!imdbID && !title) return null;

    try {
        const token = localStorage.getItem('token');
        const params = {};
        if (title) params.title = title;
        if (type) params.type = type;
        if (year) params.year = year;

        // imdbID may be a proper IMDB ID (tt...) or a TMDB numeric ID — backend handles both
        const idSegment = imdbID || 'search';
        const res = await axios.get(`${config.API_URL}/api/search/providers/imdb/${idSegment}`, {
            headers: { Authorization: `Bearer ${token}` },
            params
        });
        return Array.isArray(res.data) && res.data.length > 0 ? res.data : null;
    } catch (error) {
        if (error.response?.status === 401) return { error: 'INVALID_API_KEY' };
        console.error('Error fetching streaming providers:', error);
        return null;
    }
};
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

const getCachedData = (key) => {
    const cached = localStorage.getItem(`cuerates_cache_${key}`);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
        localStorage.removeItem(`cuerates_cache_${key}`);
        return null;
    }
    return data;
};

const setCachedData = (key, data) => {
    localStorage.setItem(`cuerates_cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
    }));
};

export const searchMultiTMDB = async (query) => {
    if (!TMDB_API_KEY) return [];
    
    const cacheKey = `multi_${query.toLowerCase()}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(`${BASE_URL}/search/multi`, {
            params: {
                api_key: TMDB_API_KEY,
                query: query,
                include_adult: false,
                language: 'en-US',
                page: 1
            }
        });

        let results = [];
        const personResults = response.data.results.filter(item => item.media_type === 'person');
        const mediaResults = response.data.results.filter(item => item.media_type !== 'person');

        // Map initial media results
        results = mediaResults.map(item => ({
            id: item.id,
            title: item.title || item.name,
            year: (item.release_date || item.first_air_date || '').split('-')[0],
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : '',
            backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}` : '',
            mediaType: item.media_type === 'tv' ? 'series' : 'movie',
            rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
            overview: item.overview,
            genreIds: item.genre_ids || [],
            popularity: item.popularity
        }));

        // If a person is found, fetch their top movies/shows
        if (personResults.length > 0) {
            const topPerson = personResults[0];
            const creditsResponse = await axios.get(`${BASE_URL}/person/${topPerson.id}/combined_credits`, {
                params: { api_key: TMDB_API_KEY }
            });

            const topCredits = creditsResponse.data.cast
                .sort((a, b) => b.popularity - a.popularity)
                .slice(0, 8)
                .map(item => ({
                    id: item.id,
                    title: item.title || item.name,
                    year: (item.release_date || item.first_air_date || '').split('-')[0],
                    poster: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : '',
                    mediaType: item.media_type === 'tv' ? 'series' : 'movie',
                    rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
                    overview: item.overview,
                    genreIds: item.genre_ids || [],
                    popularity: item.popularity,
                    subtitle: `Starring ${topPerson.name}`
                }));

            // Merge and de-duplicate
            const existingIds = new Set(results.map(r => r.id));
            topCredits.forEach(c => {
                if (!existingIds.has(c.id)) {
                    results.push(c);
                    existingIds.add(c.id);
                }
            });
        }

        // If results are sparse, try keyword/theme discovery
        if (results.length < 5) {
            const themeResults = await searchThematicTMDB(query);
            const existingIds = new Set(results.map(r => r.id));
            themeResults.forEach(t => {
                if (!existingIds.has(t.id)) {
                    results.push({ ...t, subtitle: `Related to "${query}"` });
                    existingIds.add(t.id);
                }
            });
        }

        const sortedResults = results.sort((a, b) => b.popularity - a.popularity);
        setCachedData(cacheKey, sortedResults);
        return sortedResults;
    } catch (error) {
        console.error('TMDB Multi-Search Error:', error);
        return [];
    }
};

export const searchThematicTMDB = async (query) => {
    const cacheKey = `theme_${query.toLowerCase()}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        // 1. Find keywords for the query
        const kwResponse = await axios.get(`${BASE_URL}/search/keyword`, {
            params: { api_key: TMDB_API_KEY, query: query }
        });

        if (kwResponse.data.results.length === 0) return [];

        // 2. Discover movies using the top keyword
        const kwId = kwResponse.data.results[0].id;
        const discoverResponse = await axios.get(`${BASE_URL}/discover/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                with_keywords: kwId,
                sort_by: 'popularity.desc',
                include_adult: false
            }
        });

        const mapped = discoverResponse.data.results.slice(0, 5).map(item => ({
            id: item.id,
            title: item.title,
            year: (item.release_date || '').split('-')[0],
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : '',
            mediaType: 'movie',
            rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
            overview: item.overview,
            genreIds: item.genre_ids || [],
            popularity: item.popularity
        }));
        setCachedData(cacheKey, mapped);
        return mapped;
    } catch (e) { return []; }
};

export const getTrendingTMDB = async () => {
    if (!TMDB_API_KEY) return [];
    try {
        const response = await axios.get(`${BASE_URL}/trending/all/day`, {
            params: { api_key: TMDB_API_KEY }
        });
        return response.data.results.slice(0, 5).map(item => ({
            id: item.id,
            title: item.title || item.name,
            year: (item.release_date || item.first_air_date || '').split('-')[0],
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : '',
            mediaType: item.media_type === 'tv' ? 'series' : 'movie'
        }));
    } catch (error) { return []; }
};

export const GENRE_MAP = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
    27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
    10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
    10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

export const getBatchProvidersTMDB = async (items) => {
    // Shared mapping from search implementation
    const platformMap = {
        'Netflix': 'Netflix',
        'Amazon Prime Video': 'Amazon Prime',
        'Amazon Prime Video with Ads': 'Amazon Prime',
        'Prime Video': 'Amazon Prime',
        'Amazon Video': 'Amazon Prime',
        'Disney Plus Hotstar': 'Hotstar',
        'Disney+ Hotstar': 'Hotstar',
        'Zee5': 'Zee5',
        'ZEE5': 'Zee5',
        'Sony Liv': 'SonyLiv',
        'Sony LIV': 'SonyLiv',
        'SonyLiv': 'SonyLiv',
        'Apple TV': 'AppleTV',
        'Apple TV Plus': 'AppleTV',
        'Apple TV+': 'AppleTV',
        'Apple TV App': 'AppleTV',
        'Apple iTunes': 'AppleTV',
        'iTunes': 'AppleTV',
        'Rakuten Viki': 'Rakuten Viki',
        'JioCinema': 'JioCinema',
        'Jio Cinema': 'JioCinema',
        'YouTube': 'YouTube'
    };

    try {
        const results = await Promise.all(items.slice(0, 8).map(async (item) => {
            const type = item.mediaType === 'series' ? 'tv' : 'movie';
            try {
                const res = await axios.get(`${BASE_URL}/${type}/${item.id}/watch/providers`, {
                    params: { api_key: TMDB_API_KEY }
                });
                
                const india = res.data.results?.IN || {};
                
                // Combine flatrate, rent, and buy to capture Apple TV and others
                const allRaw = [
                    ...(india.flatrate || []),
                    ...(india.buy || []),
                    ...(india.rent || [])
                ];

                const uniqueMapped = [];
                const seen = new Set();

                allRaw.forEach(p => {
                    const mapped = platformMap[p.provider_name];
                    if (mapped && !seen.has(mapped)) {
                        uniqueMapped.push({
                            name: mapped,
                            logo: `https://image.tmdb.org/t/p/original${p.logo_path}`
                        });
                        seen.add(mapped);
                    }
                });

                return { id: item.id, providers: uniqueMapped.slice(0, 3) };
            } catch (err) {
                return { id: item.id, providers: [] };
            }
        }));
        return results;
    } catch (err) {
        console.error('Batch Provider Error:', err);
        return [];
    }
};

/**
 * Internal helper to resolve a TMDB ID from a mixed movie object.
 */
const resolveTMDBId = async (movie) => {
    if (!TMDB_API_KEY) return null;
    
    // 1. Direct ID check
    if (movie.tmdbId && !isNaN(movie.tmdbId)) return movie.tmdbId;
    if (movie.id && !isNaN(movie.id)) return movie.id;

    const tmdbType = movie.mediaType === 'series' ? 'tv' : 'movie';

    // 2. IMDB ID Lookup
    if (movie.imdbID && movie.imdbID.startsWith('tt')) {
        try {
            const findResponse = await axios.get(`${BASE_URL}/find/${movie.imdbID}`, {
                params: { api_key: TMDB_API_KEY, external_source: 'imdb_id' }
            });
            const result = (tmdbType === 'tv' ? findResponse.data.tv_results : findResponse.data.movie_results)?.[0];
            if (result) return result.id;
        } catch (e) {}
    }

    // 3. Search Fallback (Title + Year)
    if (movie.title) {
        try {
            const cleanYear = movie.year ? String(movie.year).match(/\d{4}/)?.[0] : null;
};

/**
 * Fetches the YouTube trailer ID for a specific movie or TV show.
 * Handles automatic ID resolution if the provided ID is missing or invalid.
 */
export const fetchTrailerID = async (movie) => {
    if (!TMDB_API_KEY || !movie) return null;
    
    const tmdbId = await resolveTMDBId(movie);
    if (!tmdbId) return null;

    const type = movie.mediaType === 'series' ? 'tv' : 'movie';
    try {
        const response = await axios.get(`${BASE_URL}/${type}/${tmdbId}/videos`, {
            params: { api_key: TMDB_API_KEY }
        });
        const videos = response.data.results || [];
        // Priority order: Official Trailer -> Trailer -> Teaser -> Any YouTube video
        const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && (v.name.includes('Official') || v.official)) ||
                        videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') || 
                        videos.find(v => v.site === 'YouTube' && v.type === 'Teaser') ||
                        videos.find(v => v.site === 'YouTube');
        return trailer ? trailer.key : null;
    } catch (e) {
        console.error('Error fetching trailer:', e);
        return null;
    }
};

/**
 * Builds a highly personalized recommendation grid based on the user's entire library content,
 * specifically extracting genre affinities and highly rated items, filtering out items the user already possesses.
 */
export const generatePersonalizedFeed = async (userLibrary) => {
    if (!TMDB_API_KEY || !userLibrary || userLibrary.length === 0) return [];

    try {
        // 1. Analyze user library for preferred genres
        const genreScores = {};
        const highlyRatedItems = [];
        
        userLibrary.forEach(movie => {
            if (movie.rating >= 8 || movie.isTopPick || movie.status === 'watched') {
                highlyRatedItems.push(movie);
            }
            if (movie.genre && movie.genre !== 'Unknown') {
                const weight = movie.rating || 5;
                movie.genre.split(/[,/]/).map(g => g.trim()).forEach(g => {
                    genreScores[g] = (genreScores[g] || 0) + weight;
                });
            }
        });

        // Get top 3 genres
        const topGenres = Object.entries(genreScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([g]) => {
                // Find TMDB ID from GENRE_MAP value
                const entry = Object.entries(GENRE_MAP).find(([id, name]) => name.toLowerCase() === g.toLowerCase() || name.includes(g) || g.includes(name));
                return entry ? entry[0] : null;
            }).filter(Boolean);

        const fetchPromises = [];

        // 2. Discover via Top Genres
        if (topGenres.length > 0) {
            fetchPromises.push(axios.get(`${BASE_URL}/discover/movie`, {
                params: { api_key: TMDB_API_KEY, with_genres: topGenres.join('|'), sort_by: 'popularity.desc', page: 1, vote_count_gte: 50 }
            }).catch(() => null));
            fetchPromises.push(axios.get(`${BASE_URL}/discover/tv`, {
                params: { api_key: TMDB_API_KEY, with_genres: topGenres.join('|'), sort_by: 'popularity.desc', page: 1, vote_count_gte: 50 }
            }).catch(() => null));
        }

        // 3. Discover via specific Highly Rated items (Netflix "Because you liked" approach)
        if (highlyRatedItems.length > 0) {
            // Pick up to 3 random favorites to diversify
            const seeds = [...highlyRatedItems].sort(() => 0.5 - Math.random()).slice(0, 3);
            
            for (const seed of seeds) {
                const tmdbId = await resolveTMDBId(seed);
                const type = seed.mediaType === 'series' ? 'tv' : 'movie';
                if (tmdbId) {
                    fetchPromises.push(axios.get(`${BASE_URL}/${type}/${tmdbId}/recommendations`, {
                        params: { api_key: TMDB_API_KEY }
                    }).catch(() => null));
                }
            }
        }

        // Parallel fetch
        const responses = await Promise.all(fetchPromises);
        
        // 4. Blend and De-duplicate
        let blend = [];
        responses.forEach(res => {
            if (res && res.data && res.data.results) {
                // Add mediaType if it's missing (for discover/movie vs tv)
                const isTv = res.config.url.includes('/tv');
                const items = res.data.results.map(item => ({
                    ...item,
                    media_type: item.media_type || (isTv ? 'tv' : 'movie')
                }));
                blend = blend.concat(items);
            }
        });

        // 5. Build unique and map
        const uniqueItems = new Map();
        const existingTitles = new Set(userLibrary.map(m => m.title?.toLowerCase().trim()));

        blend.forEach(item => {
            const title = item.title || item.name;
            const normTitle = title?.toLowerCase().trim();
            // FILTER: Do not include if the user already has it in their library!
            if (!normTitle || existingTitles.has(normTitle)) return;

            if (!uniqueItems.has(item.id)) {
                uniqueItems.set(item.id, {
                    id: item.id,
                    title: title,
                    year: (item.release_date || item.first_air_date || '').split('-')[0],
                    poster: item.poster_path ? `https://image.tmdb.org/t/p/w400${item.poster_path}` : '',
                    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '',
                    mediaType: item.media_type === 'tv' ? 'series' : 'movie',
                    rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
                    overview: item.overview,
                    genreIds: item.genre_ids || [],
                    popularity: item.popularity
                });
            } else {
                // Boost popularity if recommended multiple times
                const existing = uniqueItems.get(item.id);
                existing.popularity += 100;
            }
        });

        // Sort by blended popularity Score
        const finalResults = Array.from(uniqueItems.values())
            .filter(i => i.poster) // Only visual items
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 48); // Top 48 for nice grid sizing

        return finalResults;
    } catch (e) {
        console.error('Error generating personalized feed:', e);
        return [];
    }
};
