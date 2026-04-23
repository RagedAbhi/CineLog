const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const gameService = require('./gameService');
const gameController = require('../controllers/gameController');

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
            
            // Cleanup game rooms on disconnect
            const gameRooms = Array.from(gameService.getRooms ? gameService.getRooms().values() : []); // Fallback if getRooms not added
            // Actually, we'll iterate over all rooms to find where this socket is
            // Better to track game rooms on the socket object like we do with _watchRooms
            if (socket._gameRoomCode) {
                const room = gameService.getRoom(socket._gameRoomCode);
                if (room && room.status === 'in-progress') {
                    io.to(socket._gameRoomCode).emit('game:player_left', { 
                        username: socket.user.username 
                    });
                    gameService.endGame(socket._gameRoomCode);
                }
                gameService.deleteRoom(socket._gameRoomCode);
            }

            logger.info(`[Socket] Disconnected: ${socket.id}`);
        });

        // ── Games Feature ────────────────────────────────────────────────────
        socket.on('game:join_room', ({ roomCode }) => {
            if (!roomCode) return;
            const room = gameService.getRoom(roomCode);
            if (!room) return;

            gameService.setSocketId(roomCode, socket.user._id.toString(), socket.id);
            socket.join(roomCode);
            socket._gameRoomCode = roomCode;

            if (room.guest && room.guest.userId === socket.user._id.toString()) {
                // Notify host that guest joined
                const hostSocketId = room.host.socketId;
                if (hostSocketId) {
                    io.to(hostSocketId).emit('game:player_joined', { 
                        username: socket.user.username 
                    });
                }
            }
            logger.info(`[Socket Game] ${socket.user.username} joined game room ${roomCode}`);
        });

        socket.on('game:start', async ({ roomCode }) => {
            const room = gameService.getRoom(roomCode);
            if (!room || room.host.userId !== socket.user._id.toString()) return;

            try {
                let puzzle;
                if (room.game === 'hangman') {
                    puzzle = await gameController.getHangmanPuzzle(room.host.userId);
                    if (puzzle && room.guest) {
                        puzzle.turn = room.host.userId; // Host starts
                    }
                } else if (room.game === 'plot-redacted') {
                    puzzle = await gameController.getPlotRedactedPuzzle(room.host.userId);
                }

                if (!puzzle) {
                    return socket.emit('game:error', { message: 'Not enough movies to start a game!' });
                }

                gameService.startRound(roomCode, puzzle);
                
                // Emit puzzle without answer
                const { answer, ...puzzleData } = puzzle;
                io.to(roomCode).emit('game:puzzle', {
                    ...puzzleData,
                    round: room.round,
                    maxRounds: room.maxRounds
                });
            } catch (err) {
                logger.error('[Socket Game Start]', err);
                socket.emit('game:error', { message: 'Failed to start game' });
            }
        });

        socket.on('game:guess_letter', ({ roomCode, letter }) => {
            const room = gameService.getRoom(roomCode);
            if (!room || room.status !== 'in-progress' || room.game !== 'hangman') return;

            const puzzle = room.currentPuzzle;
            if (puzzle.turn && puzzle.turn !== socket.user._id.toString()) return;

            const guess = letter.toLowerCase();
            if (puzzle.guessedLetters.includes(guess)) return;

            puzzle.guessedLetters.push(guess);
            const answer = puzzle.answer.toLowerCase();
            let correct = false;

            if (answer.includes(guess)) {
                correct = true;
                // Update displayState
                for (let i = 0; i < puzzle.answer.length; i++) {
                    if (puzzle.answer[i].toLowerCase() === guess) {
                        puzzle.displayState[i] = puzzle.answer[i];
                    }
                }
                gameService.updateScore(roomCode, socket.user._id.toString(), 15);
            } else {
                puzzle.wrongGuesses += 1;
                gameService.updateScore(roomCode, socket.user._id.toString(), -5);
                // Switch turn
                if (room.guest) {
                    puzzle.turn = puzzle.turn === room.host.userId ? room.guest.userId : room.host.userId;
                }
            }

            const isWon = !puzzle.displayState.includes('_');
            const isLost = puzzle.wrongGuesses >= puzzle.maxWrong;

            io.to(roomCode).emit('game:state_update', {
                displayState: puzzle.displayState,
                guessedLetters: puzzle.guessedLetters,
                wrongGuesses: puzzle.wrongGuesses,
                turn: puzzle.turn,
                scores: room.scores
            });

            if (isWon || isLost) {
                if (isWon) {
                    gameService.updateScore(roomCode, socket.user._id.toString(), 50);
                }
                
                io.to(roomCode).emit('game:round_end', {
                    result: isWon ? 'won' : 'lost',
                    answer: puzzle.answer,
                    metadata: puzzle.metadata,
                    scores: room.scores
                });

                handleNextRound(roomCode);
            }
        });

        socket.on('game:submit_answer', ({ roomCode, answer: submission }) => {
            const room = gameService.getRoom(roomCode);
            if (!room || room.status !== 'in-progress' || room.game !== 'plot-redacted') return;

            const puzzle = room.currentPuzzle;
            const normalize = (s) => s.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^\w]/g, '');
            const isCorrect = normalize(submission) === normalize(puzzle.answer);

            if (isCorrect) {
                let score = 100 - (puzzle.hintsUsed * 40);
                if (score < 20) score = 20; // Minimum score

                // Multiplayer speed bonus logic
                const alreadyAnswered = Object.keys(puzzle.submissions).length > 0;
                if (alreadyAnswered) score = Math.floor(score * 0.8);

                gameService.updateScore(roomCode, socket.user._id.toString(), score);
                puzzle.submissions[socket.user._id.toString()] = [submission];

                io.to(roomCode).emit('game:round_end', {
                    result: 'correct',
                    answeredBy: socket.user.username,
                    answer: puzzle.answer,
                    metadata: puzzle.metadata,
                    scores: room.scores
                });

                handleNextRound(roomCode);
            } else {
                gameService.updateScore(roomCode, socket.user._id.toString(), -10);
                if (!puzzle.submissions[socket.user._id.toString()]) {
                    puzzle.submissions[socket.user._id.toString()] = [];
                }
                puzzle.submissions[socket.user._id.toString()].push(submission);

                io.to(roomCode).emit('game:state_update', {
                    wrongSubmission: true,
                    scores: room.scores
                });
            }
        });

        socket.on('game:hint_request', ({ roomCode }) => {
            const room = gameService.getRoom(roomCode);
            if (!room || room.status !== 'in-progress' || room.game !== 'plot-redacted') return;

            const puzzle = room.currentPuzzle;
            if (puzzle.hintsUsed < 2) {
                puzzle.hintsUsed += 1;
                const hint = puzzle.hints[puzzle.hintsUsed - 1];
                io.to(roomCode).emit('game:hint', { hint, hintsUsed: puzzle.hintsUsed });
            }
        });

        socket.on('game:give_up', ({ roomCode }) => {
            const room = gameService.getRoom(roomCode);
            if (!room || room.status !== 'in-progress') return;

            const puzzle = room.currentPuzzle;
            
            io.to(roomCode).emit('game:round_end', {
                result: 'gave-up',
                answer: puzzle.answer,
                metadata: puzzle.metadata,
                scores: room.scores
            });

            handleNextRound(roomCode);
        });

        async function handleNextRound(roomCode) {
            const room = gameService.getRoom(roomCode);
            if (!room) return;

            setTimeout(async () => {
                const isOver = gameService.advanceRound(roomCode);
                if (isOver) {
                    const scores = room.scores;
                    let winner = 'draw';
                    const userIds = Object.keys(scores);
                    if (userIds.length === 2) {
                        if (scores[userIds[0]] > scores[userIds[1]]) winner = userIds[0];
                        else if (scores[userIds[1]] > scores[userIds[0]]) winner = userIds[1];
                    }
                    io.to(roomCode).emit('game:over', { scores, winner });
                } else {
                    io.to(roomCode).emit('game:next_round');
                    
                    // Generate new puzzle
                    let puzzle;
                    if (room.game === 'hangman') {
                        puzzle = await gameController.getHangmanPuzzle(room.host.userId);
                        if (puzzle && room.guest) {
                            // Alternate starting turn
                            puzzle.turn = room.round % 2 === 1 ? room.host.userId : room.guest.userId;
                        }
                    } else if (room.game === 'plot-redacted') {
                        puzzle = await gameController.getPlotRedactedPuzzle(room.host.userId);
                    }

                    if (puzzle) {
                        gameService.startRound(roomCode, puzzle);
                        const { answer, ...puzzleData } = puzzle;
                        io.to(roomCode).emit('game:puzzle', {
                            ...puzzleData,
                            round: room.round,
                            maxRounds: room.maxRounds
                        });
                    }
                }
            }, 5000);
        }
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
