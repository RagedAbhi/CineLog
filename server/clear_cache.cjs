// clear_cache.cjs
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const SearchCache = require('./models/SearchCache');
        const deleted = await SearchCache.deleteMany({ query: /^providers_/ });
        console.log("Deleted cached providers:", deleted.deletedCount);
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
run();
