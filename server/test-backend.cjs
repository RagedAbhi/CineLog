// test-backend.cjs
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

async function testBackend() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const searchService = require('./services/searchService');
        console.log("Fetching providers...");
        const providers = await searchService.getProvidersByImdbId('tt1375666', 'Inception', 'movie', '2010');
        console.log("Providers:", JSON.stringify(providers, null, 2));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        mongoose.disconnect();
    }
}

testBackend();
