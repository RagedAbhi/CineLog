const express = require('express');
const router = express.Router();
const playbackController = require('../controllers/playbackController');
const auth = require('../middleware/auth');

// All playback routes require authentication
router.post('/update', auth, playbackController.updateProgress);
router.get('/all', auth, playbackController.getAllProgress);
router.get('/:mediaId', auth, playbackController.getProgress);
router.delete('/:mediaId', auth, playbackController.deleteProgress);

module.exports = router;
