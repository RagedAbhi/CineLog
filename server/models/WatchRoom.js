const mongoose = require('mongoose');
const crypto = require('crypto');

const watchRoomSchema = new mongoose.Schema({
    roomCode: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto.randomBytes(3).toString('hex').toUpperCase()
    },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true }
    }],
    platform: { type: String, default: 'netflix' },
    contentId: { type: String, default: '' },
    contentTitle: { type: String, default: '' },
    contentType: { type: String, enum: ['movie', 'series'], default: 'movie' },
    netflixUrl: { type: String, default: '' },
    state: {
        playing: { type: Boolean, default: false },
        currentTime: { type: Number, default: 0 },
        lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        lastUpdatedAt: { type: Date, default: Date.now }
    },
    isActive: { type: Boolean, default: true },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours
    }
}, { timestamps: true });

// MongoDB TTL index — auto-deletes expired rooms
watchRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
watchRoomSchema.index({ roomCode: 1 });
watchRoomSchema.index({ host: 1, isActive: 1 });

module.exports = mongoose.model('WatchRoom', watchRoomSchema);
