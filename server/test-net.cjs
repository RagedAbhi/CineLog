const axios = require('axios');
const https = require('https');

async function testNetworking() {
    console.log("Testing with httpsAgent (IPv4 forced)...");
    try {
        await axios.get(`https://api.themoviedb.org/3/watch/providers/list?api_key=94835791ed031d251f3bee9230a18e18`, {
            httpsAgent: new https.Agent({ family: 4 })
        });
        console.log("SUCCESS with IPv4!");
    } catch (e) {
        console.log("FAIL with IPv4:", e.message);
    }

    console.log("Testing WITHOUT httpsAgent (Default DNS resolution)...");
    try {
        await axios.get(`https://api.themoviedb.org/3/watch/providers/list?api_key=94835791ed031d251f3bee9230a18e18`);
        console.log("SUCCESS WITHOUT IPv4!");
    } catch (e) {
        console.log("FAIL WITHOUT IPv4:", e.message);
    }
}
testNetworking();
