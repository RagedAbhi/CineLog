const mongoose = require('mongoose');

const userBehaviorSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    searchHistory: [{
        query: String,
        timestamp: { type: Date, default: Date.now }
    }],
    clickedItems: [{
        id: String, // tmdbId or imdbID
        title: String,
        mediaType: String,
        genreIds: [Number],
        timestamp: { type: Date, default: Date.now }
    }],
    preferredGenres: [{
        id: Number,
        name: String,
        score: { type: Number, default: 0 } // Weight based on interactions
    }]
}, { timestamps: true });

module.exports = mongoose.model('UserBehavior', userBehaviorSchema);
