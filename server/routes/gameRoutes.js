const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    createRoom,
    joinRoom,
    getRoom,
    saveGameStats
} = require('../controllers/gameController');

router.post('/rooms', protect, createRoom);
router.post('/rooms/:code/join', protect, joinRoom);
router.get('/rooms/:code', protect, getRoom);
router.patch('/users/game-stats', protect, saveGameStats);

module.exports = router;
