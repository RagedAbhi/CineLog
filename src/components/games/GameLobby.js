import React from 'react';
import { motion } from 'framer-motion';
import { Users, Copy, Play, Loader2 } from 'lucide-react';

const GameLobby = ({ room, userId, onStart, onCopy }) => {
    const isHost = room.host.userId === userId;
    const hasGuest = !!room.guest;

    return (
        <div className="lobby-container">
            <motion.div 
                className="lobby-card"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
            >
                <div className="lobby-header">
                    <div className="room-badge">
                        {room.game === 'hangman' ? 'Hangman' : 'Plot Redacted'}
                    </div>
                    <h2>Lobby</h2>
                </div>

                <div className="room-code-section">
                    <span className="label">Room Code</span>
                    <div className="code-display" onClick={() => onCopy(room.code)}>
                        <code>{room.code}</code>
                        <Copy size={18} />
                    </div>
                </div>

                <div className="players-section">
                    <h3>Players</h3>
                    <div className="player-slots">
                        <div className="player-slot active">
                            <div className="player-avatar host">H</div>
                            <span className="player-name">{room.host.username}</span>
                        </div>
                        
                        {room.guest ? (
                            <motion.div 
                                className="player-slot active"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                            >
                                <div className="player-avatar guest">G</div>
                                <span className="player-name">{room.guest.username}</span>
                            </motion.div>
                        ) : (
                            <div className="player-slot waiting">
                                <Loader2 className="animate-spin text-muted" size={24} />
                                <span className="player-name italic">Waiting for player...</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lobby-footer">
                    {isHost ? (
                        <button 
                            className={`btn-start-game ${!hasGuest ? 'solo' : ''}`}
                            onClick={onStart}
                        >
                            <Play size={20} />
                            {hasGuest ? 'Start Game' : 'Start Solo'}
                        </button>
                    ) : (
                        <div className="waiting-message">
                            <Loader2 className="animate-spin" size={20} />
                            <span>Waiting for host to start...</span>
                        </div>
                    )}
                </div>
            </motion.div>

            <style jsx>{`
                .lobby-container {
                    height: 60vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .lobby-card {
                    background: var(--bg-secondary);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    padding: 40px;
                    width: 100%;
                    max-width: 500px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                }
                .lobby-header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .room-badge {
                    display: inline-block;
                    background: var(--accent);
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 10px;
                }
                .room-code-section {
                    text-align: center;
                    margin-bottom: 40px;
                }
                .label {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    display: block;
                    margin-bottom: 10px;
                }
                .code-display {
                    background: rgba(0, 0, 0, 0.3);
                    border: 2px dashed rgba(255, 255, 255, 0.2);
                    padding: 12px 24px;
                    border-radius: 16px;
                    display: inline-flex;
                    align-items: center;
                    gap: 15px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .code-display:hover {
                    border-color: var(--accent);
                    background: rgba(0, 0, 0, 0.5);
                }
                .code-display code {
                    font-size: 2rem;
                    font-weight: 800;
                    letter-spacing: 4px;
                    color: white;
                }
                .players-section h3 {
                    font-size: 1rem;
                    color: var(--text-secondary);
                    margin-bottom: 15px;
                }
                .player-slots {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .player-slot {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 12px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.03);
                }
                .player-slot.active { background: rgba(255, 255, 255, 0.07); }
                .player-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                }
                .host { background: var(--accent); }
                .guest { background: #9333ea; }
                .player-name { font-weight: 600; }
                .lobby-footer {
                    margin-top: 40px;
                }
                .btn-start-game {
                    width: 100%;
                    padding: 16px;
                    background: var(--accent);
                    color: white;
                    border-radius: 16px;
                    font-weight: 700;
                    font-size: 1.1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    box-shadow: 0 10px 20px rgba(255, 75, 75, 0.2);
                }
                .btn-start-game.solo {
                    background: rgba(255, 255, 255, 0.1);
                    box-shadow: none;
                }
                .waiting-message {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    color: var(--text-secondary);
                    font-style: italic;
                }
            `}</style>
        </div>
    );
};

export default GameLobby;
