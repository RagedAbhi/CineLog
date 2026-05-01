const PlaybackProgress = require('../models/PlaybackProgress');

exports.updateProgress = async (req, res) => {
    try {
        const { mediaId, title, poster, mediaType, currentTime, duration, season, episode, episodeTitle } = req.body;
        const userId = req.user.id;

        // For series, we track progress per episode. For movies, per mediaId.
        const query = { userId, mediaId };
        if (mediaType === 'series' && season !== undefined && episode !== undefined) {
            query.season = season;
            query.episode = episode;
        }

        let progress = await PlaybackProgress.findOne(query);

        if (progress) {
            progress.currentTime = currentTime;
            progress.duration = duration;
            progress.title = title || progress.title;
            progress.poster = poster || progress.poster;
            progress.mediaType = mediaType || progress.mediaType;
            progress.season = season ?? progress.season;
            progress.episode = episode ?? progress.episode;
            progress.episodeTitle = episodeTitle || progress.episodeTitle;
            await progress.save();
        } else {
            progress = new PlaybackProgress({
                userId,
                mediaId,
                title,
                poster,
                mediaType,
                currentTime,
                duration,
                season,
                episode,
                episodeTitle
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
        const { season, episode } = req.query;

        const query = { userId, mediaId };
        if (season !== undefined && episode !== undefined) {
            query.season = parseInt(season);
            query.episode = parseInt(episode);
        }

        const progress = await PlaybackProgress.findOne(query);
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

        // Relaxed 98% rule ensures movies stay in list until the very end of credits
        const continueWatching = allProgress.filter(p => (p.currentTime / (p.duration || 1)) < 0.98);
        
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
