import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const Hangman = ({ roomCode, userId, puzzle, scores, emit }) => {
    const { displayState, guessedLetters, wrongGuesses, turn, maxWrong, hint } = puzzle;
    const isMyTurn = turn === null || turn === userId;

    const handleGuess = (letter) => {
        const char = letter.toLowerCase();
        if (!isMyTurn || guessedLetters.includes(char)) return;
        emit('game:guess_letter', { roomCode, letter: char });
    };

    // Physical Keyboard Support
    useEffect(() => {
        const handleKeyDown = (e) => {
            const key = e.key.toUpperCase();
            if (ALPHABET.includes(key)) {
                handleGuess(key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isMyTurn, guessedLetters, roomCode]); // Re-bind when state changes

    const HangmanDrawing = ({ wrong }) => (
        <svg width="200" height="250" viewBox="0 0 200 250" className="hangman-svg">
            {/* Gallows */}
            <line x1="20" y1="230" x2="180" y2="230" stroke="white" strokeWidth="4" />
            <line x1="50" y1="230" x2="50" y2="20" stroke="white" strokeWidth="4" />
            <line x1="50" y1="20" x2="130" y2="20" stroke="white" strokeWidth="4" />
            <line x1="130" y1="20" x2="130" y2="50" stroke="white" strokeWidth="4" />

            {/* Body parts - appear based on wrong guesses */}
            {wrong >= 1 && <circle cx="130" cy="70" r="20" stroke="white" strokeWidth="4" fill="none" />} {/* Head */}
            {wrong >= 2 && <line x1="130" y1="90" x2="130" y2="160" stroke="white" strokeWidth="4" />} {/* Body */}
            {wrong >= 3 && <line x1="130" y1="110" x2="100" y2="140" stroke="white" strokeWidth="4" />} {/* Left Arm */}
            {wrong >= 4 && <line x1="130" y1="110" x2="160" y2="140" stroke="white" strokeWidth="4" />} {/* Right Arm */}
            {wrong >= 5 && <line x1="130" y1="160" x2="100" y2="200" stroke="white" strokeWidth="4" />} {/* Left Leg */}
            {wrong >= 6 && <line x1="130" y1="160" x2="160" y2="200" stroke="white" strokeWidth="4" />} {/* Right Leg */}
        </svg>
    );

    return (
        <div className="hangman-game">
            <div className="game-layout">
                <div className="drawing-section">
                    <HangmanDrawing wrong={wrongGuesses} />
                </div>

                <div className="word-section">
                    <div className="word-display">
                        {displayState.join('').split(' ').map((word, wordIdx) => (
                            <div key={wordIdx} className="word-wrapper">
                                {word.split('').map((char, charIdx) => {
                                    const isRevealed = puzzle.isRevealed;
                                    const result = puzzle.revealResult;
                                    return (
                                        <span key={charIdx} className={`char ${isRevealed ? (result === 'won' ? 'revealed-won' : 'revealed-lost') : ''}`}>
                                            {char === '_' ? '' : char}
                                        </span>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    
                    <div className="turn-indicator">
                        {puzzle.isRevealed ? (
                            <div className={`status-pill ${puzzle.revealResult === 'won' ? 'mine' : 'theirs'}`}>
                                {puzzle.revealResult === 'won' ? 'CORRECT!' : 'ROUND OVER'}
                            </div>
                        ) : (
                            <>
                                {turn ? (
                                    <div className={`status-pill ${isMyTurn ? 'mine' : 'theirs'}`}>
                                        {isMyTurn ? "Your Turn" : "Opponent's Turn"}
                                    </div>
                                ) : (
                                    <div className="status-pill mine">Solo Mode</div>
                                )}
                            </>
                        )}
                    </div>

                    <button 
                        className="btn-give-up"
                        onClick={() => emit('game:give_up', { roomCode })}
                    >
                        Give Up
                    </button>

                    {hint && (
                        <div className="hint-display">
                            <span className="hint-label">Hint:</span>
                            <span className="hint-text">{hint}</span>
                        </div>
                    )}
                </div>

                <div className="keyboard-section">
                    <div className="keyboard-grid">
                        {ALPHABET.map(letter => {
                            const isGuessed = guessedLetters.includes(letter.toLowerCase());
                            const isCorrect = isGuessed && puzzle.metadata.title.toLowerCase().includes(letter.toLowerCase());
                            
                            return (
                                <button
                                    key={letter}
                                    className={`key ${isGuessed ? (isCorrect ? 'correct' : 'wrong') : ''}`}
                                    onClick={() => handleGuess(letter)}
                                    disabled={!isMyTurn || isGuessed}
                                >
                                    {letter}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .hangman-game {
                    padding: 20px;
                }
                .game-layout {
                    display: grid;
                    grid-template-columns: 250px 1fr 300px;
                    gap: 40px;
                    align-items: center;
                }
                @media (max-width: 1024px) {
                    .game-layout {
                        grid-template-columns: 1fr;
                        text-align: center;
                    }
                }
                .drawing-section {
                    display: flex;
                    justify-content: center;
                }
                .word-display {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 30px; /* Space between words */
                    justify-content: center;
                    margin-bottom: 30px;
                }
                .word-wrapper {
                    display: flex;
                    gap: 10px; /* Space between letters in a word */
                }
                .char {
                    width: 40px;
                    height: 50px;
                    border-bottom: 3px solid rgba(255, 255, 255, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .char.revealed-won {
                    color: #10b981;
                    border-bottom-color: #10b981;
                    transform: scale(1.1);
                }
                .char.revealed-lost {
                    color: #ef4444;
                    border-bottom-color: #ef4444;
                }
                .status-pill {
                    display: inline-block;
                    padding: 6px 16px;
                    border-radius: 20px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    font-size: 0.8rem;
                }
                .status-pill.mine { background: #10b981; color: white; }
                .status-pill.theirs { background: #ef4444; color: white; opacity: 0.7; }
                
                .btn-give-up {
                    margin-top: 15px;
                    padding: 8px 16px;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .btn-give-up:hover {
                    background: rgba(239, 68, 68, 0.2);
                }

                .keyboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(45px, 1fr));
                    gap: 8px;
                }
                .key {
                    aspect-ratio: 1;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    font-weight: 700;
                    color: white;
                    transition: all 0.2s;
                }
                .key:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.15);
                    transform: translateY(-2px);
                }
                .key.correct {
                    background: rgba(16, 185, 129, 0.2);
                    border-color: #10b981;
                    color: #10b981;
                }
                .key.wrong {
                    background: rgba(239, 68, 68, 0.1);
                    border-color: #ef4444;
                    color: #ef4444;
                    opacity: 0.5;
                }
                .key:disabled {
                    cursor: not-allowed;
                }
                .hint-display {
                    margin-top: 20px;
                    background: rgba(255, 255, 255, 0.03);
                    padding: 10px 15px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                }
                .hint-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .hint-text {
                    font-weight: 600;
                    color: var(--text-secondary);
                }
            `}</style>
        </div>
    );
};

export default Hangman;
