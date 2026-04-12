const express = require('express');
const mediaController = require('../controllers/mediaController');
const migrateLanguage = require('../controllers/migrateLanguageController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply protection to all media routes
router.use(protect);

router.post('/migrate-language', migrateLanguage.migrateLanguage);

router.route('/')
    .get(mediaController.getAllMedia)
    .post(mediaController.createMedia);

router.route('/:id')
    .get(mediaController.getMediaById)
    .patch(mediaController.updateMedia)
    .delete(mediaController.deleteMedia);

module.exports = router;
