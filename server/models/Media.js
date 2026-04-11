const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    mediaType: { type: String, enum: ['movie', 'series'], required: true },
    genre: { type: String, required: true },
    year: { type: Number },
    director: { type: String },
    cast: { type: String },
    imdbID: { type: String },
    poster: { type: String },
    plot: { type: String },
    status: { type: String, enum: ['watchlist', 'watched', 'unknown'], default: 'unknown' },
    rating: { type: Number, min: 1, max: 10 },
    review: { type: String },
    watchedOn: { type: String },
    addedOn: { type: String, default: () => new Date().toISOString().split('T')[0] },
    isTopPick: { type: Boolean, default: false },
    embedding: { type: [Number] } // Vector for Semantic Search (dims: 1536)
}, { timestamps: true });
 
mediaSchema.index({ userId: 1, imdbID: 1 }, { unique: true, sparse: true });
mediaSchema.index({ userId: 1, title: 1, mediaType: 1 }, { 
    unique: true, 
    collation: { locale: 'en', strength: 2 } 
});

module.exports = mongoose.model('Media', mediaSchema);
