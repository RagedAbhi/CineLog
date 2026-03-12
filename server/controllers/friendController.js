const Friendship = require('../models/Friendship');
const User = require('../models/User');

// Send a friend request
exports.sendFriendRequest = async (req, res) => {
    try {
        const { recipientId } = req.body;
        if (recipientId === req.user.id) {
            return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
        }

        // Check if friendship or request already exists
        const existingFriendship = await Friendship.findOne({
            $or: [
                { requester: req.user.id, recipient: recipientId },
                { requester: recipientId, recipient: req.user.id }
            ]
        });

        if (existingFriendship) {
            return res.status(400).json({ message: 'Friend request already sent or you are already friends' });
        }

        const friendship = await Friendship.create({
            requester: req.user.id,
            recipient: recipientId,
            status: 'pending'
        });

        res.status(201).json(friendship);
    } catch (error) {
        res.status(500).json({ message: 'Error sending friend request', error: error.message });
    }
};

// Accept friend request
exports.acceptFriendRequest = async (req, res) => {
    try {
        const { requestId } = req.body;
        const friendship = await Friendship.findOneAndUpdate(
            { _id: requestId, recipient: req.user.id, status: 'pending' },
            { status: 'accepted' },
            { new: true }
        );

        if (!friendship) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        res.status(200).json(friendship);
    } catch (error) {
        res.status(500).json({ message: 'Error accepting friend request', error: error.message });
    }
};

// Reject friend request
exports.rejectFriendRequest = async (req, res) => {
    try {
        const { requestId } = req.body;
        const friendship = await Friendship.findOneAndDelete({
            _id: requestId,
            recipient: req.user.id,
            status: 'pending'
        });

        if (!friendship) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        res.status(200).json({ message: 'Friend request rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting friend request', error: error.message });
    }
};

// Get all friends
exports.getFriends = async (req, res) => {
    try {
        const friendships = await Friendship.find({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ]
        }).populate('requester recipient', 'username name bio');

        // Extract the friend's data from the friendship object
        const friends = friendships.map(f => {
            return f.requester._id.toString() === req.user.id
                ? f.recipient
                : f.requester;
        });

        res.status(200).json(friends);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching friends', error: error.message });
    }
};

// Get pending requests (those received by the user)
exports.getPendingRequests = async (req, res) => {
    try {
        const requests = await Friendship.find({
            recipient: req.user.id,
            status: 'pending'
        }).populate('requester', 'username name');

        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching requests', error: error.message });
    }
};
