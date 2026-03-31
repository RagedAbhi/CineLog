const express = require('express');
const recommendationController = require('../controllers/recommendationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', recommendationController.getMyRecommendations);
router.post('/', recommendationController.sendRecommendation);
router.get('/:id', recommendationController.getRecommendationById);
router.patch('/:id/read', recommendationController.markAsRead);
router.patch('/:id/metadata', recommendationController.updateMetadata);
router.patch('/mark-all-read/:senderId', recommendationController.markAllFromSenderAsRead);
router.delete('/bulk/clear-all', recommendationController.clearMyRecommendations);
router.delete('/:id', recommendationController.deleteRecommendation);

module.exports = router;
