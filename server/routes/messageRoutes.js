const express = require('express');
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/send', messageController.sendMessage);
router.get('/conversation/:friendId', messageController.getConversation);
router.get('/recent', messageController.getRecentChats);

module.exports = router;
