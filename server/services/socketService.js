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

        // ── Watch Together ──────────────────────────────────────────────

        socket.on('room:join_socket', (roomCode) => {
            if (roomCode) {
                socket.join(`room:${roomCode}`);
                logger.info(`[Socket] ${socket.id} joined watch room ${roomCode}`);
            }
        });

        socket.on('room:leave_socket', (roomCode) => {
            if (roomCode) {
                socket.leave(`room:${roomCode}`);
                logger.info(`[Socket] ${socket.id} left watch room ${roomCode}`);
            }
        });

        // Relay play/pause/seek to everyone else in the room
        socket.on('room:sync', ({ roomCode, action, currentTime }) => {
            if (!roomCode) return;
            socket.to(`room:${roomCode}`).emit('room:synced', { action, currentTime, socketId: socket.id });
        });

        // Relay chat to everyone in the room (including sender)
        socket.on('room:chat', ({ roomCode, message, userId, username, avatar }) => {
            if (!roomCode) return;
            io.to(`room:${roomCode}`).emit('room:message', { message, userId, username, avatar, timestamp: new Date() });
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

/**
 * Sends a real-time event to all members of a watch room.
 */
exports.toRoom = (roomCode, event, data) => {
    if (!io) return;
    io.to(`room:${roomCode}`).emit(event, data);
    logger.info(`[Socket] Event '${event}' sent to room ${roomCode}`);
};
