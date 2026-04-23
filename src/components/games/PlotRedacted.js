import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Send, HelpCircle } from 'lucide-react';

const PlotRedacted = ({ roomCode, puzzle, scores, emit }) => {
    const [guess, setGuess] = useState('');
    const [wrongFeedback, setWrongFeedback] = useState(false);
    const { redactedPlot, hintsUsed, revealedHints } = puzzle;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!guess.trim()) return;
        emit('game:submit_answer', { roomCode, answer: guess });
        setGuess('');
    };

    const handleHint = () => {
        if (hintsUsed >= 2) return;
        emit('game:hint_request', { roomCode });
    };

    // React to wrong guesses if the room controller sends feedback
    // In this simplified version, we'll let GameRoom handle it via props if needed
    // but the prompt says emit logic is here.

    return (
        <div className="plot-redacted-game">
            <div className="game-layout">
                <div className="plot-section">
                    <div className="plot-card">
                        <div className="plot-content">
                            {redactedPlot.split(' ').map((word, i) => (
                                <span key={i} className={`word ${word.includes('████') ? 'redacted' : ''}`}>
                                    {word}{' '}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="controls-section">
                    <div className="hints-bar">
                        <button 
                            className={`btn-hint ${hintsUsed >= 1 ? 'revealed' : ''}`}
                            onClick={handleHint}
                            disabled={hintsUsed >= 1}
                        >
                            <Lightbulb size={16} />
                            {hintsUsed >= 1 ? `Year: ${puzzle.revealedHints?.[0]?.value || '?'}` : 'Hint 1: Release Year'}
                        </button>
                        <button 
                            className={`btn-hint ${hintsUsed >= 2 ? 'revealed' : ''}`}
                            onClick={handleHint}
                            disabled={hintsUsed < 1 || hintsUsed >= 2}
                        >
                            <Lightbulb size={16} />
                            {hintsUsed >= 2 ? `Genre: ${puzzle.revealedHints?.[1]?.value || '?'}` : 'Hint 2: Genre'}
                        </button>
                    </div>

                    <form className="guess-form" onSubmit={handleSubmit}>
                        <div className="input-group">
                            <input 
                                type="text"
                                placeholder="Guess the movie title..."
                                value={guess}
                                onChange={(e) => setGuess(e.target.value)}
                                autoComplete="off"
                            />
                            <button type="submit" className="btn-submit">
                                <Send size={20} />
                            </button>
                        </div>
                        <AnimatePresence>
                            {wrongFeedback && (
                                <motion.p 
                                    className="error-text"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                >
                                    Incorrect -10pts
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </form>
                </div>
            </div>

            <style jsx>{`
                .plot-redacted-game {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .plot-card {
                    background: var(--bg-secondary);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 30px;
                    margin-bottom: 30px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }
                .plot-content {
                    font-size: 1.1rem;
                    line-height: 1.8;
                    color: var(--text-secondary);
                }
                .word.redacted {
                    background: #444;
                    color: transparent;
                    border-radius: 4px;
                    padding: 0 2px;
                    user-select: none;
                }
                .hints-bar {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 20px;
                    justify-content: center;
                }
                .btn-hint {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 10px 20px;
                    color: white;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .btn-hint.revealed {
                    background: rgba(234, 179, 8, 0.1);
                    border-color: #eab308;
                    color: #eab308;
                }
                .btn-hint:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.1);
                }
                .btn-hint:disabled:not(.revealed) {
                    opacity: 0.3;
                }
                .guess-form {
                    position: relative;
                }
                .input-group {
                    display: flex;
                    background: rgba(0,0,0,0.3);
                    border: 2px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                    padding: 5px;
                    transition: focus-within 0.3s;
                }
                .input-group:focus-within {
                    border-color: var(--accent);
                }
                .input-group input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    padding: 12px 20px;
                    color: white;
                    font-size: 1.1rem;
                    outline: none;
                }
                .btn-submit {
                    background: var(--accent);
                    color: white;
                    border-radius: 12px;
                    width: 48px;
                    height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .error-text {
                    color: #ef4444;
                    font-size: 0.85rem;
                    margin-top: 8px;
                    text-align: center;
                    font-weight: 600;
                }
            `}</style>
        </div>
    );
};

export default PlotRedacted;
