const express = require('express');
const router = express.Router();
const playbackController = require('../controllers/playbackController');
const { protect } = require('../middleware/authMiddleware');

// All playback routes require authentication
router.post('/update', protect, playbackController.updateProgress);
router.get('/all', protect, playbackController.getAllProgress);
router.get('/:mediaId', protect, playbackController.getProgress);
router.delete('/:mediaId', protect, playbackController.deleteProgress);

module.exports = router;
