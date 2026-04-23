const rooms = new Map(); // roomCode -> roomState

/**
 * Generates a random 6-character uppercase alphanumeric string.
 */
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom(game, hostUser) {
    let code;
    do {
        code = generateRoomCode();
    } while (rooms.has(code));

    const room = {
        code,
        game,
        host: {
            userId: hostUser._id.toString(),
            socketId: null,
            username: hostUser.username
        },
        guest: null,
        status: 'waiting',
        round: 0,
        maxRounds: 5,
        scores: {
            [hostUser._id.toString()]: 0
        },
        currentPuzzle: null,
        roundResults: [],
        usedMediaIds: []
    };

    rooms.set(code, room);
    return code;
}

function joinRoom(code, guestUser) {
    const room = rooms.get(code);
    if (!room) throw new Error('Room not found');
    if (room.guest) throw new Error('Room is full');
    if (room.host.userId === guestUser._id.toString()) return room; // Host re-joining

    room.guest = {
        userId: guestUser._id.toString(),
        socketId: null,
        username: guestUser.username
    };
    room.scores[guestUser._id.toString()] = 0;
    
    return room;
}

function getRoom(code) {
    return rooms.get(code);
}

function setSocketId(code, userId, socketId) {
    const room = rooms.get(code);
    if (!room) return;

    if (room.host.userId === userId) {
        room.host.socketId = socketId;
    } else if (room.guest && room.guest.userId === userId) {
        room.guest.socketId = socketId;
    }
}

function startRound(code, puzzle) {
    const room = rooms.get(code);
    if (!room) return;

    room.status = 'in-progress';
    room.round += 1;
    room.currentPuzzle = puzzle;
}

function updateScore(code, userId, delta) {
    const room = rooms.get(code);
    if (!room) return;

    if (room.scores[userId] !== undefined) {
        room.scores[userId] += delta;
    }
}

function advanceRound(code) {
    const room = rooms.get(code);
    if (!room) return true;

    if (room.round >= room.maxRounds) {
        room.status = 'finished';
        return true;
    }
    return false;
}

function endGame(code) {
    const room = rooms.get(code);
    if (!room) return;
    room.status = 'finished';
}

function deleteRoom(code) {
    rooms.delete(code);
}

module.exports = {
    createRoom,
    joinRoom,
    getRoom,
    setSocketId,
    startRound,
    updateScore,
    advanceRound,
    endGame,
    deleteRoom,
    generateRoomCode
};
