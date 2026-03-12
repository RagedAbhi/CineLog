const express = require('express');
const friendController = require('../controllers/friendController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', friendController.getFriends);
router.get('/requests', friendController.getPendingRequests);
router.post('/request', friendController.sendFriendRequest);
router.post('/accept', friendController.acceptFriendRequest);
router.post('/reject', friendController.rejectFriendRequest);

module.exports = router;
