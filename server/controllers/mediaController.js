const Media = require('../models/Media');
 
// Helper: Scrub empty/null fields to prevent overwriting rich metadata with partial info
const scrubUpdateData = (data) => {
    const scrubbed = {};
    Object.keys(data).forEach(key => {
        // Only keep fields that actually have meaningful data
        // Explicitly allow false/0, but reject null, undefined, and empty strings
        if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
            scrubbed[key] = data[key];
        }
    });
    return scrubbed;
};

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
        
        if (imdbID) {
            existing = await Media.findOne({ userId: req.user.id, imdbID });
        } 
        
        if (!existing && title) {
            // Enhanced check: Try finding by title (case-insensitive) and mediaType
            // This is more aggressive than requiring an exact year match
            existing = await Media.findOne({ 
                userId: req.user.id, 
                title: { $regex: new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, 
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
            // CRITICAL: Scrub incoming data so we don't wipe out existing metadata (cast, plot, etc.)
            const updatePayload = scrubUpdateData(req.body);
            const updated = await Media.findOneAndUpdate(
                { _id: existing._id },
                { ...updatePayload, userId: req.user.id },
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
        // CRITICAL: Scrub incoming data so we don't wipe out existing metadata
        const updatePayload = scrubUpdateData(req.body);
        
        const media = await Media.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            updatePayload,
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
