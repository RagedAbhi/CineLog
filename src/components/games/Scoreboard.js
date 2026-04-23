import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ArrowRight, Home, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Scoreboard = ({ phase, room, userId, roundResult, onPlayAgain }) => {
    const navigate = useNavigate();
    const isGameOver = phase === 'game-over';
    const { scores, host, guest } = room;

    const hostScore = scores[host.userId];
    const guestScore = guest ? scores[guest.userId] : 0;

    let winnerText = '';
    if (isGameOver) {
        if (!guest) winnerText = 'Challenge Complete!';
        else if (hostScore > guestScore) winnerText = `${host.username} Wins!`;
        else if (guestScore > hostScore) winnerText = `${guest.username} Wins!`;
        else winnerText = "It's a Draw!";
    }

    return (
        <div className="scoreboard-container">
            <motion.div 
                className="scoreboard-card"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <div className="scoreboard-header">
                    {isGameOver ? (
                        <>
                            <Trophy size={48} className="text-yellow-500 mb-4" />
                            <h2>{winnerText}</h2>
                        </>
                    ) : (
                        <>
                            <div className="round-badge">
                                {(!room.maxRounds || room.maxRounds === Infinity) ? 'Success!' : `Round ${room.round} of ${room.maxRounds} Complete`}
                            </div>
                            <h2 className={roundResult?.result === 'won' || roundResult?.result === 'correct' ? 'text-green-500' : 'text-red-500'}>
                                {roundResult?.result === 'won' || roundResult?.result === 'correct' ? 'Correct!' : 'Round Over'}
                            </h2>
                            {roundResult?.matchType && roundResult.matchType !== 'exact' && (
                                <div className="match-quality-badge">
                                    {roundResult.matchType === 'subtitle' ? 'Subtitle Match! -10%' : 'Close Call! -20%'}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {roundResult && roundResult.metadata && (
                    <div className="reveal-section">
                        <div className="movie-reveal">
                            <img src={roundResult.metadata.poster} alt="Poster" className="reveal-poster" />
                            <div className="reveal-info">
                                <span className="answer-label">The answer was:</span>
                                <h3>{roundResult.answer}</h3>
                                <p>{roundResult.metadata.year} • {roundResult.metadata.mediaType}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="scores-display">
                    <div className={`score-item ${hostScore >= guestScore ? 'leader' : ''}`}>
                        <span className="player">{host.username}</span>
                        <span className="points">{hostScore} pts</span>
                    </div>
                    {guest && (
                        <div className={`score-item ${guestScore >= hostScore ? 'leader' : ''}`}>
                            <span className="player">{guest.username}</span>
                            <span className="points">{guestScore} pts</span>
                        </div>
                    )}
                </div>

                <div className="scoreboard-footer">
                    {isGameOver ? (
                        <div className="footer-actions">
                            <button className="btn-secondary" onClick={() => navigate('/games')}>
                                <Home size={18} />
                                Back to Hub
                            </button>
                            <button className="btn-primary" onClick={onPlayAgain}>
                                <RefreshCw size={18} />
                                Play Again
                            </button>
                        </div>
                    ) : (
                        <div className="next-round-status">
                            <div className="countdown-bar">
                                <motion.div 
                                    className="bar-fill"
                                    initial={{ width: '100%' }}
                                    animate={{ width: '0%' }}
                                    transition={{ duration: 5, ease: 'linear' }}
                                />
                            </div>
                            <span>Next round starting soon...</span>
                        </div>
                    )}
                </div>
            </motion.div>

            <style jsx>{`
                .scoreboard-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .scoreboard-card {
                    background: var(--bg-secondary);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    padding: 40px;
                    width: 100%;
                    max-width: 550px;
                    text-align: center;
                }
                .round-badge {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-bottom: 10px;
                }
                .match-quality-badge {
                    display: inline-block;
                    margin-top: 10px;
                    padding: 4px 12px;
                    background: rgba(234, 179, 8, 0.1);
                    border: 1px solid rgba(234, 179, 8, 0.3);
                    color: #eab308;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .reveal-section {
                    margin: 30px 0;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 16px;
                    padding: 20px;
                }
                .movie-reveal {
                    display: flex;
                    gap: 20px;
                    align-items: center;
                    text-align: left;
                }
                .reveal-poster {
                    width: 80px;
                    height: 120px;
                    object-fit: cover;
                    border-radius: 8px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                }
                .answer-label {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    display: block;
                    margin-bottom: 4px;
                }
                .reveal-info h3 {
                    margin: 0 0 4px 0;
                    font-size: 1.4rem;
                    color: white;
                }
                .reveal-info p {
                    color: var(--text-secondary);
                    margin: 0;
                }
                .scores-display {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin: 30px 0;
                }
                .score-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                }
                .score-item.leader {
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(255, 255, 255, 0.1);
                }
                .points {
                    font-weight: 700;
                    color: var(--accent);
                }
                .footer-actions {
                    display: flex;
                    gap: 12px;
                }
                .btn-primary, .btn-secondary {
                    flex: 1;
                    padding: 12px;
                    border-radius: 12px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .btn-primary { background: var(--accent); color: white; }
                .btn-secondary { background: rgba(255, 255, 255, 0.1); color: white; }
                
                .next-round-status {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                .countdown-bar {
                    height: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    overflow: hidden;
                }
                .bar-fill {
                    height: 100%;
                    background: var(--accent);
                }
            `}</style>
        </div>
    );
};

export default Scoreboard;
