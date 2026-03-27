const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/me', userController.getMe);
router.post('/heartbeat', userController.heartbeat);
router.patch('/profile', userController.updateProfile);
router.patch('/profile/password', userController.changePassword);
router.patch('/profile/top-picks', userController.toggleTopPick);
router.get('/search', userController.searchUsers);
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images (jpeg, jpg, png, webp) are allowed'));
    }
});

router.post('/upload-avatar', upload.single('avatar'), userController.uploadAvatar);
router.get('/:id', userController.getUserProfile);

module.exports = router;
