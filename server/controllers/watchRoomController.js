const WatchRoom = require('../models/WatchRoom');
const socketService = require('../services/socketService');

const populateRoom = (query) =>
    query
        .populate('host', 'username name profilePicture')
        .populate('members.user', 'username name profilePicture');

// POST /api/rooms — Create a new watch room
exports.createRoom = async (req, res) => {
    try {
        const { contentId, contentTitle, contentType, netflixUrl } = req.body;
        const userId = req.user._id;

        // Dissolve any previous active room hosted by this user
        await WatchRoom.updateMany({ host: userId, isActive: true }, { isActive: false });

        const room = await WatchRoom.create({
            host: userId,
            members: [{ user: userId, isActive: true }],
            contentId: contentId || '',
            contentTitle: contentTitle || '',
            contentType: contentType || 'movie',
            netflixUrl: netflixUrl || '',
            platform: 'netflix'
        });

        const populated = await populateRoom(WatchRoom.findById(room._id));
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create room', error: err.message });
    }
};

// GET /api/rooms/:code — Fetch room state
exports.getRoom = async (req, res) => {
    try {
        const room = await populateRoom(
            WatchRoom.findOne({ roomCode: req.params.code, isActive: true })
        );
        if (!room) return res.status(404).json({ message: 'Room not found or has ended' });
        res.json(room);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching room', error: err.message });
    }
};

// POST /api/rooms/:code/join — Join existing room
exports.joinRoom = async (req, res) => {
    try {
        const userId = req.user._id;
        const room = await WatchRoom.findOne({ roomCode: req.params.code, isActive: true });
        if (!room) return res.status(404).json({ message: 'Room not found or has ended' });

        const existing = room.members.find(m => m.user.toString() === userId.toString());
        if (existing) {
            existing.isActive = true;
        } else {
            room.members.push({ user: userId, isActive: true });
        }
        await room.save();

        const populated = await populateRoom(WatchRoom.findById(room._id));

        // Notify existing members via socket
        const joiner = populated.members.find(m => m.user._id.toString() === userId.toString());
        socketService.toRoom(room.roomCode, 'room:member_join', {
            user: joiner?.user,
            members: populated.members.filter(m => m.isActive)
        });

        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: 'Error joining room', error: err.message });
    }
};

// POST /api/rooms/:code/leave — Leave room
exports.leaveRoom = async (req, res) => {
    try {
        const userId = req.user._id;
        const room = await WatchRoom.findOne({ roomCode: req.params.code, isActive: true });
        if (!room) return res.status(404).json({ message: 'Room not found' });

        if (room.host.toString() === userId.toString()) {
            // Host dissolved the room
            room.isActive = false;
            await room.save();
            socketService.toRoom(room.roomCode, 'room:dissolved', {});
            return res.json({ dissolved: true });
        }

        const member = room.members.find(m => m.user.toString() === userId.toString());
        if (member) {
            member.isActive = false;
            await room.save();
        }

        const populated = await populateRoom(WatchRoom.findById(room._id));
        socketService.toRoom(room.roomCode, 'room:member_left', {
            userId: userId.toString(),
            members: populated.members.filter(m => m.isActive)
        });

        res.json({ left: true });
    } catch (err) {
        res.status(500).json({ message: 'Error leaving room', error: err.message });
    }
};
