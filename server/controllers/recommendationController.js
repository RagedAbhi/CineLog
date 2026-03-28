const Recommendation = require('../models/Recommendation');
const Friendship = require('../models/Friendship');
const mongoose = require('mongoose');
const https = require('https');

// Helper: verify mediaType and genre from OMDB using native https
const verifyMediaInfo = (imdbID, clientType, clientGenre) => {
    return new Promise((resolve) => {
        if (!imdbID) return resolve({ type: clientType, genre: clientGenre });
        const apiKey = process.env.REACT_APP_OMDB_API_KEY || process.env.OMDB_API_KEY;
        if (!apiKey) return resolve({ type: clientType, genre: clientGenre });
        const url = `https://www.omdbapi.com/?i=${imdbID}&apikey=${apiKey}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    let type = clientType;
                    if (json.Type === 'series') type = 'series';
                    else if (json.Type === 'movie') type = 'movie';

                    // Use OMDB genre if client genre is missing or "Unknown"
                    const genre = (!clientGenre || clientGenre === 'Unknown') ? (json.Genre || '') : clientGenre;
                    
                    return resolve({ type, genre });
                } catch (e) {}
                resolve({ type: clientType, genre: clientGenre });
            });
        }).on('error', () => resolve({ type: clientType, genre: clientGenre }));
    });
};

// Send a recommendation to a friend
exports.sendRecommendation = async (req, res) => {
    try {
        const { receiverId, mediaTitle, mediaType, genre, imdbID, poster, message } = req.body;

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

        // Always verify info from OMDB to ensure accuracy
        const { type: verifiedType, genre: verifiedGenre } = await verifyMediaInfo(imdbID, mediaType, genre);
 
        // Prevent duplicates from same sender to same receiver
        if (imdbID) {
            const existing = await Recommendation.findOne({
                sender: req.user.id,
                receiver: receiverId,
                imdbID
            });
            if (existing) {
                return res.status(400).json({ message: 'You have already recommended this to this friend' });
            }
        } else {
            const existing = await Recommendation.findOne({
                sender: req.user.id,
                receiver: receiverId,
                mediaTitle: mediaTitle,
                mediaType: verifiedType
            });
            if (existing) {
                return res.status(400).json({ message: 'You have already recommended this to this friend' });
            }
        }

        const recommendation = await Recommendation.create({
            sender: req.user.id,
            receiver: receiverId,
            mediaTitle,
            mediaType: verifiedType,
            genre: verifiedGenre || '',
            imdbID,
            poster,
            message
        });

        // PRUNE: Keep only last 10 activities (recommendations) for the receiver
        const userRecs = await Recommendation.find({ receiver: receiverId }).sort({ createdAt: -1 });
        if (userRecs.length > 10) {
            const idsToDelete = userRecs.slice(10).map(r => r._id);
            await Recommendation.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`Pruned ${idsToDelete.length} old recommendations for user ${receiverId}`);
        }

        res.status(201).json(recommendation);
    } catch (error) {
        console.error('Error in sendRecommendation:', error);
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

// Get a single recommendation by ID (supports MongoDB _id or imdbID)
exports.getRecommendationById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('DEBUG: getRecommendationById - looking for', id, 'for user', req.user.id);
        
        let recommendation;
        
        // 1. Try finding by MongoDB _id if it's a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(id)) {
            recommendation = await Recommendation.findById(id).populate('sender', 'username name');
        }
        
        // 2. Fallback: Try finding by imdbID for this user if not found by _id
        if (!recommendation) {
            console.log('DEBUG: Not found by _id, trying imdbID lookup');
            recommendation = await Recommendation.findOne({ 
                imdbID: id, 
                $or: [
                    { receiver: req.user.id },
                    { sender: req.user.id }
                ]
            }).populate('sender', 'username name');
        }

        if (!recommendation) {
            return res.status(404).json({ message: 'Recommendation not found' });
        }
        
        res.status(200).json(recommendation);
    } catch (error) {
        console.error('DEBUG: Error in getRecommendationById:', error);
        res.status(500).json({ message: 'Error fetching recommendation', error: error.message });
    }
};

// Mark all recommendations from a specific sender as read
exports.markAllFromSenderAsRead = async (req, res) => {
    try {
        const { senderId } = req.params;
        const result = await Recommendation.updateMany(
            { 
                sender: new mongoose.Types.ObjectId(senderId), 
                receiver: new mongoose.Types.ObjectId(req.user.id), 
                read: false 
            },
            { read: true }
        );
        res.status(200).json({ message: 'All recommendations from sender marked as read', modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error('[markAllFromSenderAsRead] Error:', error);
        res.status(500).json({ message: 'Error updating recommendations', error: error.message });
    }
};

// Delete (dismiss) a recommendation
exports.deleteRecommendation = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid recommendation ID' });
        }

        const rec = await Recommendation.findOneAndDelete({
            _id: new mongoose.Types.ObjectId(req.params.id),
            $or: [
                { receiver: new mongoose.Types.ObjectId(req.user.id) },
                { sender: new mongoose.Types.ObjectId(req.user.id) }
            ]
        });
        
        if (!rec) {
            return res.status(404).json({ message: 'Recommendation not found or not authorized' });
        }
        res.status(200).json({ message: 'Recommendation dismissed' });
    } catch (error) {
        console.error('[deleteRecommendation] Error:', error);
        res.status(500).json({ message: 'Error deleting recommendation', error: error.message });
    }
};

// Update recommendation metadata (e.g. fill missing genre)
exports.updateMetadata = async (req, res) => {
    try {
        const { id } = req.params;
        const { genre } = req.body;

        if (!genre) return res.status(400).json({ message: 'Genre is required' });

        const recommendation = await Recommendation.findOneAndUpdate(
            { _id: id, $or: [{ receiver: req.user.id }, { sender: req.user.id }] },
            { genre },
            { new: true }
        );

        if (!recommendation) {
            return res.status(404).json({ message: 'Recommendation not found or not authorized' });
        }

        res.status(200).json(recommendation);
    } catch (error) {
        console.error('[updateMetadata] Error:', error);
        res.status(500).json({ message: 'Error updating metadata', error: error.message });
    }
};
