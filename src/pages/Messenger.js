import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { markChatRead } from '../store/actions';
import axios from 'axios';
import { Send, Plus, X, Film, Tv, User, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AddMovieModal from '../components/AddMovieModal';
import './Messenger.css';

const Chat = () => {
    const { friendId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const user = useSelector(state => state.auth.user);
    const [friend, setFriend] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [attachedMedia, setAttachedMedia] = useState(null);
    const [showMediaPicker, setShowMediaPicker] = useState(false);
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const fetchFriend = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/users/${friendId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setFriend(res.data);
            } catch (err) {
                console.error("Error fetching friend:", err);
            }
        };

        if (friendId) fetchFriend();
    }, [friendId]);

    const fetchMessages = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/messages/conversation/${friendId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setMessages(res.data);
            setLoading(false);
            
            // Mark as read in Redux state
            dispatch(markChatRead(friendId));
        } catch (err) {
            console.error("Error fetching messages:", err);
        }
    };

    useEffect(() => {
        if (friendId) {
            fetchMessages();
            const interval = setInterval(fetchMessages, 5000);
            return () => clearInterval(interval);
        }
    }, [friendId, dispatch]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!inputText.trim() && !attachedMedia) return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('http://localhost:5000/api/messages/send', {
                receiverId: friendId,
                text: inputText,
                mediaAddon: attachedMedia
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            setMessages(prev => [...prev, res.data]);
            setInputText('');
            setAttachedMedia(null);
        } catch (err) {
            console.error("Error sending message:", err);
        }
    };

    const handleMediaSelect = (media) => {
        setAttachedMedia({
            imdbID: media.imdbID || media.id,
            title: media.title,
            poster: media.poster,
            mediaType: media.mediaType === 'series' ? 'series' : 'movie'
        });
        setShowMediaPicker(false);
    };

    const getStatusInfo = (lastSeen) => {
        if (!lastSeen) return { label: 'Away', isOnline: false };
        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diffInMinutes = Math.floor((now - lastSeenDate) / 60000);

        if (diffInMinutes < 2) return { label: 'Online', isOnline: true };
        if (diffInMinutes < 60) return { label: `${diffInMinutes}m ago`, isOnline: false };
        if (diffInMinutes < 1440) return { label: `${Math.floor(diffInMinutes / 60)}h ago`, isOnline: false };
        return { label: `${Math.floor(diffInMinutes / 1440)}d ago`, isOnline: false };
    };

    const status = getStatusInfo(friend?.lastSeen);

    return (
        <motion.div 
            className="chat-page-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
            <div className="chat-main-window">
                <div className="chat-header">
                    <button className="chat-back-btn" onClick={() => navigate('/friends')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className="chat-user-info">
                        <div className={`chat-avatar-ring ${!status.isOnline ? 'offline' : ''}`}>
                            {friend?.avatar ? 
                                <img src={friend.avatar.startsWith('http') ? friend.avatar : `http://localhost:5000/${friend.avatar}`} alt="" /> 
                                : <div className="user-icon-placeholder"><User size={22} /></div>
                            }
                        </div>
                        <div className="chat-user-details">
                            <span className="chat-friend-name">{friend?.name || friend?.username}</span>
                            <div className={`chat-status-pill ${status.isOnline ? 'online' : 'offline'}`}>
                                <span className="indicator" />
                                {status.label}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="chat-messages-area">
                    <AnimatePresence>
                        {messages.length === 0 && !loading && (
                            <motion.div 
                                className="empty-chat-hint"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                ✨ Start a cinematic conversation with {friend?.name || 'your friend'}!
                            </motion.div>
                        )}
                        {messages.map((msg, idx) => {
                            const isMine = msg.sender === user?._id;
                            const isLastInSeries = idx === messages.length - 1 || messages[idx+1]?.sender !== msg.sender;
                            
                            return (
                                <motion.div 
                                    key={msg._id} 
                                    className={`message-row ${isMine ? 'mine' : 'theirs'}`}
                                    initial={{ opacity: 0, x: isMine ? 20 : -20, scale: 0.95 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                >
                                    <div className="message-bubble">
                                        {msg.mediaAddon && (
                                            <div className="message-media-addon" onClick={() => navigate(`/movies/${msg.mediaAddon.imdbID}?external=true&type=${msg.mediaAddon.mediaType}`)}>
                                                <img src={msg.mediaAddon.poster} alt="" />
                                                <div className="addon-info">
                                                    <span className="addon-title">{msg.mediaAddon.title}</span>
                                                    <span className="addon-type">
                                                        {msg.mediaAddon.mediaType === 'series' ? <Tv size={11} /> : <Film size={11} />} 
                                                        {msg.mediaAddon.mediaType}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {msg.text && <p className="message-text">{msg.text}</p>}
                                        <span className="message-time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>

                <footer className="chat-input-area">
                    <AnimatePresence>
                        {attachedMedia && (
                            <motion.div 
                                className="attached-media-preview"
                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                            >
                                <img src={attachedMedia.poster} alt="" />
                                <span className="preview-name">{attachedMedia.title}</span>
                                <button className="btn-detach" onClick={() => setAttachedMedia(null)}>
                                    <X size={12} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    <form className="chat-form" onSubmit={handleSendMessage}>
                        <div className="input-shell">
                            <button type="button" className="btn-attach" onClick={() => setShowMediaPicker(true)}>
                                <Plus size={20} />
                            </button>
                            <input 
                                className="chat-input"
                                type="text" 
                                placeholder="Write something..." 
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                            <button type="submit" className="btn-send" disabled={!inputText.trim() && !attachedMedia}>
                                <Send size={18} />
                            </button>
                        </div>
                    </form>
                </footer>
            </div>

            {showMediaPicker && (
                <AddMovieModal 
                    onClose={() => setShowMediaPicker(false)} 
                    onSelect={handleMediaSelect}
                    chatMode={true}
                />
            )}
        </motion.div>
    );
};

export default Chat;
