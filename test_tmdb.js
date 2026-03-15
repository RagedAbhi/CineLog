const axios = require('axios');
const TMDB_API_KEY = '94835791ed031d251f3bee9230a18e18';
const BASE_URL = 'https://api.themoviedb.org/3';

async function test() {
    try {
        const searchResponse = await axios.get(`${BASE_URL}/search/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                query: 'Inception',
                year: 2010
            }
        });
        const tmdbId = searchResponse.data.results[0].id;
        console.log("TMDB ID:", tmdbId);

        const providersResponse = await axios.get(`${BASE_URL}/movie/${tmdbId}/watch/providers`, {
            params: { api_key: TMDB_API_KEY }
        });

        const indiaProviders = providersResponse.data.results?.IN;
        console.log("India Providers:", JSON.stringify(indiaProviders, null, 2));
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
test();
