const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    mediaType: { type: String, enum: ['movie', 'series'], required: true },
    genre: { type: String, required: true },
    year: { type: Number },
    director: { type: String },
    imdbID: { type: String },
    poster: { type: String },
    plot: { type: String },
    status: { type: String, enum: ['watchlist', 'watched', 'unknown'], default: 'unknown' },
    rating: { type: Number, min: 1, max: 10 },
    review: { type: String },
    watchedOn: { type: String },
    addedOn: { type: String, default: () => new Date().toISOString().split('T')[0] },
    isTopPick: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Media', mediaSchema);
