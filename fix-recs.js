const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const Recommendation = require('./server/models/Recommendation');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cinelog', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(async () => {
    const recs = await Recommendation.find({ mediaType: 'movie' });
    console.log(`Checking ${recs.length} 'movie' recommendations...`);
    let fixed = 0;
    
    for (let rec of recs) {
        if (!rec.imdbID) continue;
        try {
            const res = await axios.get(`https://www.omdbapi.com/?i=${rec.imdbID}&apikey=${process.env.REACT_APP_OMDB_API_KEY}`);
            if (res.data && res.data.Type === 'series') {
                console.log(`Fixing ${rec.mediaTitle} -> series`);
                rec.mediaType = 'series';
                await rec.save();
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
