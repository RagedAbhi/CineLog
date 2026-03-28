const Recommendation = require('../models/Recommendation');
const Friendship = require('../models/Friendship');
const mongoose = require('mongoose');
const https = require('https');

// Helper: verify mediaType from OMDB using native https
const verifyMediaType = (imdbID, clientType) => {
    return new Promise((resolve) => {
        if (!imdbID) return resolve(clientType);
        const apiKey = process.env.REACT_APP_OMDB_API_KEY || process.env.OMDB_API_KEY;
        if (!apiKey) return resolve(clientType);
        const url = `https://www.omdbapi.com/?i=${imdbID}&apikey=${apiKey}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.Type === 'series') return resolve('series');
                    if (json.Type === 'movie') return resolve('movie');
                } catch (e) {}
                resolve(clientType);
            });
        }).on('error', () => resolve(clientType));
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

        // Always verify mediaType from OMDB to prevent misclassification
        const verifiedType = await verifyMediaType(imdbID, mediaType);
 
        // Prevent duplicates from same sender to same receiver
        const existingQuery = {
            sender: req.user.id,
            receiver: receiverId
        };

        if (imdbID) {
            existingQuery.imdbID = imdbID;
        } else {
            // Fallback to title check if no imdbID is provided (less ideal but better than nothing)
            existingQuery.mediaTitle = { $regex: new RegExp(`^${mediaTitle}$`, 'i') };
        }

        const existing = await Recommendation.findOne(existingQuery);
        
        if (existing) {
            return res.status(400).json({ 
                message: `You have already recommended "${mediaTitle}" to this friend` 
            });
        }

        const recommendation = await Recommendation.create({
            sender: req.user.id,
            receiver: receiverId,
            mediaTitle,
            mediaType: verifiedType,
            genre: genre || '',
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

        console.log('Sending recommendations to client:', recommendations.length);
        if (recommendations.length > 0) {
            console.log('First recommendation ID:', recommendations[0]._id);
        }

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
// Get a single recommendation by ID
exports.getRecommendationById = async (req, res) => {
    try {
        console.log('DEBUG: getRecommendationById - looking for', req.params.id, 'for user', req.user.id);
        const recommendation = await Recommendation.findById(req.params.id).populate('sender', 'username name');

        if (!recommendation) {
            console.log('DEBUG: Recommendation NOT in DB');
            return res.status(404).json({ message: 'Recommendation not found' });
        }
        
        console.log('DEBUG: Recommendation receiver:', recommendation.receiver.toString());
        if (recommendation.receiver.toString() !== req.user.id.toString()) {
            console.log('DEBUG: Recommendation receiver mismatch');
            return res.status(403).json({ message: 'Not authorized to view this recommendation' });
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
        console.log(`[markAllFromSenderAsRead] Clearing recs from ${senderId} for user ${req.user.id}`);
        const result = await Recommendation.updateMany(
            { 
                sender: new mongoose.Types.ObjectId(senderId), 
                receiver: new mongoose.Types.ObjectId(req.user.id), 
                read: false 
            },
            { read: true }
        );
        console.log(`[markAllFromSenderAsRead] Updated ${result.modifiedCount} recommendations`);
        res.status(200).json({ message: 'All recommendations from sender marked as read', modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error('[markAllFromSenderAsRead] Error:', error);
        res.status(500).json({ message: 'Error updating recommendations', error: error.message });
    }
};

// Delete (dismiss) a recommendation
exports.deleteRecommendation = async (req, res) => {
    try {
        console.log(`[deleteRecommendation] id=${req.params.id}, user=${req.user.id}`);
        
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
        
        console.log(`[deleteRecommendation] result:`, rec ? 'DELETED' : 'NOT FOUND');
        
        if (!rec) {
            // Try without receiver restriction to check if it exists at all
            const exists = await Recommendation.findById(req.params.id);
            console.log('[deleteRecommendation] exists without receiver filter:', exists ? `yes, receiver=${exists.receiver}` : 'no');
            return res.status(404).json({ message: 'Recommendation not found or not authorized' });
        }
        res.status(200).json({ message: 'Recommendation dismissed' });
    } catch (error) {
        console.error('[deleteRecommendation] Error:', error);
        res.status(500).json({ message: 'Error deleting recommendation', error: error.message });
    }
};
