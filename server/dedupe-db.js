require('dotenv').config();
const mongoose = require('mongoose');
const Media = require('./models/Media');
const Recommendation = require('./models/Recommendation');

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinelog';

const dedupe = async () => {
    try {
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB.');

        // 1. Dedupe Media (Library)
        console.log('Deduping Media Library...');
        const allMedia = await Media.find({});
        const mediaGroups = {};

        allMedia.forEach(m => {
            const key = `${m.userId}_${(m.imdbID || m.title + '_' + m.year).toLowerCase().replace(/\s/g, '')}`;
            if (!mediaGroups[key]) mediaGroups[key] = [];
            mediaGroups[key].push(m);
        });

        let mediaDeleted = 0;
        for (const key in mediaGroups) {
            const group = mediaGroups[key];
            if (group.length > 1) {
                // Keep the one with most data (e.g. status='watched', or highest rating)
                group.sort((a, b) => {
                    if (a.status === 'watched' && b.status !== 'watched') return -1;
                    if (b.status === 'watched' && a.status !== 'watched') return 1;
                    return (b.rating || 0) - (a.rating || 0);
                });

                const [keep, ...others] = group;
                for (const other of others) {
                    await Media.findByIdAndDelete(other._id);
                    mediaDeleted++;
                }
            }
        }
        console.log(`Deleted ${mediaDeleted} duplicate media items.`);

        // 2. Dedupe Recommendations (Sent)
        console.log('Deduping Recommendations...');
        const allRecs = await Recommendation.find({});
        const recGroups = {};

        allRecs.forEach(r => {
            const key = `${r.sender}_${r.receiver}_${(r.imdbID || r.mediaTitle).toLowerCase().replace(/\s/g, '')}`;
            if (!recGroups[key]) recGroups[key] = [];
            recGroups[key].push(r);
        });

        let recsDeleted = 0;
        for (const key in recGroups) {
            const group = recGroups[key];
            if (group.length > 1) {
                const [keep, ...others] = group;
                for (const other of others) {
                    await Recommendation.findByIdAndDelete(other._id);
                    recsDeleted++;
                }
            }
        }
        console.log(`Deleted ${recsDeleted} duplicate recommendations.`);

        console.log('Deduplication complete!');
        process.exit(0);
    } catch (err) {
        console.error('Deduplication failed:', err);
        process.exit(1);
    }
};

dedupe();
