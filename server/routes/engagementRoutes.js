const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const engagementController = require('../controllers/engagementController');

router.use(protect);

router.get('/:imdbID/counts', engagementController.getCounts);
router.get('/:imdbID/watched-by-friends', engagementController.getWatchedByFriends);
router.get('/:imdbID', engagementController.getEngagement);
router.post('/:imdbID/like', engagementController.toggleLike);
router.post('/:imdbID/comment', engagementController.addComment);
router.delete('/:imdbID/comment/:commentId', engagementController.deleteComment);
router.post('/:imdbID/comment/:commentId/heart', engagementController.toggleCommentHeart);

module.exports = router;
