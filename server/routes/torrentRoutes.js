const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const torrentController = require('../controllers/torrentController');

const router = express.Router();

// Accepts token from Authorization header OR query param (needed for <video src> which can't set headers)
const protectStream = async (req, res, next) => {
    let token = null;
    if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        if (!req.user) return res.status(401).json({ message: 'User not found' });
        next();
    } catch (err) {
        res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

router.get('/stream', protectStream, torrentController.streamTorrent);

module.exports = router;
