const { OpenAI } = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates a vector embedding for a given text string.
 * Uses text-embedding-3-small (1536 dimensions).
 */
exports.generateEmbedding = async (text) => {
    if (!process.env.OPENAI_API_KEY) {
        logger.error('[OpenAI] Missing API Key in .env');
        return null;
    }

    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float",
        });

        return response.data[0].embedding;
    } catch (error) {
        logger.error('[OpenAI] Embedding failed:', error);
        return null;
    }
};
