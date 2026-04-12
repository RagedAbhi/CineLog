require('dotenv').config({ path: './.env' });
const axios = require('axios');
const https = require('https');

async function findLogos() {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/watch/providers/list`, {
            params: { api_key: process.env.TMDB_API_KEY, language: 'en-US' }
        });
        const providers = res.data.results || [];
        
        const targets = providers.filter(p => 
            p.provider_name.toLowerCase().includes('viki') || 
            p.provider_name.toLowerCase().includes('hbo') ||
            p.provider_name.toLowerCase() === 'max'
        );
        
        targets.forEach(t => {
            console.log(`${t.provider_name}: https://image.tmdb.org/t/p/original${t.logo_path}`);
        });
    } catch (e) {
        console.error(e.message);
    }
}

findLogos();
