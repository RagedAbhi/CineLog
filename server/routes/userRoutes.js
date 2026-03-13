const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/me', userController.getMe);
router.patch('/profile', userController.updateProfile);
router.patch('/profile/top-picks', userController.toggleTopPick);
router.get('/search', userController.searchUsers);
router.get('/:id', userController.getUserProfile);

module.exports = router;
