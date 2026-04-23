const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    profilePicture: { type: String, default: '' },
    bio: { type: String, default: '' },
    lastSeen: { type: Date, default: null },
    topPicks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
    }],
    isPrivate: { type: Boolean, default: false },
    gameStats: {
        hangman: {
            gamesPlayed: { type: Number, default: 0 },
            wins: { type: Number, default: 0 },
            totalScore: { type: Number, default: 0 },
            highScore: { type: Number, default: 0 }
        },
        plotRedacted: {
            gamesPlayed: { type: Number, default: 0 },
            wins: { type: Number, default: 0 },
            totalScore: { type: Number, default: 0 },
            highScore: { type: Number, default: 0 }
        }
    }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
