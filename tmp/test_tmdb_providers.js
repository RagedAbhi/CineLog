const axios = require('axios');

// Using the key directly for this internal test
const TMDB_API_KEY = '94835791ed031d251f3bee9230a18e18';
const BASE_URL = 'https://api.themoviedb.org/3';

async function testProviders() {
    // Testing "The Morning Show" (TV) - ID 85350 (known Apple TV+ original)
    const tvId = 85350;
    try {
        const res = await axios.get(`${BASE_URL}/tv/${tvId}/watch/providers`, {
            params: { api_key: TMDB_API_KEY }
        });
        console.log('\n--- The Morning Show (India) ---');
        console.log(JSON.stringify(res.data.results?.IN, null, 2));
    } catch (e) {
        console.error('Error fetching TV providers:', e.message);
    }

    // Testing "Masters of the Air" (TV) - ID 112102
    const tvId2 = 112102;
    try {
        const res = await axios.get(`${BASE_URL}/tv/${tvId2}/watch/providers`, {
            params: { api_key: TMDB_API_KEY }
        });
        console.log('\n--- Masters of the Air (India) ---');
        console.log(JSON.stringify(res.data.results?.IN, null, 2));
    } catch (e) {
        console.error('Error fetching TV providers:', e.message);
    }
}

testProviders();
