const Message = require('../models/Message');

// Send a message
exports.sendMessage = async (req, res) => {
    try {
        const { receiverId, text, mediaAddon } = req.body;
        
        const message = await Message.create({
            sender: req.user.id,
            receiver: receiverId,
            text,
            mediaAddon
        });

        res.status(201).json(message);
    } catch (error) {
        res.status(400).json({ message: 'Error sending message', error: error.message });
    }
};

// Get conversation with a friend
exports.getConversation = async (req, res) => {
    try {
        const { friendId } = req.params;
        
        const messages = await Message.find({
            $or: [
                { sender: req.user.id, receiver: friendId },
                { sender: friendId, receiver: req.user.id }
            ]
        })
        .sort({ createdAt: 1 })
        .limit(100);

        // Mark unread messages as read
        await Message.updateMany(
            { sender: friendId, receiver: req.user.id, read: false },
            { $set: { read: true } }
        );

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching conversation', error: error.message });
    }
};

// Get recent chats (last message from each friend)
exports.getRecentChats = async (req, res) => {
    try {
        // This is a bit more complex, for now we will return all recent messages
        // and let the client filter for uniqueness per friend
        const messages = await Message.find({
            $or: [{ sender: req.user.id }, { receiver: req.user.id }]
        })
        .sort({ createdAt: -1 })
        .limit(50);
        
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching recent chats', error: error.message });
    }
};
