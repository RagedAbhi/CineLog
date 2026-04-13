// heal-media.cjs
require('dotenv').config();
const mongoose = require('mongoose');
const Media = require('./models/Media');
const searchService = require('./services/searchService');

const mongoURI = process.env.MONGODB_URI;

async function heal() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(mongoURI);
        console.log("Connected.");

        // Find items with missing descriptions
        const items = await Media.find({
            $or: [
                { plot: "" },
                { plot: null },
                { plot: { $exists: false } },
                { genre: "Unknown" },
                { genre: "" }
            ]
        });

        console.log(`Found ${items.length} items needing metadata healing.`);
        
        let healedCount = 0;
        let failedCount = 0;

        for (const item of items) {
            console.log(`\nHealing: "${item.title}" (${item.year || 'N/A'}) [${item.imdbID || 'No ID'}]`);
            
            try {
                const enrichment = await searchService.enrichMediaMetadata(item);
                
                if (enrichment) {
                    let changed = false;
                    
                    if (enrichment.plot && !item.plot) {
                        item.plot = enrichment.plot;
                        changed = true;
                    }
                    
                    if (enrichment.genre && (!item.genre || item.genre === 'Unknown')) {
                        item.genre = enrichment.genre;
                        changed = true;
                    }
                    
                    if (enrichment.cast && !item.cast) {
                        item.cast = enrichment.cast;
                        changed = true;
                    }
                    
                    if (enrichment.director && !item.director) {
                        item.director = enrichment.director;
                        changed = true;
                    }

                    if (changed) {
                        await item.save();
                        healedCount++;
                        console.log(`✅ Success: Updated missing fields.`);
                    } else {
                        console.log(`ℹ️ No changes: Fetched data matched current state.`);
                    }
                } else {
                    console.log(`❌ Failed: No enrichment data found (TMDB/OMDB search yielded nothing).`);
                    failedCount++;
                }
            } catch (err) {
                console.error(`💥 Error healing "${item.title}":`, err.message);
                failedCount++;
            }

            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 300));
        }

        console.log(`\n========================================`);
        console.log(`Healing complete.`);
        console.log(`Total items processed: ${items.length}`);
        console.log(`Successfully healed: ${healedCount}`);
        console.log(`Failed/No data: ${failedCount}`);
        console.log(`========================================`);

    } catch (err) {
        console.error("Critical Failure:", err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

heal();
