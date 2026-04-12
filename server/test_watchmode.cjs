require('dotenv').config({ path: './.env' });
const axios = require('axios');

async function getWatchmodeProviders() {
    try {
        const apiKey = process.env.WATCHMODE_API_KEY;
        // Fetch all networks/providers from Watchmode
        const res = await axios.get(`https://api.watchmode.com/v1/networks/?apiKey=${apiKey}&regions=IN`);
        
        // Filter for Indian region or widely available global OTTs in India
        const providers = res.data;
        
        // Sort alphabetically
        providers.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log("Total Indian providers on Watchmode:", providers.length);
        console.log("Sample of providers:");
        providers.forEach(p => {
            console.log(`- ${p.name} (ID: ${p.id})`);
        });
    } catch (e) {
        console.error("Failed to fetch from Watchmode:", e.message);
    }
}

getWatchmodeProviders();
