const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

const RecommendationSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    mediaId: String,
    mediaTitle: String,
    mediaType: String,
    imdbID: String,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const Recommendation = mongoose.model('Recommendation', RecommendationSchema);
const User = mongoose.model('User', new mongoose.Schema({ name: String, username: String }));

async function addTestRecs() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Get a user to receive recommendations
    const receiver = await User.findOne({ username: 'ragedabhi' }); // Assuming this is the user
    if (!receiver) {
        console.log('User not found');
        process.exit(1);
    }

    // Get some other users to be senders
    const senders = await User.find({ _id: { $ne: receiver._id } }).limit(3);
    if (senders.length < 3) {
        console.log('Not enough users to create "and N others" case');
        process.exit(1);
    }

    const testMedia = {
        mediaTitle: 'Inception',
        mediaType: 'movie',
        imdbID: 'tt1375666'
    };

    console.log(`Creating 3 recommendations for ${testMedia.mediaTitle} to ${receiver.username}`);

    for (const sender of senders) {
        await Recommendation.create({
            sender: sender._id,
            receiver: receiver._id,
            ...testMedia
        });
    }

    console.log('Test recommendations created successfully');
    process.exit(0);
}

addTestRecs();
