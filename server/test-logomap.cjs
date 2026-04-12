// test-logomap.cjs
require('dotenv').config({ path: './.env' });
const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({ family: 4 });

async function run() {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/watch/providers/list`, {
            httpsAgent,
            params: { api_key: process.env.TMDB_API_KEY, language: 'en-US', watch_region: 'IN' }
        });
        const map = {};
        (res.data.results || []).forEach(p => {
            map[p.provider_name] = `https://image.tmdb.org/t/p/original${p.logo_path}`;
        });
        console.log("Found logo for Amazon Prime Video:", map['Amazon Prime Video']);
        console.log(Object.keys(map).slice(0, 10));
    } catch (e) {
        console.log("Fail", e.message);
    }
}
run();
