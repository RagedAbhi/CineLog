require('dotenv').config();
const mongoose = require('mongoose');
const algoliasearch = require('algoliasearch');
const Media = require('./models/Media');

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
    console.error('Missing Algolia credentials in .env');
    process.exit(1);
}

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
const index = client.initIndex('cinelog_media');

async function seedAlgolia() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Fetch unique media items (ignore user-specific watch statuses, just aggregate titles)
        const allMedia = await Media.find({});
        
        // Deduplicate locally to avoid indexing the same movie multiple times
        const uniqueMediaMap = {};
        allMedia.forEach(m => {
            if (m.imdbID && !uniqueMediaMap[m.imdbID.toString()]) {
                uniqueMediaMap[m.imdbID.toString()] = m;
            }
        });
        
        const uniqueMedia = Object.values(uniqueMediaMap);
        console.log(`Found ${uniqueMedia.length} unique cached media items to index.`);

        const algoliaObjects = uniqueMedia.map(m => ({
            objectID: m.imdbID,
            title: m.title,
            mediaType: m.mediaType,
            year: m.year,
            poster: m.poster,
            overview: m.overview,
            cast: m.cast ? m.cast.split(', ') : [],
            director: m.director,
            genres: m.genre ? m.genre.split(', ') : [],
            popularity: m.imdbRating ? parseFloat(m.imdbRating) : 0 // Rough proxy for popularity ranking
        }));

        if (algoliaObjects.length > 0) {
            await index.saveObjects(algoliaObjects);
            console.log(`Successfully pushed ${algoliaObjects.length} records to Algolia.`);
        } else {
            console.log('No media to push.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Failed to seed Algolia:', error);
        process.exit(1);
    }
}

seedAlgolia();
