const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io = null;

/**
 * Initializes the Socket.io server.
 */
exports.init = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: "*", // Adjust in production to frontend URL
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        logger.info(`[Socket] New connection: ${socket.id}`);

        // Join personal room based on userId (sent via handshake or auth)
        socket.on('join', (userId) => {
            if (userId) {
                socket.join(userId.toString());
                logger.info(`[Socket] User ${userId} joined their personal room.`);
            }
        });

        socket.on('disconnect', () => {
            logger.info(`[Socket] Disconnected: ${socket.id}`);
        });
    });

    return io;
};

/**
 * Returns the global io instance.
 */
exports.getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

/**
 * Sends a real-time event to a specific user.
 */
exports.toUser = (userId, event, data) => {
    if (!io) return;
    io.to(userId.toString()).emit(event, data);
    logger.info(`[Socket] Event '${event}' sent to user ${userId}`);
};
