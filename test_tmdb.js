const axios = require('axios');

const TMDB_API_KEY = '94835791ed031d251f3bee9230a18e18';
const BASE_URL = 'https://api.themoviedb.org/3';

async function test(title) {
    console.log(`Testing: ${title}`);
    try {
        const searchRes = await axios.get(`${BASE_URL}/search/movie`, {
            params: { api_key: TMDB_API_KEY, query: title }
        });
        const id = searchRes.data.results[0]?.id;
        if (!id) {
            console.log('No movie found');
            return;
        }
        console.log(`Found ID: ${id}`);
        
        const providersRes = await axios.get(`${BASE_URL}/movie/${id}/watch/providers`, {
            params: { api_key: TMDB_API_KEY }
        });
        
        const providers = providersRes.data.results;
        console.log('Regions found:', Object.keys(providers).join(', '));
        
        if (providers.IN) {
            console.log('India (IN) Providers:');
            console.log(JSON.stringify(providers.IN, null, 2));
        } else {
            console.log('No providers found for India (IN)');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test('Inception');
