require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketService = require('./services/socketService');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

const authRoutes = require('./routes/authRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const userRoutes = require('./routes/userRoutes');
const friendRoutes = require('./routes/friendRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const searchRoutes = require('./routes/searchRoutes');
const watchRoomRoutes = require('./routes/watchRoomRoutes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
socketService.init(server);

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: false, // Required to serve images from /uploads
}));
app.use(cors());
app.use(express.json());

// Global Rate Limiting — skip in development, generous in production
const isDev = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 10000 : 500, // Very high limit in dev, generous in production
    skip: () => isDev, // Completely skip in development
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again in 15 minutes.' }
});
app.use('/api/', limiter);

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/rooms', watchRoomRoutes);

// Database Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinelog';
logger.info(`Connecting to MongoDB at: ${mongoURI.replace(/:([^:@]+)@/, ':****@')}`);

mongoose.connect(mongoURI)
    .then(() => logger.info('MongoDB connected successfully'))
    .catch(err => {
        logger.error('MongoDB connection error:', err);
        if (mongoURI !== 'mongodb://127.0.0.1:27017/cinelog') {
            logger.info('Retrying with local MongoDB fallback...');
            mongoose.connect('mongodb://127.0.0.1:27017/cinelog')
                .then(() => logger.info('Connected to local MongoDB fallback'))
                .catch(localErr => logger.error('Local fallback failed:', localErr));
        }
    });

// Basic Route
app.get('/', (req, res) => {
    res.send('CineLog API is running...');
});

// Start Server
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
