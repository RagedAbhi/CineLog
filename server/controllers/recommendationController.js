const Recommendation = require('../models/Recommendation');
const Friendship = require('../models/Friendship');

// Send a recommendation to a friend
exports.sendRecommendation = async (req, res) => {
    try {
        const { receiverId, mediaTitle, mediaType, imdbID, poster, message } = req.body;

        // Verify they are friends
        const isFriend = await Friendship.findOne({
            status: 'accepted',
            $or: [
                { requester: req.user.id, recipient: receiverId },
                { requester: receiverId, recipient: req.user.id }
            ]
        });

        if (!isFriend) {
            return res.status(403).json({ message: 'You can only recommend content to friends' });
        }

        const recommendation = await Recommendation.create({
            sender: req.user.id,
            receiver: receiverId,
            mediaTitle,
            mediaType,
            imdbID,
            poster,
            message
        });

        res.status(201).json(recommendation);
    } catch (error) {
        res.status(500).json({ message: 'Error sending recommendation', error: error.message });
    }
};

// Get recommendations received by the user
exports.getMyRecommendations = async (req, res) => {
    try {
        const recommendations = await Recommendation.find({ receiver: req.user.id })
            .populate('sender', 'username name')
            .sort({ createdAt: -1 });

        res.status(200).json(recommendations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching recommendations', error: error.message });
    }
};

// Mark recommendation as read
exports.markAsRead = async (req, res) => {
    try {
        const recommendation = await Recommendation.findOneAndUpdate(
            { _id: req.params.id, receiver: req.user.id },
            { read: true },
            { new: true }
        );
        if (!recommendation) {
            return res.status(404).json({ message: 'Recommendation not found' });
        }
        res.status(200).json(recommendation);
    } catch (error) {
        res.status(400).json({ message: 'Error updating recommendation', error: error.message });
    }
};
