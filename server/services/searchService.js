const axios = require('axios');
const https = require('https');
const SearchCache = require('../models/SearchCache');
const UserBehavior = require('../models/UserBehavior');
const Media = require('../models/Media');
const Friendship = require('../models/Friendship');
const algoliaService = require('./algoliaService');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_API_KEY = process.env.WATCHMODE_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';
const WATCHMODE_BASE = 'https://api.watchmode.com/v1';

// Force IPv4 to prevent ECONNRESET connection drops from TMDB via ISP routing
const httpsAgent = new https.Agent({ family: 4 });

const CACHE_TTL_HOURS = 24;

const GENRE_MAP = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
    10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10765: 'Sci-Fi & Fantasy',
    10768: 'War & Politics'
};

// Genre keywords for query intent detection
const GENRE_KEYWORDS = {
    'action': 28, 'adventure': 12, 'animation': 16, 'animated': 16,
    'comedy': 35, 'comic': 35, 'funny': 35, 'humour': 35, 'humor': 35,
    'crime': 80, 'documentary': 99, 'docuseries': 99,
    'drama': 18, 'dramatic': 18, 'family': 10751,
    'fantasy': 14, 'horror': 27, 'scary': 27, 'thriller': 53,
    'suspense': 53, 'romance': 10749, 'romantic': 10749, 'love story': 10749,
    'sci-fi': 878, 'scifi': 878, 'science fiction': 878, 'mystery': 9648,
    'war': 10752, 'western': 37, 'historical': 36, 'history': 36,
    'musical': 10402, 'music': 10402,
    'sad': 18, 'feel-good': 35, 'feelgood': 35, 'dark': 80,
    'intense': 53, 'heartwarming': 10751, 'mind-bending': 878, 'mindbending': 878,
    'psychological': 53, 'supernatural': 27, 'dystopian': 878, 'heist': 80,
    'spy': 28, 'martial arts': 28, 'superhero': 28
};

// WatchMode provider name normalization map
const WATCHMODE_NAME_MAP = {
    'Netflix': 'Netflix',
    'Amazon Prime Video': 'Amazon Prime',
    'Prime Video': 'Amazon Prime',
    'Disney Plus': 'Hotstar',
    'Disney+': 'Hotstar',
    'Disney Plus Hotstar': 'Hotstar',
    'Disney+ Hotstar': 'Hotstar',
    'JioHotstar': 'Hotstar',
    'Jio Cinema': 'JioCinema',
    'JioCinema': 'JioCinema',
    'Sony Liv': 'SonyLiv',
    'SonyLIV': 'SonyLiv',
    'Zee5': 'Zee5',
    'ZEE5': 'Zee5',
    'Apple TV Plus': 'AppleTV',
    'Apple TV+': 'AppleTV',
    'YouTube Premium': 'YouTube',
    'YouTube': 'YouTube',
    'Rakuten Viki': 'Viki',
    'Viki': 'Viki',
    'HBO Max': 'HBO',
    'Max': 'HBO',
    'HBO': 'HBO',
    'HBO GO': 'HBO'
};

// Static fallback map to prevent TMDB network drops (ECONNRESET) from wiping logos
const STATIC_LOGO_MAP = {
    'Netflix': 'https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg',
    'Amazon Prime Video': 'https://image.tmdb.org/t/p/original/dQeAar5H991VYporEjUjwVJZZN3.jpg',
    'Amazon Prime': 'https://image.tmdb.org/t/p/original/dQeAar5H991VYporEjUjwVJZZN3.jpg',
    'Hotstar': 'https://image.tmdb.org/t/p/original/rTFA413eI6L85a81I2o86L5eI4a.jpg',
    'JioHotstar': 'https://image.tmdb.org/t/p/original/rTFA413eI6L85a81I2o86L5eI4a.jpg',
    'Zee5': 'https://image.tmdb.org/t/p/original/5tp1fWaH4k6W4lH2xRto79kH6nQ.jpg',
    'SonyLiv': 'https://image.tmdb.org/t/p/original/9rM1r7NIn3S6xIunInhOaZk7qL7.jpg',
    'JioCinema': 'https://image.tmdb.org/t/p/original/9O17qL8AAM2D12rV5oK96s6a6q9.jpg',
    'Apple TV Plus': 'https://image.tmdb.org/t/p/original/2E0icoIXgJCWEaXbK1X1LgksHGH.jpg',
    'AppleTV': 'https://image.tmdb.org/t/p/original/2E0icoIXgJCWEaXbK1X1LgksHGH.jpg',
    'YouTube Premium': 'https://image.tmdb.org/t/p/original/qZ2JpUf1X1I0Z2q2XU0bOQ3FhE7.jpg',
    'YouTube': 'https://image.tmdb.org/t/p/original/pTnn5JwWr4p3pG8H6VrpiQo7Vs0.jpg',
    'Google Play Movies': 'https://image.tmdb.org/t/p/original/8z7rC8uIDaTM91X0ZfkRf04ydj2.jpg',
    'Amazon Video': 'https://image.tmdb.org/t/p/original/qR6FKvnPBx2O37FDg8PNM7efwF3.jpg',
    'Apple TV Store': 'https://image.tmdb.org/t/p/original/SPnB1qiCkYfirS2it3hZORwGVn.jpg',
    'Lionsgate Play': 'https://image.tmdb.org/t/p/original/wzM0YgB7MkiXhV5r6wI3qjVjV8M.jpg',
    'MUBI': 'https://image.tmdb.org/t/p/original/v5L0hT3H8xH14M4g7lUf4k14zI.jpg',
    'Viki': 'https://image.tmdb.org/t/p/original/mXGhoC2Gwea1Z6cZg0aB2k6S73u.jpg',
    'HBO': 'https://image.tmdb.org/t/p/original/6xOMzJADgIADjN5ApeL8aP3pAts.jpg'
};

const getProviderLogoMap = async () => {
    return STATIC_LOGO_MAP;
};

/**
 * Fetch streaming providers for a movie/show.
 * imdbID can be a proper IMDB ID (tt...) or a TMDB numeric ID — both handled.
 * title/year used as TMDB title-search fallback when ID lookup fails.
 * Primary: WatchMode (direct links). Fallback: TMDB.
 * Results are cached in MongoDB for 48 hours.
 */
exports.getProvidersByImdbId = async (imdbID, title, type, year) => {
    // Use a cache key that captures whichever identifier is available
    const cacheKey = `providers_${imdbID || `title_${title}_${year}`}`;
    const cached = await SearchCache.findOne({ query: cacheKey, expiresAt: { $gt: new Date() } });
    if (cached) return cached.results;

    let providers = [];

    // --- Primary: WatchMode (only works with proper IMDB IDs: tt...) ---
    const isProperImdbId = imdbID && /^tt\d+$/.test(imdbID);

    if (WATCHMODE_API_KEY && isProperImdbId) {
        try {
            const searchRes = await axios.get(`${WATCHMODE_BASE}/search/`, {
                params: { apiKey: WATCHMODE_API_KEY, search_field: 'imdb_id', search_value: imdbID }
            });
            const titleResult = searchRes.data.title_results?.[0];

            if (titleResult) {
                const [sourcesRes, logoMap] = await Promise.all([
                    axios.get(`${WATCHMODE_BASE}/title/${titleResult.id}/sources/`, {
                        params: { apiKey: WATCHMODE_API_KEY, regions: 'IN' }
                    }),
                    getProviderLogoMap()
                ]);

                const seen = new Set();
                (sourcesRes.data || []).forEach(s => {
                    const mappedName = WATCHMODE_NAME_MAP[s.name];
                    if (!mappedName || seen.has(mappedName) || !s.web_url) return;

                    // Logo: try exact, mapped name, partial match, or omit — never block the provider
                    const logo = logoMap[s.name]
                        || logoMap[mappedName]
                        || Object.entries(logoMap).find(([k]) =>
                            k.toLowerCase().includes(mappedName.toLowerCase())
                        )?.[1]
                        || null;

                    providers.push({ name: mappedName, logo, link: s.web_url });
                    seen.add(mappedName);
                });
            }
        } catch (e) {
            console.error('[SearchService] WatchMode lookup failed:', e.message);
        }
    }

    // --- Fallback: TMDB ---
    if (providers.length === 0) {
        providers = await fetchTMDBProviders(imdbID, title, type, year);
    }

    // Cache for 48 hours (only cache non-empty results to allow retry on failure)
    if (providers.length > 0) {
        await SearchCache.findOneAndUpdate(
            { query: cacheKey },
            {
                query: cacheKey,
                results: providers,
                expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
            },
            { upsert: true }
        );
    }

    return providers;
};

/**
 * TMDB provider fallback — handles proper IMDB IDs (tt...), TMDB numeric IDs,
 * and title+year search fallback for items with no valid ID.
 */
const fetchTMDBProviders = async (imdbID, title, type, year) => {
    if (!TMDB_API_KEY) return [];
    try {
        let tmdbId = null;
        let tmdbType = type === 'series' ? 'tv' : 'movie';

        if (imdbID && /^tt\d+$/.test(imdbID)) {
            // Proper IMDB ID → use /find endpoint
            const findRes = await axios.get(`${BASE_URL}/find/${imdbID}`, {
                httpsAgent,
                params: { api_key: TMDB_API_KEY, external_source: 'imdb_id' }
            });
            const tmdbItem = findRes.data.movie_results?.[0] || findRes.data.tv_results?.[0];
            if (tmdbItem) {
                tmdbId = tmdbItem.id;
                tmdbType = findRes.data.tv_results?.length > 0 ? 'tv' : 'movie';
            }
        } else if (imdbID && /^\d+$/.test(imdbID)) {
            // Numeric ID → treat as TMDB ID directly
            tmdbId = imdbID;
        }

        // Title+year fallback when ID lookup failed or no ID provided
        if (!tmdbId && title) {
            const cleanYear = year ? String(year).match(/\d{4}/)?.[0] : null;
            const searchParams = { api_key: TMDB_API_KEY, query: title, include_adult: false };
            if (cleanYear) {
                if (tmdbType === 'movie') searchParams.year = cleanYear;
                else searchParams.first_air_date_year = cleanYear;
            }
            const searchRes = await axios.get(`${BASE_URL}/search/${tmdbType}`, {
                httpsAgent, params: searchParams
            });
            const result = searchRes.data.results?.[0];
            if (result) tmdbId = result.id;
        }

        if (!tmdbId) return [];

        const providersRes = await axios.get(`${BASE_URL}/${tmdbType}/${tmdbId}/watch/providers`, {
            httpsAgent, params: { api_key: TMDB_API_KEY }
        });

        const india = providersRes.data.results?.IN;
        if (!india) return [];

        const titleEncoded = encodeURIComponent(title || '');
        const searchUrls = {
            'Netflix': `https://www.netflix.com/search?q=${titleEncoded}`,
            'Amazon Prime': `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${titleEncoded}`,
            'Hotstar': `https://www.hotstar.com/in/explore?search_query=${titleEncoded}`,
            'Zee5': `https://www.zee5.com/search?q=${titleEncoded}`,
            'SonyLiv': `https://www.sonyliv.com/search?q=${titleEncoded}`,
            'JioCinema': `https://www.jiocinema.com/search/${titleEncoded}`,
            'AppleTV': `https://tv.apple.com/in/search?term=${titleEncoded}`,
            'YouTube': `https://www.youtube.com/results?search_query=${titleEncoded}`
        };

        const allRaw = [
            ...(india.flatrate || []), ...(india.ads || []),
            ...(india.buy || []), ...(india.rent || [])
        ];

        const tmdbPlatformMap = {
            'Netflix': 'Netflix', 'Amazon Prime Video': 'Amazon Prime',
            'Amazon Prime Video with Ads': 'Amazon Prime', 'Prime Video': 'Amazon Prime',
            'Disney Plus Hotstar': 'Hotstar', 'Disney+ Hotstar': 'Hotstar',
            'JioHotstar': 'Hotstar', 'Zee5': 'Zee5', 'ZEE5': 'Zee5',
            'Sony Liv': 'SonyLiv', 'Sony LIV': 'SonyLiv', 'SonyLIV': 'SonyLiv',
            'Jio Cinema': 'JioCinema', 'JioCinema': 'JioCinema',
            'Apple TV+': 'AppleTV', 'Apple TV': 'AppleTV', 'Apple TV Plus': 'AppleTV',
            'YouTube': 'YouTube', 'YouTube Premium': 'YouTube',
            'Rakuten Viki': 'Viki', 'Viki': 'Viki',
            'HBO Max': 'HBO', 'Max': 'HBO', 'HBO': 'HBO', 'HBO GO': 'HBO'
        };

        const seen = new Set();
        return allRaw.reduce((acc, p) => {
            const mapped = tmdbPlatformMap[p.provider_name];
            if (mapped && !seen.has(mapped)) {
                acc.push({
                    name: mapped,
                    logo: `https://image.tmdb.org/t/p/original${p.logo_path}`,
                    link: searchUrls[mapped] || india.link
                });
                seen.add(mapped);
            }
            return acc;
        }, []);
    } catch (e) {
        console.error('[SearchService] TMDB provider fallback failed:', e.message);
        return [];
    }
};

/**
 * Parse a search query for structured intent (genre keywords, year/decade).
 * Returns { genres: [tmdbGenreId], yearRange: { gte, lte } | null }
 */
const parseQueryIntent = (query) => {
    const lower = query.toLowerCase();
    const intent = { genres: [], yearRange: null };

    // Decade: "90s", "1990s", "2000s"
    const decadeMatch = lower.match(/\b(19|20)(\d{2})s\b/);
    if (decadeMatch) {
        const decade = parseInt(decadeMatch[0]);
        intent.yearRange = { gte: `${decade}-01-01`, lte: `${decade + 9}-12-31` };
    } else {
        // Exact year: "1999", "2010"
        const yearMatch = lower.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            const year = yearMatch[0];
            intent.yearRange = { gte: `${year}-01-01`, lte: `${year}-12-31` };
        }
    }

    // Genre / mood keywords
    for (const [keyword, genreId] of Object.entries(GENRE_KEYWORDS)) {
        if (lower.includes(keyword) && !intent.genres.includes(genreId)) {
            intent.genres.push(genreId);
        }
    }

    return intent;
};

/**
 * Build a real-time taste profile from the user's watched + rated library.
 * Returns { genreScores: { genreName: weightedScore }, maxScore }
 */
const buildTasteProfile = async (userId) => {
    const watched = await Media.find(
        { userId, status: 'watched' },
        { genre: 1, rating: 1 }
    );

    const genreScores = {};
    watched.forEach(m => {
        if (!m.genre) return;
        const weight = m.rating || 5; // default weight 5 if unrated
        m.genre.split(/[,/]/).map(g => g.trim()).filter(Boolean).forEach(g => {
            genreScores[g] = (genreScores[g] || 0) + weight;
        });
    });

    const maxScore = Math.max(...Object.values(genreScores), 1);
    return { genreScores, maxScore };
};

/**
 * Main Search Proxy with Caching and Personalization
 */
exports.searchMulti = async (query, type, userId) => {
    const cacheKey = `search_${type || 'all'}_${query.toLowerCase().trim()}`;

    // 1. Check MongoDB Cache
    const cached = await SearchCache.findOne({ query: cacheKey, expiresAt: { $gt: new Date() } });
    let rawResults;

    if (cached) {
        rawResults = cached.results;
    } else {
        // 2. Detect query intent for parallel discover call
        const intent = parseQueryIntent(query);
        const hasIntent = intent.genres.length > 0 || intent.yearRange !== null;

        // 3. Build fetch promises
        let endpoint = '/search/multi';
        if (type === 'movie') endpoint = '/search/movie';
        else if (type === 'tv') endpoint = '/search/tv';
        else if (type === 'person') endpoint = '/search/person';

        const fetchPromises = [
            axios.get(`${BASE_URL}${endpoint}`, {
                httpsAgent,
                params: {
                    api_key: TMDB_API_KEY,
                    query,
                    include_adult: false,
                    language: 'en-US',
                    page: 1
                }
            }),
            algoliaService.searchAlgolia(query)
        ];

        // Parallel discover call if intent detected
        if (hasIntent && type !== 'person') {
            const discoverType = type === 'tv' ? 'tv' : 'movie';
            const discoverParams = {
                api_key: TMDB_API_KEY,
                sort_by: 'popularity.desc',
                include_adult: false,
                language: 'en-US'
            };
            if (intent.genres.length > 0) {
                discoverParams.with_genres = intent.genres.join(',');
            }
            if (intent.yearRange) {
                if (discoverType === 'movie') {
                    discoverParams['primary_release_date.gte'] = intent.yearRange.gte;
                    discoverParams['primary_release_date.lte'] = intent.yearRange.lte;
                } else {
                    discoverParams['first_air_date.gte'] = intent.yearRange.gte;
                    discoverParams['first_air_date.lte'] = intent.yearRange.lte;
                }
            }
            fetchPromises.push(
                axios.get(`${BASE_URL}/discover/${discoverType}`, { httpsAgent, params: discoverParams })
                    .catch(() => null)
            );
        }

        const [tmdbResponse, algoliaHits, discoverResponse] = await Promise.all(fetchPromises);

        rawResults = tmdbResponse.data.results;

        // --- Director intent injection ---
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
                injectedDirectedMovies = creditsRes.data.crew
                    .filter(c => c.job === 'Director')
                    .sort((a, b) => b.popularity - a.popularity)
                    .slice(0, 5)
                    .map(m => ({ ...m, media_type: 'movie', popularity: m.popularity + 500 }));
            } catch (err) {
                console.error('[Search] Failed to fetch director credits', err);
            }
        }

        if (injectedDirectedMovies.length > 0) {
            const rawIds = new Set(rawResults.map(r => r.id.toString()));
            rawResults = [
                ...injectedDirectedMovies.filter(m => !rawIds.has(m.id.toString())),
                ...rawResults
            ];
        }

        // --- Merge Algolia hits (typo tolerance) ---
        if (algoliaHits && algoliaHits.length > 0) {
            const tmdbIds = new Set(rawResults.map(r => r.id.toString()));
            let algoliaMapped = algoliaHits
                .filter(hit => !tmdbIds.has(hit.objectID))
                .filter(hit => !type || type === 'all' || hit.mediaType === type);

            if (topPerson && topPerson.known_for_department === 'Directing') {
                algoliaMapped = algoliaMapped.filter(hit => {
                    if (hit.director?.toLowerCase().includes(query.toLowerCase())) return true;
                    if (hit.cast?.some(c => c.toLowerCase().includes(query.toLowerCase()))) return false;
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
                popularity: (hit.popularity || 0) + 1000
            }));

            rawResults = [...algoliaMapped, ...rawResults];
        }

        // --- Merge discover results (intent-based) ---
        if (discoverResponse?.data?.results?.length > 0) {
            const existingIds = new Set(rawResults.map(r => r.id.toString()));
            const discoverMapped = discoverResponse.data.results
                .filter(r => !existingIds.has(r.id.toString()))
                .slice(0, 10)
                .map(r => ({
                    ...r,
                    media_type: type === 'tv' ? 'tv' : 'movie',
                    popularity: r.popularity * 0.7  // moderate boost — below exact matches
                }));
            rawResults = [...rawResults, ...discoverMapped];
        }

        // Inject media_type for specific-type searches
        if (type && type !== 'all') {
            rawResults = rawResults.map(r => ({ ...r, media_type: type === 'tv' ? 'tv' : type }));
        }

        // 4. Cache raw results
        await SearchCache.findOneAndUpdate(
            { query: cacheKey },
            {
                query: cacheKey,
                results: rawResults,
                expiresAt: new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000)
            },
            { upsert: true }
        );
    }

    // 5. Personalize
    const processed = await processResults(rawResults, userId);

    return {
        all: processed,
        movies: processed.filter(item => item.mediaType === 'movie'),
        tvShows: processed.filter(item => item.mediaType === 'series'),
        people: processed.filter(item => item.mediaType === 'person')
    };
};

/**
 * Personalization + scoring pass.
 * Runs after cache fetch so every user gets individually ranked results.
 */
async function processResults(results, userId) {
    const [tasteProfile, friends, userLibrary] = await Promise.all([
        buildTasteProfile(userId),
        Friendship.find({
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted'
        }),
        Media.find({ userId }).select('imdbID title mediaType status')
    ]);

    const friendIds = friends.map(f =>
        f.requester.toString() === userId.toString() ? f.recipient : f.requester
    );

    // Map raw TMDB/Algolia items to our standard shape
    const mapped = results.map(item => {
        if (item.media_type === 'person') {
            return {
                id: item.id,
                name: item.name,
                image: item.profile_path ? `https://image.tmdb.org/t/p/w200${item.profile_path}` : null,
                mediaType: 'person',
                knownFor: item.known_for?.map(m => m.title || m.name).join(', '),
                popularity: item.popularity
            };
        }

        const mapped = mapMediaItem(item);

        // Mark library status
        const normalizedTitle = mapped.title.toLowerCase().trim();
        const existing = userLibrary.find(lib =>
            (lib.imdbID && lib.imdbID === String(mapped.id)) ||
            (lib.title.toLowerCase().trim() === normalizedTitle && lib.mediaType === mapped.mediaType)
        );
        if (existing) {
            mapped.libraryStatus = existing.status;
            mapped.libraryId = existing._id;
        }

        return mapped;
    });

    // Score each media item
    const { genreScores, maxScore } = tasteProfile;

    // Batch friend activity query — one DB call for all results instead of N calls
    const nonPersonResults = mapped.filter(i => i.mediaType !== 'person');
    const titles = [...new Set(nonPersonResults.map(i => i.title))];

    const friendWatched = friendIds.length > 0 && titles.length > 0
        ? await Media.find({
            $or: [
                { title: { $in: titles }, userId: { $in: friendIds } }
            ]
          }).populate('userId', 'username name').lean()
        : [];

    // Build friend activity map keyed by title (normalized)
    const friendActivityMap = {};
    friendWatched.forEach(fw => {
        const key = fw.title.toLowerCase().trim();
        if (!friendActivityMap[key]) friendActivityMap[key] = [];
        friendActivityMap[key].push(fw);
    });

    // Apply scores
    for (const item of mapped) {
        if (item.mediaType === 'person') continue;

        let score = 0;

        // 1. Taste profile genre match (proportional to user preference strength)
        if (item.genreIds?.length > 0 && Object.keys(genreScores).length > 0) {
            const genreNames = item.genreIds.map(id => GENRE_MAP[id]).filter(Boolean);
            const genreBoost = genreNames.reduce((sum, g) => {
                return sum + ((genreScores[g] || 0) / maxScore) * 15;
            }, 0);
            score += Math.min(genreBoost, 15); // cap at 15
        }

        // 2. Click history repeat interest
        // (UserBehavior still logged — keep the signal even though preferredGenres is replaced)
        // No lookup here to avoid extra DB call; this was always lightweight

        // 3. Friend activity (fixed: title-based match)
        const titleKey = item.title?.toLowerCase().trim();
        const friendsWhoWatched = friendActivityMap[titleKey] || [];
        if (friendsWhoWatched.length > 0) {
            score += friendsWhoWatched.length * 3;
            item.socialMetadata = {
                count: friendsWhoWatched.length,
                friends: friendsWhoWatched.slice(0, 2).map(f => f.userId?.name || f.userId?.username),
                text: `${friendsWhoWatched.length} friend${friendsWhoWatched.length > 1 ? 's' : ''} watched this`
            };
        }

        // 4. Global popularity (tie-breaker)
        score += Math.min((item.popularity || 0) / 10, 10);

        item.personalizationScore = score;
    }

    return mapped.sort((a, b) => (b.personalizationScore || 0) - (a.personalizationScore || 0));
}

/**
 * [NEW] Generates a personalized discovery feed for the user.
 * 1. Analyzes library via buildTasteProfile.
 * 2. Fetches candidates via TMDB Discover (genres) and Recommendations (high-rated seeds).
 * 3. Filters out already owned/watched items.
 * 4. Ranks via processResults for social and personalized weighting.
 */
exports.getDiscoveryFeed = async (userId, page = 1, limit = 20) => {
    const cacheKey = `discover_trending_${userId}`;
    const cached = await SearchCache.findOne({ query: cacheKey, expiresAt: { $gt: new Date() } });
    
    // Calculate slice indices
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    if (cached) {
        return cached.results.slice(startIndex, endIndex);
    }

    try {
        const userLibrary = await Media.find({ userId }).select('title').lean();
        const libraryTitles = new Set(userLibrary.map(m => m.title?.toLowerCase().trim()));

        // Fetch Trending Movies and TV for the week (Top 5 pages for a larger pool)
        const fetchPromises = [];
        for (let i = 1; i <= 5; i++) {
            fetchPromises.push(axios.get(`${BASE_URL}/trending/movie/week`, { httpsAgent, params: { api_key: TMDB_API_KEY, page: i } }));
            fetchPromises.push(axios.get(`${BASE_URL}/trending/tv/week`, { httpsAgent, params: { api_key: TMDB_API_KEY, page: i } }));
        }

        const responses = await Promise.allSettled(fetchPromises);
        
        let trendingMovies = [];
        let trendingTv = [];

        responses.forEach((res, index) => {
            if (res.status === 'fulfilled' && res.value?.data?.results) {
                // Even indices are movies, odd are TV shows
                if (index % 2 === 0) trendingMovies.push(...res.value.data.results);
                else trendingTv.push(...res.value.data.results);
            }
        });

        // Interleave Movie and TV results for 50/50 variety
        let blend = [];
        const maxLen = Math.max(trendingMovies.length, trendingTv.length);
        for (let i = 0; i < maxLen; i++) {
            if (trendingMovies[i]) blend.push({ ...trendingMovies[i], media_type: 'movie' });
            if (trendingTv[i]) blend.push({ ...trendingTv[i], media_type: 'tv' });
        }

        // Deduplicate and filter out library items
        const uniqueItems = new Map();
        blend.forEach(item => {
            const title = item.title || item.name;
            if (!title || libraryTitles.has(title.toLowerCase().trim())) return;
            if (!item.poster_path) return;

            if (!uniqueItems.has(item.id)) {
                uniqueItems.set(item.id, item);
            }
        });

        // Re-rank slightly based on social signals (friends who watched)
        const candidates = Array.from(uniqueItems.values());
        const processed = await processResults(candidates, userId);

        // Cache up to 200 items for 12 hours
        const resultsToCache = processed.slice(0, 200);

        await SearchCache.findOneAndUpdate(
            { query: cacheKey },
            { query: cacheKey, results: resultsToCache, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) },
            { upsert: true }
        );

        return resultsToCache.slice(startIndex, endIndex);
    } catch (error) {
        console.error('[SearchService] Trending Feed failed:', error.message);
        return [];
    }
};

/**
 * Fetch Person Filmography
 */
exports.getPersonDetails = async (personId) => {
    const cacheKey = `person_${personId}`;
    const cached = await SearchCache.findOne({ query: cacheKey, expiresAt: { $gt: new Date() } });
    if (cached) return cached.results;

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

    await SearchCache.findOneAndUpdate(
        { query: cacheKey },
        {
            query: cacheKey,
            results,
            expiresAt: new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000)
        },
        { upsert: true }
    );

    return results;
};

/**
 * Fetch Streaming Availability (Watch Providers) — used by legacy route
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
        return {
            flatrate: providers.flatrate?.map(p => ({ name: p.provider_name, logo: `https://image.tmdb.org/t/p/original${p.logo_path}` })) || [],
            rent: providers.rent?.map(p => ({ name: p.provider_name, logo: `https://image.tmdb.org/t/p/original${p.logo_path}` })) || [],
            buy: providers.buy?.map(p => ({ name: p.provider_name, logo: `https://image.tmdb.org/t/p/original${p.logo_path}` })) || [],
            link: providers.link
        };
    } catch (err) {
        console.error('[SearchService] Error fetching watch providers:', err);
        return null;
    }
};

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

/**
 * [NEW] Fetch full details for a media item from TMDB
 */
const getTMDBDetails = async (id, type) => {
    try {
        const tmdbType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
        const response = await axios.get(`${BASE_URL}/${tmdbType}/${id}`, {
            httpsAgent,
            params: { api_key: TMDB_API_KEY, append_to_response: 'credits' }
        });
        const item = response.data;
        return {
            plot: item.overview,
            genre: item.genres?.map(g => g.name).join(', '),
            director: item.credits?.crew?.find(c => c.job === 'Director' || c.job === 'Executive Producer')?.name || '',
            cast: item.credits?.cast?.slice(0, 5).map(c => c.name).join(', '),
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            year: (item.release_date || item.first_air_date || '').split('-')[0],
            language: item.original_language
        };
    } catch (e) {
        return null;
    }
};

/**
 * [NEW] Fetch missing details from OMDB API (Fallback)
 */
const getOMDBDetails = async (imdbID) => {
    try {
        const OMDB_KEY = process.env.OMDB_API_KEY || process.env.REACT_APP_OMDB_API_KEY;
        if (!OMDB_KEY) return null;

        const response = await axios.get(`https://www.omdbapi.com/?i=${imdbID}&plot=full&apikey=${OMDB_KEY}`);
        if (response.data.Response === 'False') return null;

        return {
            plot: response.data.Plot !== 'N/A' ? response.data.Plot : null,
            genre: response.data.Genre !== 'N/A' ? response.data.Genre : null,
            director: response.data.Director !== 'N/A' ? response.data.Director : null,
            cast: response.data.Actors !== 'N/A' ? response.data.Actors : null,
            year: response.data.Year?.match(/\d{4}/)?.[0]
        };
    } catch (e) {
        return null;
    }
};

/**
 * [NEW] Enrichment helper for the healing script.
 * Tries TMDB first, then OMDB, then merges findings.
 */
exports.enrichMediaMetadata = async (media) => {
    let enrichment = null;

    // 1. Try TMDB via imdbID resolution
    if (media.imdbID) {
        let tmdbId = null;
        if (/^\d+$/.test(media.imdbID)) {
             tmdbId = media.imdbID;
        } else if (/^tt\d+$/.test(media.imdbID)) {
            try {
                const findRes = await axios.get(`${BASE_URL}/find/${media.imdbID}`, {
                    httpsAgent,
                    params: { api_key: TMDB_API_KEY, external_source: 'imdb_id' }
                });
                const result = media.mediaType === 'series' ? findRes.data.tv_results?.[0] : findRes.data.movie_results?.[0];
                if (result) tmdbId = result.id;
            } catch (e) {}
        }

        if (tmdbId) {
            enrichment = await getTMDBDetails(tmdbId, media.mediaType);
        }
    }

    // 2. Fallback to OMDB
    if (!enrichment && media.imdbID && /^tt\d+$/.test(media.imdbID)) {
        enrichment = await getOMDBDetails(media.imdbID);
    }

    // 3. Last resort: Search by title on OMDB if plot is still missing
    if ((!enrichment || !enrichment.plot) && media.title) {
        try {
            const OMDB_KEY = process.env.OMDB_API_KEY || process.env.REACT_APP_OMDB_API_KEY;
            const searchRes = await axios.get(`https://www.omdbapi.com/?t=${encodeURIComponent(media.title)}&y=${media.year || ''}&apikey=${OMDB_KEY}`);
            if (searchRes.data.Response !== 'False') {
                const omdb = searchRes.data;
                enrichment = {
                    ...enrichment,
                    plot: omdb.Plot !== 'N/A' ? omdb.Plot : (enrichment?.plot || null),
                    genre: omdb.Genre !== 'N/A' ? omdb.Genre : (enrichment?.genre || null),
                    director: omdb.Director !== 'N/A' ? omdb.Director : (enrichment?.director || null),
                    cast: omdb.Actors !== 'N/A' ? omdb.Actors : (enrichment?.cast || null)
                };
            }
        } catch (e) {}
    }

    return enrichment;
};
