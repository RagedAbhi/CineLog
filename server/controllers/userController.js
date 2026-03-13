const User = require('../models/User');

// Get current user profile
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('topPicks');
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
};

// Update user profile (name, bio)
exports.updateProfile = async (req, res) => {
    try {
        const { name, bio } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name, bio },
            { new: true, runValidators: true }
        );
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ message: 'Error updating profile', error: error.message });
    }
};

// Search users by username
exports.searchUsers = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.status(400).json({ message: 'Username is required' });

        // Find users containing the string, excluding self
        const users = await User.find({
            username: { $regex: username, $options: 'i' },
            _id: { $ne: req.user.id }
        }).select('username name bio');

        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error searching users', error: error.message });
    }
};

// Get a specific user profile (if they are friends - logic handled in friendship check later or just public for now as requested)
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('username name bio topPicks')
            .populate('topPicks');

        if (!user) return res.status(404).json({ message: 'User not found' });

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user profile', error: error.message });
    }
};

// Toggle top pick
exports.toggleTopPick = async (req, res) => {
    try {
        const { mediaId } = req.body;
        if (!mediaId) return res.status(400).json({ message: 'Media ID is required' });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const index = user.topPicks.indexOf(mediaId);
        if (index === -1) {
            // Add if not present
            user.topPicks.push(mediaId);
        } else {
            // Remove if present
            user.topPicks.splice(index, 1);
        }

        await user.save();
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error toggling top pick', error: error.message });
    }
};
