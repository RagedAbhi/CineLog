const mongoose = require('mongoose');

const PlaybackProgressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    mediaId: {
        type: String, // IMDB ID or TMDB ID
        required: true,
        index: true
    },
    title: String,
    poster: String,
    mediaType: {
        type: String,
        enum: ['movie', 'series'],
        default: 'movie'
    },
    currentTime: {
        type: Number,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field on save
PlaybackProgressSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('PlaybackProgress', PlaybackProgressSchema);
