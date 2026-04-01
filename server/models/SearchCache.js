const mongoose = require('mongoose');

const searchCacheSchema = new mongoose.Schema({
    query: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, default: 'multi' }, // 'multi', 'person', 'thematic'
    results: { type: mongoose.Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL index
}, { timestamps: true });

module.exports = mongoose.model('SearchCache', searchCacheSchema);
