const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/watchRoomController');

const router = express.Router();

router.use(protect);

router.post('/', ctrl.createRoom);
router.get('/:code', ctrl.getRoom);
router.post('/:code/join', ctrl.joinRoom);
router.post('/:code/leave', ctrl.leaveRoom);

module.exports = router;
