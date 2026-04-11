const mongoose = require('mongoose');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Media = require('../models/Media');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

async function heal() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // Find items missing plot OR cast OR director
        // We also check for short plots or generic 'Unknown' values
        const corrupted = await Media.find({
            $or: [
                { plot: { $exists: false } },
                { plot: '' },
                { plot: null },
                { cast: { $exists: false } },
                { cast: '' },
                { cast: 'Unknown' },
                { director: { $exists: false } },
                { director: '' },
                { director: 'Unknown' }
            ]
        });

        console.log(`Found ${corrupted.length} items needing healing.`);

        let healedCount = 0;
        let failedCount = 0;

        for (const item of corrupted) {
            console.log(`\nHealing: "${item.title}" (${item.mediaType})`);
            
            try {
                let tmdbId = item.imdbID;
                const tmdbType = item.mediaType === 'series' ? 'tv' : 'movie';

                // 1. If we don't have a valid ID or if it's an IMDB ID (tt...), we need to find/verify it
                if (!tmdbId || (typeof tmdbId === 'string' && tmdbId.startsWith('tt'))) {
                    console.log(`  - Searching TMDB for "${item.title}"...`);
                    const searchRes = await axios.get(`${BASE_URL}/search/${tmdbType}`, {
                        params: {
                            api_key: TMDB_API_KEY,
                            query: item.title,
                            year: item.year
                        }
                    });
                    
                    const result = searchRes.data.results?.[0];
                    if (result) {
                        tmdbId = result.id;
                    } else {
                        // Try without year if first search fails
                        const retryRes = await axios.get(`${BASE_URL}/search/${tmdbType}`, {
                            params: { api_key: TMDB_API_KEY, query: item.title }
                        });
                        tmdbId = retryRes.data.results?.[0]?.id;
                    }
                }

                if (!tmdbId) {
                    console.log(`  - [SKIP] Could not find TMDB ID for "${item.title}"`);
                    failedCount++;
                    continue;
                }

                // 2. Fetch full details with credits
                console.log(`  - Fetching details for TMDB ID: ${tmdbId}`);
                const detailRes = await axios.get(`${BASE_URL}/${tmdbType}/${tmdbId}`, {
                    params: {
                        api_key: TMDB_API_KEY,
                        append_to_response: 'credits'
                    }
                });

                const data = detailRes.data;
                const update = {};

                // Only update if current value is missing/corrupted
                if (!item.plot || item.plot.length < 10) {
                    update.plot = data.overview || '';
                }
                
                if (!item.cast || item.cast === '' || item.cast === 'Unknown') {
                    update.cast = data.credits?.cast?.slice(0, 5).map(c => c.name).join(', ') || '';
                }

                if (!item.director || item.director === '' || item.director === 'Unknown') {
                    if (tmdbType === 'movie') {
                        update.director = data.credits?.crew?.find(c => c.job === 'Director')?.name || '';
                    } else {
                        update.director = data.created_by?.[0]?.name || data.credits?.crew?.find(c => c.job === 'Executive Producer')?.name || '';
                    }
                }

                // Also fix genre and year if missing
                if (!item.genre || item.genre === 'Unknown') {
                    update.genre = data.genres?.map(g => g.name).join(', ') || 'Unknown';
                }
                if (!item.year && (data.release_date || data.first_air_date)) {
                    update.year = parseInt((data.release_date || data.first_air_date).split('-')[0]);
                }

                if (Object.keys(update).length > 0) {
                    await Media.findByIdAndUpdate(item._id, update);
                    console.log(`  - [SUCCESS] Updated: ${Object.keys(update).join(', ')}`);
                    healedCount++;
                } else {
                    console.log('  - [IGNORE] No new data found.');
                }

            } catch (err) {
                console.error(`  - [ERROR] Failed to heal "${item.title}":`, err.message);
                failedCount++;
            }

            // Small delay to be nice to API
            await new Promise(r => setTimeout(r, 200));
        }

        console.log(`\n--- Healing Complete ---`);
        console.log(`Items Healed: ${healedCount}`);
        console.log(`Failed/Skipped: ${failedCount}`);

    } catch (err) {
        console.error('Connection Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

heal();
