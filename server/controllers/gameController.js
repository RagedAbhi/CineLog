const Media = require('../models/Media');
const User = require('../models/User');
const gameService = require('../services/gameService');
const { redactPlot } = require('../services/regexRedactor');
const logger = require('../utils/logger');

const createRoom = async (req, res) => {
    try {
        const { game } = req.body;
        if (!['hangman', 'plot-redacted'].includes(game)) {
            return res.status(400).json({ message: 'Invalid game type' });
        }

        const roomCode = gameService.createRoom(game, req.user);
        res.status(201).json({ roomCode });
    } catch (error) {
        logger.error('Error creating room:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const joinRoom = async (req, res) => {
    try {
        const { code } = req.params;
        const room = gameService.joinRoom(code, req.user);
        
        // Don't send answer in response
        const roomState = { ...room };
        if (roomState.currentPuzzle) {
            const { answer, ...puzzleWithoutAnswer } = roomState.currentPuzzle;
            roomState.currentPuzzle = puzzleWithoutAnswer;
        }

        res.json(roomState);
    } catch (error) {
        logger.error('Error joining room:', error);
        res.status(400).json({ message: error.message });
    }
};

const getRoom = async (req, res) => {
    try {
        const { code } = req.params;
        const room = gameService.getRoom(code);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        const roomState = { ...room };
        if (roomState.currentPuzzle) {
            const { answer, ...puzzleWithoutAnswer } = roomState.currentPuzzle;
            roomState.currentPuzzle = puzzleWithoutAnswer;
        }

        res.json(roomState);
    } catch (error) {
        logger.error('Error getting room:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const saveGameStats = async (req, res) => {
    try {
        const { game, score, won } = req.body;
        if (!['hangman', 'plot-redacted'].includes(game)) {
            return res.status(400).json({ message: 'Invalid game type' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.gameStats) {
            user.gameStats = {
                hangman: { gamesPlayed: 0, wins: 0, totalScore: 0, highScore: 0 },
                plotRedacted: { gamesPlayed: 0, wins: 0, totalScore: 0, highScore: 0 }
            };
        }

        const stats = game === 'hangman' ? user.gameStats.hangman : user.gameStats.plotRedacted;
        
        stats.gamesPlayed += 1;
        if (won) stats.wins += 1;
        stats.totalScore += score;
        if (score > stats.highScore) stats.highScore = score;

        await user.save();
        res.json(user.gameStats);
    } catch (error) {
        logger.error('Error saving game stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Internal function to generate Hangman puzzle
const getHangmanPuzzle = async (userId, excludeIds = []) => {
    // Query entire Media collection instead of just one user
    const movies = await Media.find({
        _id: { $nin: excludeIds }
    });

    // Filter out short titles
    const validMovies = movies.filter(m => m.title && m.title.replace(/[^\w]/g, '').length >= 4);
    
    if (validMovies.length === 0) return null;

    const selected = validMovies[Math.floor(Math.random() * validMovies.length)];
    const title = selected.title;

    // Initial display state (underscores for letters, actual spaces for spaces)
    const displayState = title.split('').map(char => 
        /[a-zA-Z]/.test(char) ? '_' : char
    );

    return {
        id: selected._id,
        answer: title,
        displayState,
        guessedLetters: [],
        wrongGuesses: 0,
        maxWrong: 6,
        turn: null, // Set by caller for multiplayer
        hint: `A ${selected.genre} ${selected.mediaType} (${selected.year})`,
        metadata: {
            poster: selected.poster,
            year: selected.year,
            mediaType: selected.mediaType,
            title: selected.title
        }
    };
};

// Internal function to generate Plot Redacted puzzle
const getPlotRedactedPuzzle = async (userId, excludeIds = []) => {
    const movies = await Media.find({
        userId,
        status: 'watched',
        plot: { $exists: true },
        _id: { $nin: excludeIds }
    });

    const validMovies = movies.filter(m => m.plot && m.plot.length >= 30);

    if (validMovies.length === 0) return null;

    const selected = validMovies[Math.floor(Math.random() * validMovies.length)];
    const redactedPlot = redactPlot(selected.plot, selected.title);

    return {
        id: selected._id,
        answer: selected.title,
        redactedPlot,
        hintsUsed: 0,
        hints: [
            { label: "Release Year", value: selected.year.toString() },
            { label: "Genre", value: selected.genre }
        ],
        submissions: {},
        metadata: {
            poster: selected.poster,
            year: selected.year,
            genre: selected.genre,
            mediaType: selected.mediaType,
            title: selected.title
        }
    };
};

module.exports = {
    createRoom,
    joinRoom,
    getRoom,
    saveGameStats,
    getHangmanPuzzle,
    getPlotRedactedPuzzle
};
