const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String },
    mediaAddon: {
        imdbID: String,
        title: String,
        poster: String,
        mediaType: { type: String, enum: ['movie', 'series'] }
    },
    read: { type: Boolean, default: false }
}, { timestamps: true });

// Index for faster conversation fetching
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
