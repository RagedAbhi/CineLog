const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 500 },
    hearts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const movieEngagementSchema = new mongoose.Schema({
    imdbID: { type: String, required: true, unique: true, index: true },
    likes: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    }],
    comments: [commentSchema]
}, { timestamps: true });

module.exports = mongoose.model('MovieEngagement', movieEngagementSchema);
