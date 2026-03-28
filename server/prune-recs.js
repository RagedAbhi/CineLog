const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Recommendation = require('./models/Recommendation');
const User = require('./models/User');

dotenv.config({ path: './server/.env' });

const prune = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        // Get all users who have received recommendations
        const recipients = await Recommendation.distinct('receiver');
        console.log(`Checking ${recipients.length} recipients...`);

        let totalPruned = 0;

        for (const receiverId of recipients) {
            const userRecs = await Recommendation.find({ receiver: receiverId }).sort({ createdAt: -1 });
            
            if (userRecs.length > 10) {
                const idsToDelete = userRecs.slice(10).map(r => r._id);
                const result = await Recommendation.deleteMany({ _id: { $in: idsToDelete } });
                totalPruned += result.deletedCount;
                console.log(`Pruned ${result.deletedCount} old recommendations for User ${receiverId}`);
            }
        }

        console.log(`Cleanup complete. Total recommendations pruned: ${totalPruned}`);
        process.exit(0);
    } catch (err) {
        console.error('Prune error:', err);
        process.exit(1);
    }
};

prune();
