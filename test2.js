const axios = require('axios');

async function test() {
    console.log("START");
    const TMDB_API_KEY = '94835791ed031d251f3bee9230a18e18';
    const BASE_URL = 'https://api.themoviedb.org/3';
    try {
        const query = 'Inception';
        const res = await axios.get(`${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${query}`);
        const id = res.data.results[0].id;
        console.log("ID", id);
        const prov = await axios.get(`${BASE_URL}/movie/${id}/watch/providers?api_key=${TMDB_API_KEY}`);
        console.log("IN", JSON.stringify(prov.data.results.IN, null, 2));
    } catch (e) {
        console.log("ERR", e.message);
    }
}
test();
