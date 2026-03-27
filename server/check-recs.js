const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Recommendation = require('./models/Recommendation');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cinelog', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(async () => {
    // Find ALL recommendations
    const recs = await Recommendation.find({});
    console.log(`Found ${recs.length} total recommendations.`);
    recs.forEach(r => {
        console.log(`- ${r.mediaTitle}: mediaType=${r.mediaType}`);
    });
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
