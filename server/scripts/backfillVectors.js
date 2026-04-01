require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Media = require('../models/Media');
const { generateEmbedding } = require('../services/embeddingService');
const logger = require('../utils/logger');

const backfill = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinelog';
        await mongoose.connect(mongoURI);
        logger.info('Connected to MongoDB for Vector Backfill');

        // Find all media without embeddings
        const items = await Media.find({ 
            $or: [
                { embedding: { $exists: false } },
                { embedding: { $size: 0 } }
            ],
            plot: { $exists: true, $ne: '' }
        });

        logger.info(`Found ${items.length} items requiring embeddings.`);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            logger.info(`[${i+1}/${items.length}] Generating vector for: ${item.title}`);
            
            // Combine title and plot for better semantic context
            const textToEmbed = `${item.title}: ${item.plot}`;
            const vector = await generateEmbedding(textToEmbed);

            if (vector) {
                item.embedding = vector;
                await item.save();
            } else {
                logger.warn(`Failed to generate vector for: ${item.title}`);
            }

            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        logger.info('Vector backfill complete! 🚀');
        process.exit(0);
    } catch (err) {
        logger.error('Backfill fatal error:', err);
        process.exit(1);
    }
};

backfill();
