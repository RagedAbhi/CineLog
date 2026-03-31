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

// Create new media or update existing status
exports.createMedia = async (req, res) => {
    try {
        const { imdbID, title, year, mediaType, status } = req.body;
        const currentStatus = status || 'watched'; // Fallback
        
        let existing;
        if (imdbID) {
            existing = await Media.findOne({ userId: req.user.id, imdbID });
        } else {
            existing = await Media.findOne({ 
                userId: req.user.id, 
                title, 
                year,
                mediaType 
            });
        }

        if (existing) {
            // Case 1: Same status - Return friendly error
            if (existing.status === currentStatus) {
                return res.status(400).json({ 
                    message: `Already in ${currentStatus === 'watched' ? 'watched' : 'watchlist'}` 
                });
            }

            // Case 2: Different status - Update the existing entry
            const updated = await Media.findOneAndUpdate(
                { _id: existing._id },
                { ...req.body, userId: req.user.id },
                { new: true, runValidators: true }
            );
            return res.status(200).json(updated);
        }

        // Case 3: New item - Create as normal
        const media = await Media.create({
            ...req.body,
            userId: req.user.id
        });
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
