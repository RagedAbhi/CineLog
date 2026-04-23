import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ArrowLeft } from 'lucide-react';
import axios from 'axios';
import useGameSocket from '../hooks/useGameSocket';
import config from '../config';
import { showToast } from '../store/actions';

import GameLobby from '../components/games/GameLobby';
import Hangman from '../components/games/Hangman';
import PlotRedacted from '../components/games/PlotRedacted';
import Scoreboard from '../components/games/Scoreboard';

const GameRoom = () => {
    const { code } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user } = useSelector(state => state.auth);
    
    const [room, setRoom] = useState(null);
    const [phase, setPhase] = useState('lobby'); // lobby, playing, round-end, game-over
    const [puzzle, setPuzzle] = useState(null);
    const [roundResult, setRoundResult] = useState(null);
    const [loading, setLoading] = useState(true);

    const onEvent = useCallback((event, data) => {
        console.log(`[GameEvent] ${event}`, data);
        
        switch (event) {
            case 'game:player_joined':
                setRoom(prev => ({
                    ...prev,
                    guest: { username: data.username }
                }));
                dispatch(showToast(`${data.username} joined!`, 'info'));
                break;
            
            case 'game:puzzle':
                setPuzzle(data);
                setPhase('playing');
                setRoom(prev => ({ ...prev, status: 'in-progress', round: data.round }));
                break;

            case 'game:state_update':
                if (data.scores) setRoom(prev => ({ ...prev, scores: data.scores }));
                if (data.wrongSubmission) {
                    // Could trigger a visual shake in PlotRedacted
                    dispatch(showToast('Wrong guess! -10pts', 'error'));
                } else {
                    setPuzzle(prev => ({ ...prev, ...data }));
                }
                break;

            case 'game:round_end':
                setRoundResult(data);
                if (room?.game === 'hangman') {
                    // Reveal answer in place for a smoother flow
                    setPuzzle(prev => ({
                        ...prev,
                        displayState: data.answer.split(''),
                        isRevealed: true,
                        revealResult: data.result
                    }));
                    // Delay the scoreboard overlay
                    setTimeout(() => {
                        setPhase('round-end');
                    }, 1500);
                } else {
                    setPhase('round-end');
                }
                setRoom(prev => ({ ...prev, scores: data.scores }));
                break;

            case 'game:next_round':
                // Reset for next round
                setRoundResult(null);
                setPuzzle(null);
                // The next game:puzzle event will move phase back to 'playing'
                break;

            case 'game:over':
                setPhase('game-over');
                setRoom(prev => ({ ...prev, scores: data.scores, status: 'finished' }));
                
                // Persist stats if this is the end of the game
                const myUserId = user?._id?.toString();
                const myScore = data.scores[myUserId] || 0;
                const won = data.winner === myUserId;
                saveFinalStats(myScore, won);
                break;

            case 'game:hint':
                setPuzzle(prev => ({
                    ...prev,
                    hintsUsed: data.hintsUsed,
                    revealedHints: [...(prev.revealedHints || []), data.hint]
                }));
                break;

            case 'game:player_left':
                dispatch(showToast(`${data.username} disconnected. Game ended.`, 'warning'));
                setPhase('game-over');
                break;

            case 'game:error':
                dispatch(showToast(data.message, 'error'));
                navigate('/games');
                break;

            default:
                break;
        }
    }, [dispatch, navigate, user?._id]);

    const { emit } = useGameSocket({ roomCode: code, onEvent });

    useEffect(() => {
        const fetchRoom = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${config.API_URL}/api/games/rooms/${code}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setRoom(res.data);
                if (res.data.status === 'in-progress') setPhase('playing');
                else if (res.data.status === 'finished') setPhase('game-over');
                else if (res.data.isSolo && res.data.status === 'waiting') {
                    // Auto-start solo games
                    emit('game:start', { roomCode: code });
                }
            } catch (err) {
                dispatch(showToast('Game session not found', 'error'));
                navigate('/games');
            } finally {
                setLoading(false);
            }
        };
        fetchRoom();
    }, [code, dispatch, navigate]);

    const handleStart = useCallback(() => {
        emit('game:start', { roomCode: code });
    }, [emit, code]);

    useEffect(() => {
        if (room && room.isSolo && phase === 'lobby' && room.status === 'waiting') {
            handleStart();
        }
    }, [room, phase, handleStart]);

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        dispatch(showToast('Room code copied!', 'success'));
    };

    const saveFinalStats = async (score, won) => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${config.API_URL}/api/games/users/game-stats`, {
                game: room.game,
                score,
                won
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error('Failed to save game stats', err);
        }
    };

    const handlePlayAgain = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${config.API_URL}/api/games/rooms`, { game: room.game }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate(`/games/room/${res.data.roomCode}`);
            // Force reload or state reset
            window.location.reload(); 
        } catch (err) {
            dispatch(showToast('Failed to start new game', 'error'));
        }
    };

    if (!user || loading) return <div className="loading-container"><div className="spinner" /></div>;
    
    if (!room) {
        navigate('/games');
        return null;
    }

    return (
        <div className="game-room-page">
            <button className="btn-exit-room" onClick={() => navigate('/games')}>
                <ArrowLeft size={16} />
                Leave Room
            </button>
            {phase === 'lobby' && (
                <GameLobby 
                    room={room} 
                    userId={user._id.toString()} 
                    onStart={handleStart}
                    onCopy={handleCopy}
                />
            )}

            {phase === 'playing' && puzzle && (
                <div className="game-container">
                    <div className="game-header-stats">
                        <div className="round-info">
                            {room.isSolo ? 'Endless Mode' : `Round ${room.round}/5`}
                        </div>
                        <div className="score-ticker">
                            {room.host.username}: {room.scores[room.host.userId]}
                            {!room.isSolo && room.guest && ` | ${room.guest.username}: ${room.scores[room.guest.userId]}`}
                        </div>
                    </div>
                    
                    {room.game === 'hangman' ? (
                        <Hangman 
                            roomCode={code} 
                            userId={user._id.toString()} 
                            puzzle={puzzle} 
                            emit={emit} 
                        />
                    ) : (
                        <PlotRedacted 
                            roomCode={code} 
                            puzzle={puzzle} 
                            emit={emit} 
                        />
                    )}
                </div>
            )}

            {(phase === 'round-end' || phase === 'game-over') && (
                <Scoreboard 
                    phase={phase}
                    room={room}
                    userId={user._id.toString()}
                    roundResult={roundResult}
                    onPlayAgain={handlePlayAgain}
                />
            )}

            <style jsx>{`
                .game-room-page {
                    min-height: 80vh;
                    padding-top: 20px;
                }
                .btn-exit-room {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9rem;
                    margin-bottom: 20px;
                    cursor: pointer;
                }
                .btn-exit-room:hover {
                    color: var(--accent);
                }
                .game-header-stats {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    padding: 10px 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                }
                .round-info {
                    font-weight: 700;
                    color: var(--text-secondary);
                }
                .score-ticker {
                    font-family: monospace;
                    font-size: 1.1rem;
                    color: var(--accent);
                }
                .loading-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 50vh;
                }
            `}</style>
        </div>
    );
};

export default GameRoom;
