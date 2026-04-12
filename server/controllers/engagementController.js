const MovieEngagement = require('../models/MovieEngagement');
const Media = require('../models/Media');
const Friendship = require('../models/Friendship');
const User = require('../models/User');

const getFriendIds = async (userId) => {
    const friendships = await Friendship.find({
        $or: [{ requester: userId }, { recipient: userId }],
        status: 'accepted'
    });
    return friendships.map(f =>
        f.requester.toString() === userId.toString()
            ? f.recipient.toString()
            : f.requester.toString()
    );
};

// GET /api/engagement/:imdbID
exports.getEngagement = async (req, res) => {
    try {
        const { imdbID } = req.params;
        const requesterId = req.user.id;

        const [engagement, addedToListCount, friendIds] = await Promise.all([
            MovieEngagement.findOne({ imdbID })
                .populate('likes.userId', 'username name profilePicture isPrivate')
                .populate('comments.userId', 'username name profilePicture isPrivate'),
            Media.countDocuments({ imdbID }),
            getFriendIds(requesterId)
        ]);

        if (!engagement) {
            return res.json({
                likeCount: 0,
                commentCount: 0,
                addedToListCount,
                userHasLiked: false,
                comments: []
            });
        }

        const friendIdSet = new Set(friendIds.map(id => id.toString()));

        const isVisible = (user) => {
            if (!user) return false;
            if (!user.isPrivate) return true;
            return friendIdSet.has(user._id.toString()) || user._id.toString() === requesterId.toString();
        };

        const userHasLiked = engagement.likes.some(
            l => l.userId && l.userId._id.toString() === requesterId.toString()
        );

        const visibleComments = engagement.comments
            .filter(c => isVisible(c.userId))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(c => ({
                _id: c._id,
                userId: c.userId._id,
                username: c.userId.username,
                name: c.userId.name,
                profilePicture: c.userId.profilePicture,
                text: c.text,
                heartCount: c.hearts.length,
                userHasHearted: c.hearts.some(h => h.toString() === requesterId.toString()),
                createdAt: c.createdAt
            }));

        res.json({
            likeCount: engagement.likes.length,
            commentCount: engagement.comments.length,
            addedToListCount,
            userHasLiked,
            comments: visibleComments
        });
    } catch (err) {
        console.error('getEngagement error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/engagement/:imdbID/counts — lightweight counts only (for card hover)
exports.getCounts = async (req, res) => {
    try {
        const { imdbID } = req.params;

        const [engagement, addedToListCount] = await Promise.all([
            MovieEngagement.findOne({ imdbID }, 'likes comments'),
            Media.countDocuments({ imdbID })
        ]);

        res.json({
            likeCount: engagement ? engagement.likes.length : 0,
            commentCount: engagement ? engagement.comments.length : 0,
            addedToListCount
        });
    } catch (err) {
        console.error('getCounts error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/engagement/:imdbID/like
exports.toggleLike = async (req, res) => {
    try {
        const { imdbID } = req.params;
        const userId = req.user.id;

        let engagement = await MovieEngagement.findOne({ imdbID });
        if (!engagement) {
            engagement = new MovieEngagement({ imdbID, likes: [], comments: [] });
        }

        const likeIndex = engagement.likes.findIndex(
            l => l.userId && l.userId.toString() === userId.toString()
        );

        let liked;
        if (likeIndex > -1) {
            engagement.likes.splice(likeIndex, 1);
            liked = false;
        } else {
            engagement.likes.push({ userId });
            liked = true;
        }

        await engagement.save();
        res.json({ liked, likeCount: engagement.likes.length });
    } catch (err) {
        console.error('toggleLike error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/engagement/:imdbID/comment
exports.addComment = async (req, res) => {
    try {
        const { imdbID } = req.params;
        const { text } = req.body;
        const userId = req.user.id;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ message: 'Comment text is required' });
        }
        if (text.length > 500) {
            return res.status(400).json({ message: 'Comment cannot exceed 500 characters' });
        }

        let engagement = await MovieEngagement.findOne({ imdbID });
        if (!engagement) {
            engagement = new MovieEngagement({ imdbID, likes: [], comments: [] });
        }

        engagement.comments.push({ userId, text: text.trim(), hearts: [] });
        await engagement.save();

        const user = await User.findById(userId).select('username name profilePicture');
        const newComment = engagement.comments[engagement.comments.length - 1];

        res.status(201).json({
            _id: newComment._id,
            userId,
            username: user.username,
            name: user.name,
            profilePicture: user.profilePicture,
            text: newComment.text,
            heartCount: 0,
            userHasHearted: false,
            createdAt: newComment.createdAt
        });
    } catch (err) {
        console.error('addComment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /api/engagement/:imdbID/comment/:commentId
exports.deleteComment = async (req, res) => {
    try {
        const { imdbID, commentId } = req.params;
        const userId = req.user.id;

        const engagement = await MovieEngagement.findOne({ imdbID });
        if (!engagement) return res.status(404).json({ message: 'Not found' });

        const comment = engagement.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });
        if (comment.userId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        comment.deleteOne();
        await engagement.save();
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error('deleteComment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/engagement/:imdbID/comment/:commentId/heart
exports.toggleCommentHeart = async (req, res) => {
    try {
        const { imdbID, commentId } = req.params;
        const userId = req.user.id;

        const engagement = await MovieEngagement.findOne({ imdbID });
        if (!engagement) return res.status(404).json({ message: 'Not found' });

        const comment = engagement.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        const heartIndex = comment.hearts.findIndex(h => h.toString() === userId.toString());
        let hearted;
        if (heartIndex > -1) {
            comment.hearts.splice(heartIndex, 1);
            hearted = false;
        } else {
            comment.hearts.push(userId);
            hearted = true;
        }

        await engagement.save();
        res.json({ hearted, heartCount: comment.hearts.length });
    } catch (err) {
        console.error('toggleCommentHeart error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/engagement/:imdbID/watched-by-friends
exports.getWatchedByFriends = async (req, res) => {
    try {
        const { imdbID } = req.params;
        const userId = req.user.id;

        const friendIds = await getFriendIds(userId);

        const watchers = await Media.find({
            imdbID,
            status: 'watched',
            userId: { $in: friendIds }
        }).populate('userId', 'username name profilePicture');

        const friends = watchers.map(w => ({
            _id: w.userId._id,
            username: w.userId.username,
            name: w.userId.name,
            profilePicture: w.userId.profilePicture
        }));

        res.json({ friends });
    } catch (err) {
        console.error('getWatchedByFriends error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
