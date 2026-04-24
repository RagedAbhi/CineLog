const express = require('express');
const addonController = require('../controllers/addonController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

router.get('/', addonController.getAddons);
router.post('/install', addonController.installAddon);
router.delete('/:addonId', addonController.uninstallAddon);
router.get('/streams', addonController.fetchStreams);

module.exports = router;
