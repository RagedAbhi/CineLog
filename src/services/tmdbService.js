import axios from 'axios';

const TMDB_API_KEY = process.env.REACT_APP_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Searches for a movie or TV show on TMDB and fetches its watch providers (OTT).
 * @param {string} title 
 * @param {string} type - 'movie' or 'series'
 * @param {number|string} year 
 */
export const fetchStreamingAvailability = async (title, type, year, imdbID = null) => {
    if (!TMDB_API_KEY || TMDB_API_KEY === 'your_tmdb_api_key_here') {
        return { error: 'NO_API_KEY' };
    }

    try {
        let tmdbId = null;
        const tmdbType = type === 'series' ? 'tv' : 'movie';

        // 1. If imdbID is provided, use it for direct lookup (most accurate)
        if (imdbID) {
            const findResponse = await axios.get(`${BASE_URL}/find/${imdbID}`, {
                params: {
                    api_key: TMDB_API_KEY,
                    external_source: 'imdb_id'
                }
            });
            const findResult = (type === 'series' ? findResponse.data.tv_results : findResponse.data.movie_results)?.[0];
            if (findResult) tmdbId = findResult.id;
        }

        // 2. Fallback to search if no imdbID or find failed
        if (!tmdbId) {
            const searchResponse = await axios.get(`${BASE_URL}/search/${tmdbType}`, {
                params: {
                    api_key: TMDB_API_KEY,
                    query: title,
                    year: year // for movies
                    // first_air_date_year: year // for TV shows (optional refinement)
                }
            });
            const searchResult = searchResponse.data.results[0];
            if (searchResult) tmdbId = searchResult.id;
        }

        if (!tmdbId) return null;

        // 2. Fetch watch providers
        const providersResponse = await axios.get(`${BASE_URL}/${tmdbType}/${tmdbId}/watch/providers`, {
            params: {
                api_key: TMDB_API_KEY
            }
        });

        // 3. Filter for India (IN)
        const indiaProviders = providersResponse.data.results?.IN;
        if (!indiaProviders) return null;

        // Combine flatrate (streaming), ads, rent, and buy
        const allProviders = [
            ...(indiaProviders.flatrate || []),
            ...(indiaProviders.ads || []),
            ...(indiaProviders.buy || []),
            ...(indiaProviders.rent || [])
        ];

        if (allProviders.length > 0) {
            console.log('TMDB Providers found for India:', allProviders.map(p => p.provider_name).join(', '));
        }

        // 4. Map to requested platforms and remove duplicates
        const platformMap = {
            'Netflix': 'Netflix',
            'Amazon Prime Video': 'Amazon Prime',
            'Amazon Prime Video with Ads': 'Amazon Prime',
            'Prime Video': 'Amazon Prime',
            'Amazon Video': 'Amazon Prime',
            'Disney Plus Hotstar': 'Hotstar',
            'Disney+ Hotstar': 'Hotstar',
            'JioHotstar': 'Hotstar',
            'Hotstar': 'Hotstar',
            'Zee5': 'Zee5',
            'ZEE5': 'Zee5',
            'Sony Liv': 'SonyLiv',
            'Sony LIV': 'SonyLiv',
            'SonyLiv': 'SonyLiv',
            'Apple TV': 'AppleTV',
            'Apple TV Plus': 'AppleTV',
            'Apple TV+': 'AppleTV',
            'Rakuten Viki': 'Rakuten Viki',
            'Viki': 'Rakuten Viki',
            'JioCinema': 'JioCinema',
            'Jio Cinema': 'JioCinema',
            'Jio': 'JioCinema',
            'YouTube': 'YouTube',
            'YouTube Premium': 'YouTube'
        };

        const uniqueProviders = [];
        const seenNames = new Set();
        const encodedTitle = encodeURIComponent(title);

        const platformSearchUrls = {
            'Netflix': 'https://www.netflix.com/search?q=',
            'Amazon Prime': 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=',
            'Hotstar': 'https://www.hotstar.com/in/explore?search_query=',
            'Zee5': 'https://www.zee5.com/search?q=',
            'SonyLiv': 'https://www.sonyliv.com/search?q=',
            'AppleTV': 'https://tv.apple.com/in/search?term=',
            'Rakuten Viki': 'https://www.viki.com/search?q=',
            'JioCinema': 'https://www.jiocinema.com/search/',
            'YouTube': 'https://www.youtube.com/results?search_query='
        };

        allProviders.forEach(p => {
            const mappedName = platformMap[p.provider_name];
            if (mappedName && !seenNames.has(mappedName)) {
                const searchBase = platformSearchUrls[mappedName];
                const directLink = searchBase ? `${searchBase}${encodedTitle}` : indiaProviders.link;

                uniqueProviders.push({
                    name: mappedName,
                    logo: `https://image.tmdb.org/t/p/original${p.logo_path}`,
                    link: directLink
                });
                seenNames.add(mappedName);
            }
        });

        return uniqueProviders;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            return { error: 'INVALID_API_KEY' };
        }
        console.error('Error fetching from TMDB:', error);
        return null;
    }
};
