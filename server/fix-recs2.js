const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Recommendation = require('./models/Recommendation');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cinelog', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(async () => {
    // Find ALL recommendations that might need checking
    const recs = await Recommendation.find({ $or: [{ mediaType: 'movie' }, { mediaType: { $exists: false } }, { mediaType: null }] });
    console.log(`Checking ${recs.length} recommendations...`);
    let fixed = 0;
    
    for (let rec of recs) {
        if (!rec.imdbID) continue;
        try {
            const res = await axios.get(`https://www.omdbapi.com/?i=${rec.imdbID}&apikey=${process.env.REACT_APP_OMDB_API_KEY || '6c3a2d45'}`);
            if (res.data && res.data.Type === 'series') {
                console.log(`Fixing ${rec.mediaTitle} -> series`);
                rec.mediaType = 'series';
                await rec.updateOne({ mediaType: 'series' }); // More robust than .save() for schema validation issues
                fixed++;
            }
        } catch (err) {
            console.error('Error fetching', rec.imdbID, err.message);
        }
    }
    console.log(`Fixed ${fixed} recommendations.`);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
