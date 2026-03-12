const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mediaTitle: { type: String, required: true },
    mediaType: { type: String, enum: ['movie', 'series'], required: true },
    imdbID: { type: String }, // Optional but helpful for linking back
    poster: { type: String },
    message: { type: String },
    read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Recommendation', recommendationSchema);
