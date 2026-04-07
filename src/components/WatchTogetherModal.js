import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { X, Copy, Check, Users, ExternalLink, Send } from 'lucide-react';
import useSocket from '../hooks/useSocket';
import * as watchRoomService from '../services/watchRoomService';

/**
 * WatchTogetherModal
 * Props:
 *   movie        — { title, imdbID, mediaType, poster }
 *   netflixUrl   — provider link for Netflix (may be null)
 *   onClose      — callback
 */
const WatchTogetherModal = ({ movie, netflixUrl, onClose }) => {
    const { user } = useSelector(s => s.auth);
    const { socket, emit } = useSocket();

    const [tab, setTab] = useState('create');        // 'create' | 'join'
    const [room, setRoom] = useState(null);          // WatchRoom document
    const [joinCode, setJoinCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef(null);

    // ── Socket event listeners ─────────────────────────────────────────
    useEffect(() => {
        if (!socket || !room) return;

        const onMemberJoin = ({ members }) => {
            setRoom(prev => prev ? { ...prev, members } : prev);
        };
        const onMemberLeft = ({ members }) => {
            setRoom(prev => prev ? { ...prev, members } : prev);
        };
        const onMessage = (msg) => {
            setMessages(prev => [...prev, msg]);
        };
        const onDissolved = () => {
            setError('The host has ended the room.');
            setRoom(null);
        };

        socket.on('room:member_join', onMemberJoin);
        socket.on('room:member_left', onMemberLeft);
        socket.on('room:message', onMessage);
        socket.on('room:dissolved', onDissolved);

        return () => {
            socket.off('room:member_join', onMemberJoin);
            socket.off('room:member_left', onMemberLeft);
            socket.off('room:message', onMessage);
            socket.off('room:dissolved', onDissolved);
        };
    }, [socket, room]);

    // Scroll chat to bottom on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Handlers ──────────────────────────────────────────────────────
    const handleCreate = async () => {
        setLoading(true);
        setError('');
        try {
            const netflix = netflixUrl || '';
            const created = await watchRoomService.createRoom({
                contentId: movie.imdbID || '',
                contentTitle: movie.title,
                contentType: movie.mediaType === 'series' ? 'series' : 'movie',
                netflixUrl: netflix
            });
            setRoom(created);
            emit('room:join_socket', created.roomCode);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to create room.');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!joinCode.trim()) return;
        setLoading(true);
        setError('');
        try {
            const joined = await watchRoomService.joinRoom(joinCode.trim().toUpperCase());
            setRoom(joined);
            emit('room:join_socket', joined.roomCode);
        } catch (e) {
            setError(e.response?.data?.message || 'Room not found.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = useCallback(async () => {
        if (room) {
            emit('room:leave_socket', room.roomCode);
            try { await watchRoomService.leaveRoom(room.roomCode); } catch (_) {}
        }
        onClose();
    }, [room, emit, onClose]);

    const copyCode = () => {
        navigator.clipboard.writeText(room.roomCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyLink = () => {
        const link = `${window.location.origin}/join/${room.roomCode}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openNetflix = () => {
        const base = room.netflixUrl || netflixUrl || 'https://www.netflix.com';
        // Append room code so the extension can auto-join
        const separator = base.includes('?') ? '&' : '?';
        window.open(`${base}${separator}clroom=${room.roomCode}`, '_blank');
    };

    const sendChat = () => {
        if (!chatInput.trim() || !room) return;
        emit('room:chat', {
            roomCode: room.roomCode,
            message: chatInput.trim(),
            userId: user?._id || user?.id,
            username: user?.username,
            avatar: user?.profilePicture
        });
        setChatInput('');
    };

    const activeMembers = room?.members?.filter(m => m.isActive) || [];
    const isHost = room?.host?._id === (user?._id || user?.id) ||
                   room?.host?._id?.toString() === (user?._id || user?.id)?.toString();

    // ── Render ────────────────────────────────────────────────────────
    return (
        <div className="wt-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
            <div className="wt-modal">
                {/* Header */}
                <div className="wt-header">
                    <div className="wt-title-row">
                        <span className="wt-icon">🎬</span>
                        <div>
                            <div className="wt-title">Watch Together</div>
                            <div className="wt-subtitle">{movie.title}</div>
                        </div>
                    </div>
                    <button className="wt-close" onClick={handleClose}><X size={18} /></button>
                </div>

                {/* Error */}
                {error && <div className="wt-error">{error}</div>}

                {/* No room yet — show create/join tabs */}
                {!room ? (
                    <>
                        <div className="wt-tabs">
                            <button className={`wt-tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
                                Create Room
                            </button>
                            <button className={`wt-tab ${tab === 'join' ? 'active' : ''}`} onClick={() => setTab('join')}>
                                Join Room
                            </button>
                        </div>

                        {tab === 'create' && (
                            <div className="wt-panel">
                                <p className="wt-hint">
                                    Create a room and share the code with friends. Then open Netflix — the extension will sync playback automatically.
                                </p>
                                <button className="btn btn-primary wt-action-btn" onClick={handleCreate} disabled={loading}>
                                    {loading ? 'Creating…' : 'Create Room'}
                                </button>
                            </div>
                        )}

                        {tab === 'join' && (
                            <div className="wt-panel">
                                <p className="wt-hint">Enter the 6-character room code shared by your friend.</p>
                                <input
                                    className="wt-code-input"
                                    placeholder="Enter room code (e.g. A1B2C3)"
                                    value={joinCode}
                                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                                />
                                <button className="btn btn-primary wt-action-btn" onClick={handleJoin} disabled={loading || !joinCode.trim()}>
                                    {loading ? 'Joining…' : 'Join Room'}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    /* Room is active */
                    <div className="wt-room">
                        {/* Room code + share */}
                        <div className="wt-room-code-section">
                            <div className="wt-label">Room Code</div>
                            <div className="wt-code-display">
                                <span className="wt-code">{room.roomCode}</span>
                                <button className="wt-copy-btn" onClick={copyCode} title="Copy code">
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                                <button className="wt-copy-btn" onClick={copyLink} title="Copy shareable link">
                                    <ExternalLink size={14} />
                                </button>
                            </div>
                            {isHost && (
                                <div className="wt-host-badge">You are the host</div>
                            )}
                        </div>

                        {/* Members */}
                        <div className="wt-members-section">
                            <div className="wt-label">
                                <Users size={13} style={{ marginRight: 4 }} />
                                {activeMembers.length} {activeMembers.length === 1 ? 'member' : 'members'}
                            </div>
                            <div className="wt-members-list">
                                {activeMembers.map(m => (
                                    <div key={m.user?._id || m._id} className="wt-member">
                                        <div className="wt-avatar">
                                            {m.user?.profilePicture
                                                ? <img src={m.user.profilePicture} alt={m.user.username} />
                                                : <span>{(m.user?.username || '?')[0].toUpperCase()}</span>
                                            }
                                        </div>
                                        <span className="wt-member-name">{m.user?.username}</span>
                                        {room.host?._id?.toString() === m.user?._id?.toString() && (
                                            <span className="wt-host-dot" title="Host" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Open Netflix */}
                        <button className="wt-netflix-btn" onClick={openNetflix}>
                            <span className="wt-netflix-n">N</span>
                            Open Netflix with this room
                        </button>

                        <p className="wt-ext-note">
                            Make sure the <strong>CineLog Extension</strong> is installed — it will auto-sync playback for everyone in this room.
                        </p>

                        {/* Chat */}
                        <div className="wt-chat">
                            <div className="wt-chat-messages">
                                {messages.length === 0 && (
                                    <div className="wt-chat-empty">No messages yet. Say hi!</div>
                                )}
                                {messages.map((msg, i) => (
                                    <div key={i} className={`wt-chat-msg ${msg.userId === (user?._id || user?.id) ? 'own' : ''}`}>
                                        <span className="wt-chat-author">{msg.username}</span>
                                        <span className="wt-chat-text">{msg.message}</span>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="wt-chat-input-row">
                                <input
                                    className="wt-chat-input"
                                    placeholder="Say something…"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                                />
                                <button className="wt-send-btn" onClick={sendChat} disabled={!chatInput.trim()}>
                                    <Send size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WatchTogetherModal;
