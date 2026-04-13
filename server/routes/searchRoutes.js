const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { protect } = require('../middleware/authMiddleware');

/**
 * Enhanced Search Router
 * All routes are protected by authMiddleware to provide personalized results
 */
router.get('/', protect, searchController.proxySearch);
router.get('/discover', protect, searchController.getDiscoverFeed);
router.get('/semantic', protect, searchController.semanticSearch);
router.get('/providers/imdb/:imdbID', protect, searchController.getProvidersById);
router.get('/providers/:type/:id', protect, searchController.getProviders);
router.get('/person/:id', protect, searchController.getPersonFilmography);
router.post('/track', protect, searchController.trackInteraction);

module.exports = router;
