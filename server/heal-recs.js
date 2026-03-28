require('dotenv').config();
const mongoose = require('mongoose');
const Recommendation = require('./models/Recommendation');
const https = require('https');

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinelog';
const OMDB_API_KEY = process.env.REACT_APP_OMDB_API_KEY || process.env.OMDB_API_KEY;

if (!OMDB_API_KEY) {
    console.error('ERROR: No OMDB API Key found in .env');
    process.exit(1);
}

const fetchGenre = (imdbID) => {
    return new Promise((resolve) => {
        const url = `https://www.omdbapi.com/?i=${imdbID}&apikey=${OMDB_API_KEY}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.Genre || '');
                } catch (e) { resolve(''); }
            });
        }).on('error', () => resolve(''));
    });
};

const heal = async () => {
    try {
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB.');

        const recs = await Recommendation.find({
            $or: [
                { genre: '' },
                { genre: null },
                { genre: 'Unknown' },
                { genre: { $exists: false } }
            ]
        });

        console.log(`Found ${recs.length} recommendations needing genre healing.`);

        let count = 0;
        for (const rec of recs) {
            if (!rec.imdbID) {
                console.log(`Skipping "${rec.mediaTitle}" (no imdbID)`);
                continue;
            }

            const genre = await fetchGenre(rec.imdbID);
            if (genre) {
                rec.genre = genre;
                await rec.save();
                count++;
                process.stdout.write(`\rHealed: ${count}/${recs.length} (${rec.mediaTitle})`);
            } else {
                process.stdout.write(`\rFailed: ${rec.mediaTitle}`);
            }
            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 200));
        }

        console.log('\nHealing complete!');
        process.exit(0);
    } catch (err) {
        console.error('Healing failed:', err);
        process.exit(1);
    }
};

heal();
