const Media = require('../models/Media');

// Get all media for the logged-in user
exports.getAllMedia = async (req, res) => {
    try {
        const media = await Media.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(media);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching media', error: error.message });
    }
};

// Get single media by ID
exports.getMediaById = async (req, res) => {
    try {
        const media = await Media.findOne({ _id: req.params.id, userId: req.user.id });
        if (!media) {
            return res.status(404).json({ message: 'Media not found' });
        }
        res.status(200).json(media);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching media details', error: error.message });
    }
};

// Create new media
exports.createMedia = async (req, res) => {
    try {
        const mediaData = {
            ...req.body,
            userId: req.user.id
        };
 
        // Prevent duplicates
        if (req.body.imdbID) {
            const existing = await Media.findOne({ userId: req.user.id, imdbID: req.body.imdbID });
            if (existing) {
                return res.status(400).json({ message: 'This item is already in your library' });
            }
        } else {
            // Fallback for items without imdbID (rare but possible)
            const existing = await Media.findOne({ 
                userId: req.user.id, 
                title: req.body.title, 
                year: req.body.year,
                mediaType: req.body.mediaType 
            });
            if (existing) {
                return res.status(400).json({ message: 'This item is already in your library' });
            }
        }
 
        const media = await Media.create(mediaData);
        res.status(201).json(media);
    } catch (error) {
        res.status(400).json({ message: 'Error creating media', error: error.message });
    }
};

// Update media
exports.updateMedia = async (req, res) => {
    try {
        const media = await Media.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!media) {
            return res.status(404).json({ message: 'Media not found' });
        }
        res.status(200).json(media);
    } catch (error) {
        res.status(400).json({ message: 'Error updating media', error: error.message });
    }
};

// Delete media
exports.deleteMedia = async (req, res) => {
    try {
        const media = await Media.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!media) {
            return res.status(404).json({ message: 'Media not found' });
        }
        res.status(200).json({ message: 'Media deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting media', error: error.message });
    }
};
