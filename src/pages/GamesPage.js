import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { Gamepad2, Users, Trophy, Play, Plus, Search, ChevronRight } from 'lucide-react';
import axios from 'axios';
import config from '../config';
import { showToast } from '../store/actions';

// Stable component definitions outside the main component
const GameCard = ({ title, description, game, icon: Icon, color, loading, onCreateRoom }) => (
    <motion.div 
        className="game-card-premium"
        whileHover={{ y: -5 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
    >
        <div className={`game-card-icon-bg ${color}`}>
            <Icon size={32} className="text-white" />
        </div>
        <div className="game-card-content">
            <h3>{title}</h3>
            <p>{description}</p>
            <div className="game-card-actions">
                <button 
                    className="btn-game btn-solo" 
                    onClick={() => onCreateRoom(game)}
                    disabled={loading}
                >
                    <Play size={16} />
                    Solo
                </button>
                <button 
                    className="btn-game btn-multi" 
                    onClick={() => onCreateRoom(game)}
                    disabled={loading}
                >
                    <Plus size={16} />
                    Room
                </button>
            </div>
        </div>
    </motion.div>
);

const StatCard = ({ title, stats }) => (
    <div className="stat-card-premium">
        <h4>{title}</h4>
        <div className="stat-grid">
            <div className="stat-item">
                <span className="stat-label">Played</span>
                <span className="stat-value">{stats.gamesPlayed}</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">Wins</span>
                <span className="stat-value">{stats.wins}</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">High Score</span>
                <span className="stat-value">{stats.highScore}</span>
            </div>
        </div>
    </div>
);

const GamesPage = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user } = useSelector(state => state.auth);
    const [roomCode, setRoomCode] = useState('');
    const [loading, setLoading] = useState(false);

    const gameStats = user?.gameStats || {
        hangman: { gamesPlayed: 0, wins: 0, totalScore: 0, highScore: 0 },
        plotRedacted: { gamesPlayed: 0, wins: 0, totalScore: 0, highScore: 0 }
    };

    const handleCreateRoom = async (game) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.post(`${config.API_URL}/api/games/rooms`, { game }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate(`/games/room/${res.data.roomCode}`);
        } catch (err) {
            dispatch(showToast('Failed to create room', 'error'));
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!roomCode || roomCode.length !== 6) {
            return dispatch(showToast('Enter a valid 6-character room code', 'error'));
        }
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.post(`${config.API_URL}/api/games/rooms/${roomCode.toUpperCase()}/join`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate(`/games/room/${res.data.code}`);
        } catch (err) {
            dispatch(showToast(err.response?.data?.message || 'Room not found or full', 'error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-fluid games-container">
            <div className="page-header">
                <div className="header-with-icon">
                    <Gamepad2 size={32} className="text-accent" />
                    <h2>Game Room</h2>
                </div>
                <p>Test your cinema knowledge and climb the leaderboard</p>
            </div>

            <div className="games-grid">
                <GameCard 
                    title="Hangman"
                    description="Guess the movie or show title from your collection before the man is hanged!"
                    game="hangman"
                    icon={Gamepad2}
                    color="bg-blue-600"
                    loading={loading}
                    onCreateRoom={handleCreateRoom}
                />
                <GameCard 
                    title="Plot Redacted"
                    description="Identify the film from its plot summary with all names and places blacked out."
                    game="plot-redacted"
                    icon={Users}
                    color="bg-purple-600"
                    loading={loading}
                    onCreateRoom={handleCreateRoom}
                />
            </div>

            <div className="join-section-premium">
                <div className="join-card">
                    <div className="join-header">
                        <Users size={20} />
                        <h3>Join a Room</h3>
                    </div>
                    <div className="join-input-wrapper">
                        <input 
                            type="text" 
                            placeholder="6-character code (e.g. XK92BT)" 
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            maxLength={6}
                        />
                        <button onClick={handleJoinRoom} disabled={loading}>
                            <Search size={18} />
                            Join
                        </button>
                    </div>
                </div>
            </div>

            <div className="stats-section">
                <div className="section-header">
                    <Trophy size={24} className="text-yellow-500" />
                    <h3>Your Career Stats</h3>
                </div>
                <div className="stats-grid">
                    <StatCard title="Hangman" stats={gameStats.hangman} />
                    <StatCard title="Plot Redacted" stats={gameStats.plotRedacted} />
                </div>
            </div>

            <style jsx>{`
                .games-container {
                    padding-bottom: 50px;
                }
                .games-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
                    gap: 24px;
                    margin-top: 30px;
                }
                .game-card-premium {
                    background: var(--bg-secondary);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 24px;
                    display: flex;
                    gap: 20px;
                    align-items: center;
                }
                .game-card-icon-bg {
                    width: 64px;
                    height: 64px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .game-card-content h3 {
                    margin: 0 0 8px 0;
                    font-size: 1.25rem;
                }
                .game-card-content p {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    margin-bottom: 16px;
                    line-height: 1.4;
                }
                .game-card-actions {
                    display: flex;
                    gap: 12px;
                }
                .btn-game {
                    padding: 8px 16px;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .btn-solo {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }
                .btn-solo:hover { background: rgba(255, 255, 255, 0.2); }
                .btn-multi {
                    background: var(--accent);
                    color: white;
                }
                .btn-multi:hover { opacity: 0.9; }

                .join-section-premium {
                    margin-top: 40px;
                }
                .join-card {
                    background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 20px;
                    padding: 30px;
                    max-width: 600px;
                }
                .join-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 20px;
                }
                .join-input-wrapper {
                    display: flex;
                    gap: 12px;
                }
                .join-input-wrapper input {
                    flex: 1;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    padding: 12px 20px;
                    color: white;
                    font-family: monospace;
                    letter-spacing: 2px;
                    font-size: 1.1rem;
                }
                .join-input-wrapper button {
                    background: white;
                    color: black;
                    border-radius: 12px;
                    padding: 0 24px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .stats-section {
                    margin-top: 50px;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                .stat-card-premium {
                    background: rgba(255,255,255,0.03);
                    border-radius: 16px;
                    padding: 20px;
                }
                .stat-card-premium h4 {
                    margin: 0 0 15px 0;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .stat-grid {
                    display: flex;
                    justify-content: space-between;
                }
                .stat-item {
                    display: flex;
                    flex-direction: column;
                }
                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
                .stat-value {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: white;
                }
            `}</style>
        </div>
    );
};

export default GamesPage;
