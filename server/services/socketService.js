const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

let io = null;

// ── In-Memory Room State ──────────────────────────────────────────────────────
// roomCode → { hostSocketId, members: Map<socketId, {user, isBuffering}>, lastState, seq }
const rooms = new Map();

function getOrCreateRoom(roomCode) {
    if (!rooms.has(roomCode)) {
        rooms.set(roomCode, {
            hostSocketId: null,
            members: new Map(),
            lastState: null, // { currentTime, paused, seq }
            seq: 0
        });
    }
    return rooms.get(roomCode);
}

function getRoomMemberList(room) {
    return Array.from(room.members.entries()).map(([sid, m]) => ({
        socketId: sid,
        username: m.user.username,
        avatar: m.user.profilePicture,
        isHost: sid === room.hostSocketId,
        isBuffering: m.isBuffering
    }));
}

function handleLeaveRoom(socket, roomCode) {
    const room = rooms.get(roomCode);
    if (!room || !room.members.has(socket.id)) return;

    room.members.delete(socket.id);
    socket.leave(`room:${roomCode}`);

    const wasHost = socket.id === room.hostSocketId;

    if (room.members.size === 0) {
        rooms.delete(roomCode);
        logger.info(`[Socket] Room ${roomCode} dissolved (empty)`);
        return;
    }

    // Transfer host if host left
    if (wasHost) {
        const newHostSocketId = room.members.keys().next().value;
        room.hostSocketId = newHostSocketId;
        io.to(`room:${roomCode}`).emit('room:host_change', {
            newHostSocketId,
            members: getRoomMemberList(room)
        });
        logger.info(`[Socket] Host transferred in room ${roomCode} → ${newHostSocketId}`);
    }

    io.to(`room:${roomCode}`).emit('room:member_left', {
        socketId: socket.id,
        username: socket.user?.username || 'Unknown',
        members: getRoomMemberList(room)
    });
}

/**
 * Initializes the Socket.io server.
 */
exports.init = (httpServer) => {
    io = new Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    // Authentication Middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error('Authentication error: No token provided'));
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            if (!user) return next(new Error('Authentication error: User not found'));
            socket.user = user;
            socket._watchRooms = new Set(); // track which watch rooms this socket is in
            logger.info(`[Socket Auth] Success: ${user.username} (${socket.id})`);
            next();
        } catch (err) {
            logger.error(`[Socket Auth] ${err.message}`);
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        logger.info(`[Socket] New connection: ${socket.id}`);

        // Personal room (for direct notifications)
        socket.on('join', (userId) => {
            if (userId) {
                socket.join(userId.toString());
                logger.info(`[Socket] User ${userId} joined personal room`);
            }
        });

        // ── Latency Measurement ──────────────────────────────────────────────
        socket.on('room:ping', ({ clientTime }) => {
            socket.emit('room:pong', { clientTime, serverTime: Date.now() });
        });

        // ── Watch Together ───────────────────────────────────────────────────

        socket.on('room:join_socket', (roomCode) => {
            if (!roomCode) return;
            const room = getOrCreateRoom(roomCode);

            // Add member
            room.members.set(socket.id, { user: socket.user, isBuffering: false });
            socket._watchRooms.add(roomCode);

            // First member becomes host
            const isHost = room.hostSocketId === null;
            if (isHost) room.hostSocketId = socket.id;

            socket.join(`room:${roomCode}`);
            logger.info(`[Socket] ${socket.user.username} joined room ${roomCode} (isHost: ${isHost})`);

            // Confirm join with room state
            socket.emit('room:joined', {
                isHost,
                hostSocketId: room.hostSocketId,
                members: getRoomMemberList(room),
                lastState: room.lastState
            });

            // Notify existing members
            socket.to(`room:${roomCode}`).emit('room:member_join', {
                user: {
                    socketId: socket.id,
                    username: socket.user.username,
                    avatar: socket.user.profilePicture
                },
                members: getRoomMemberList(room)
            });
        });

        socket.on('room:leave_socket', (roomCode) => {
            if (roomCode) {
                socket._watchRooms.delete(roomCode);
                handleLeaveRoom(socket, roomCode);
            }
        });

        // ── Playback Sync (host-only) ────────────────────────────────────────
        socket.on('room:sync', ({ roomCode, action, currentTime }) => {
            if (!roomCode) return;
            const room = rooms.get(roomCode);
            if (!room) return;

            room.seq++;
            room.lastState = { currentTime, paused: action === 'pause', seq: room.seq };

            socket.to(`room:${roomCode}`).emit('room:synced', {
                action,
                currentTime,
                seq: room.seq
            });

            logger.info(`[Sync] Room: ${roomCode} | ${socket.user.username} | ${action} @ ${currentTime.toFixed(1)}s | seq:${room.seq}`);
        });

        // ── Heartbeat (host → guests for drift correction) ───────────────────
        socket.on('room:heartbeat', ({ roomCode, currentTime, paused }) => {
            if (!roomCode) return;
            const room = rooms.get(roomCode);
            if (!room || socket.id !== room.hostSocketId) return;

            // Update stored state
            room.lastState = { currentTime, paused, seq: room.seq };

            // Relay to guests only
            socket.to(`room:${roomCode}`).emit('room:heartbeat', {
                currentTime,
                paused,
                sentAt: Date.now()
            });
        });

        // ── Buffering Sync ───────────────────────────────────────────────────
        socket.on('room:buffer_start', ({ roomCode }) => {
            if (!roomCode) return;
            const room = rooms.get(roomCode);
            if (!room) return;
            const member = room.members.get(socket.id);
            if (!member || member.isBuffering) return;

            member.isBuffering = true;
            logger.info(`[Buffer] ${socket.user.username} buffering in room ${roomCode}`);

            io.to(`room:${roomCode}`).emit('room:members_update', {
                members: getRoomMemberList(room)
            });

            // If a guest is buffering, pause the whole room
            if (socket.id !== room.hostSocketId) {
                io.to(`room:${roomCode}`).emit('room:pause_for_buffer', {
                    username: socket.user.username
                });
            }
        });

        socket.on('room:buffer_end', ({ roomCode }) => {
            if (!roomCode) return;
            const room = rooms.get(roomCode);
            if (!room) return;
            const member = room.members.get(socket.id);
            if (!member || !member.isBuffering) return;

            member.isBuffering = false;
            logger.info(`[Buffer] ${socket.user.username} finished buffering in room ${roomCode}`);

            const anyoneBuffering = Array.from(room.members.values()).some(m => m.isBuffering);

            io.to(`room:${roomCode}`).emit('room:members_update', {
                members: getRoomMemberList(room)
            });

            if (!anyoneBuffering) {
                io.to(`room:${roomCode}`).emit('room:resume_after_buffer');
            }
        });

        // ── State Request (late-join fallback) ───────────────────────────────
        socket.on('room:request_state', ({ roomCode }) => {
            if (!roomCode) return;
            const room = rooms.get(roomCode);
            if (!room) return;

            if (room.lastState) {
                // Server has stored state — respond directly
                socket.emit('room:state_response', { state: room.lastState });
            } else {
                // Ask others in the room (host will respond)
                socket.to(`room:${roomCode}`).emit('room:state_request', {
                    requesterSocketId: socket.id
                });
            }
        });

        // Relay state response back to specific requester
        socket.on('room:state_response', ({ roomCode, state, requesterSocketId }) => {
            if (!roomCode || !state) return;
            if (requesterSocketId) {
                io.to(requesterSocketId).emit('room:state_response', { state });
            } else {
                // Fallback: relay to all (shouldn't be needed with server-side state)
                socket.to(`room:${roomCode}`).emit('room:state_response', { state });
            }
        });

        // ── Emoji Reactions ──────────────────────────────────────────────────
        socket.on('room:reaction', ({ roomCode, emoji }) => {
            if (!roomCode || !emoji) return;
            io.to(`room:${roomCode}`).emit('room:reaction', {
                emoji,
                username: socket.user.username,
                socketId: socket.id
            });
        });

        // ── Chat ─────────────────────────────────────────────────────────────
        socket.on('room:chat', ({ roomCode, message }) => {
            if (!roomCode || !message?.trim()) return;
            io.to(`room:${roomCode}`).emit('room:message', {
                message: message.trim(),
                userId: socket.user._id,
                username: socket.user.username,
                avatar: socket.user.profilePicture,
                timestamp: new Date()
            });
        });

        // ── Disconnect ───────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            socket._watchRooms.forEach(roomCode => handleLeaveRoom(socket, roomCode));
            logger.info(`[Socket] Disconnected: ${socket.id}`);
        });
    });

    return io;
};

/**
 * Returns the global io instance.
 */
exports.getIO = () => {
    if (!io) throw new Error('Socket.io not initialized!');
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
