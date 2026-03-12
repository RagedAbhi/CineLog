const express = require('express');
const recommendationController = require('../controllers/recommendationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', recommendationController.getMyRecommendations);
router.post('/', recommendationController.sendRecommendation);
router.patch('/:id/read', recommendationController.markAsRead);

module.exports = router;
