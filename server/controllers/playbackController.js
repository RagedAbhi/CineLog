const PlaybackProgress = require('../models/PlaybackProgress');

exports.updateProgress = async (req, res) => {
    try {
        const { mediaId, title, poster, mediaType, currentTime, duration } = req.body;
        const userId = req.user.id;

        let progress = await PlaybackProgress.findOne({ userId, mediaId });

        if (progress) {
            progress.currentTime = currentTime;
            progress.duration = duration;
            progress.title = title || progress.title;
            progress.poster = poster || progress.poster;
            progress.mediaType = mediaType || progress.mediaType;
            await progress.save();
        } else {
            progress = new PlaybackProgress({
                userId,
                mediaId,
                title,
                poster,
                mediaType,
                currentTime,
                duration
            });
            await progress.save();
        }

        res.json(progress);
    } catch (error) {
        res.status(500).json({ message: 'Error updating playback progress', error: error.message });
    }
};

exports.getProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { mediaId } = req.params;
        const progress = await PlaybackProgress.findOne({ userId, mediaId });
        res.json(progress || null);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching progress', error: error.message });
    }
};

exports.getAllProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        // Fetch only items that are not finished (e.g., less than 95% watched)
        const allProgress = await PlaybackProgress.find({ userId })
            .sort({ updatedAt: -1 })
            .limit(20);

        // Filter out completed ones (optional, let's keep everything for now but highlight progress)
        const continueWatching = allProgress.filter(p => (p.currentTime / p.duration) < 0.95);
        
        res.json(continueWatching);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching continue watching list', error: error.message });
    }
};

exports.deleteProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { mediaId } = req.params;
        await PlaybackProgress.deleteOne({ userId, mediaId });
        res.json({ message: 'Progress cleared' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting progress', error: error.message });
    }
};
