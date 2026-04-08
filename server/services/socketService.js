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
        socket.on('room:sync', ({ roomCode, action, currentTime, username }) => {
            if (!roomCode) return;
            
            // Broadcast the sync action to other members
            socket.to(`room:${roomCode}`).emit('room:synced', { action, currentTime, socketId: socket.id });

            // Generate a technical system message for the chat
            const timeStr = new Date(currentTime * 1000).toISOString().substr(11, 8);
            let message = '';
            const name = username || 'Someone';

            if (action === 'play') message = `${name} played the video`;
            else if (action === 'pause') message = `${name} paused the video`;
            else if (action === 'seek') message = `${name} seeked to ${timeStr}`;

            if (message) {
                io.to(`room:${roomCode}`).emit('room:message', { 
                    message, 
                    isSystem: true, 
                    timestamp: new Date() 
                });
            }
        });

        // FIX #4: Late joiner requests current playback state from host
        // Sends the request to everyone ELSE in the room (the host will respond)
        socket.on('room:request_state', ({ roomCode }) => {
            if (!roomCode) return;
            socket.to(`room:${roomCode}`).emit('room:state_request', { requesterSocketId: socket.id });
        });

        // FIX #4: Host sends back current state — forward ONLY to the requester
        socket.on('room:state_response', ({ roomCode, state }) => {
            if (!roomCode || !state) return;
            // Broadcast to the whole room so the newly joined tab gets it
            // (background.js will filter to only Netflix tabs)
            socket.to(`room:${roomCode}`).emit('room:state_response', { state });
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
