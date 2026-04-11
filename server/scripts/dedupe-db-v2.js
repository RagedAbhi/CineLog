const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Media = require('../models/Media');

async function dedupe() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const allMedia = await Media.find({});
        console.log(`Analyzing ${allMedia.length} media items...`);

        // Group by userId + normalized title + mediaType
        const groups = {};
        allMedia.forEach(item => {
            const key = `${item.userId}_${item.title.toLowerCase().trim()}_${item.mediaType}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        let duplicatesFound = 0;
        let itemsResolved = 0;

        for (const key in groups) {
            const items = groups[key];
            if (items.length > 1) {
                duplicatesFound++;
                console.log(`\nDuplicate found for: "${items[0].title}" (${items.length} copies)`);

                // 1. Pick the "best" item (one with most metadata)
                const sorted = items.sort((a, b) => {
                    const score = (item) => {
                        let s = 0;
                        if (item.plot && item.plot.length > 20) s += 10;
                        if (item.cast && item.cast.length > 5) s += 5;
                        if (item.director) s += 5;
                        if (item.imdbID) s += 20;
                        if (item.status === 'watched') s += 2;
                        return s;
                    };
                    return score(b) - score(a);
                });

                const best = sorted[0];
                const others = sorted.slice(1);

                // 2. Merge status and data into 'best'
                let needsUpdate = false;
                const updateData = {};

                // If any of the duplicates were 'watched', the 'best' one should be too
                if (items.some(i => i.status === 'watched') && best.status !== 'watched') {
                    updateData.status = 'watched';
                    const watchedItem = items.find(i => i.watchedOn);
                    if (watchedItem) updateData.watchedOn = watchedItem.watchedOn;
                    needsUpdate = true;
                }

                // Carry over rating/review if missing in 'best'
                if (!best.rating) {
                    const ratedItem = items.find(i => i.rating);
                    if (ratedItem) {
                        updateData.rating = ratedItem.rating;
                        updateData.review = ratedItem.review;
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    await Media.findByIdAndUpdate(best._id, updateData);
                    console.log(`  - Merged data into: ${best._id}`);
                }

                // 3. Delete the redundant copies
                const idsToDelete = others.map(o => o._id);
                await Media.deleteMany({ _id: { $in: idsToDelete } });
                console.log(`  - Deleted ${idsToDelete.length} redundant copies.`);
                itemsResolved += idsToDelete.length;
            }
        }

        console.log(`\n--- Deduplication Complete ---`);
        console.log(`Duplicates Groups Found: ${duplicatesFound}`);
        console.log(`Redundant Items Removed: ${itemsResolved}`);

    } catch (err) {
        console.error('Error during deduplication:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

dedupe();
