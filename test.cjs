// test.cjs
const axios = require('axios');
const TMDB_API_KEY = '94835791ed031d251f3bee9230a18e18';

async function run() {
    const res = await axios.get(`https://api.themoviedb.org/3/movie/27205/watch/providers`, {
        params: { api_key: TMDB_API_KEY }
    });
    console.log(JSON.stringify(res.data.results.IN, null, 2));
}

run();
