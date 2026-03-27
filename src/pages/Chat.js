import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { markChatRead } from '../store/actions';
import axios from 'axios';
import { Send, Plus, X, Film, Tv, User, ArrowLeft } from 'lucide-react';
import AddMovieModal from '../components/AddMovieModal';
import './Chat.css';

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

    const getStatus = (lastSeen) => {
        if (!lastSeen) return 'Away';
        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diffInMinutes = Math.floor((now - lastSeenDate) / 60000);

        if (diffInMinutes < 2) return 'Online';
        if (diffInMinutes < 60) return `Last seen ${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `Last seen ${Math.floor(diffInMinutes / 60)}h ago`;
        return `Last seen ${Math.floor(diffInMinutes / 1440)}d ago`;
    };

    if (!friend && loading) return <div className="chat-loading">Loading chat...</div>;

    return (
        <div className="chat-page-container">
            <div className="chat-header glass-panel">
                <button className="chat-back-btn" onClick={() => navigate('/friends')}>
                    <ArrowLeft size={20} />
                </button>
                <div className="chat-user-info">
                    {friend?.avatar ? <img src={friend.avatar.startsWith('http') ? friend.avatar : `http://localhost:5000/${friend.avatar}`} alt="" /> : <div className="user-icon-placeholder"><User size={20} /></div>}
                    <div className="chat-user-details">
                        <span className="chat-friend-name">{friend?.name || friend?.username}</span>
                        <span className={`chat-status ${getStatus(friend?.lastSeen) === 'Online' ? 'online' : 'offline'}`}>
                            {getStatus(friend?.lastSeen)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="chat-messages-area">
                {messages.length === 0 && !loading && (
                    <div className="empty-chat-hint">Say hi to start the conversation!</div>
                )}
                {messages.map((msg) => {
                    const isMine = msg.sender === user?._id;
                    return (
                        <div key={msg._id} className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
                            <div className="message-bubble glass-panel">
                                {msg.mediaAddon && (
                                    <div className="message-media-addon" onClick={() => navigate(`/movies/${msg.mediaAddon.imdbID}?external=true&type=${msg.mediaAddon.mediaType}`)}>
                                        <img src={msg.mediaAddon.poster} alt="" />
                                        <div className="addon-info">
                                            <span className="addon-title">{msg.mediaAddon.title}</span>
                                            <span className="addon-type">{msg.mediaAddon.mediaType === 'series' ? <Tv size={10} /> : <Film size={10} />} {msg.mediaAddon.mediaType}</span>
                                        </div>
                                    </div>
                                )}
                                {msg.text && <p className="message-text">{msg.text}</p>}
                                <span className="message-time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <footer className="chat-input-area glass-panel">
                {attachedMedia && (
                    <div className="attached-media-preview glass-panel">
                        <img src={attachedMedia.poster} alt="" />
                        <span>{attachedMedia.title}</span>
                        <button onClick={() => setAttachedMedia(null)}><X size={14} /></button>
                    </div>
                )}
                <form className="chat-form" onSubmit={handleSendMessage}>
                    <button type="button" className="btn-attach" onClick={() => setShowMediaPicker(true)}>
                        <Plus size={20} />
                    </button>
                    <input 
                        type="text" 
                        placeholder="Message..." 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                    <button type="submit" className="btn-send" disabled={!inputText.trim() && !attachedMedia}>
                        <Send size={20} />
                    </button>
                </form>
            </footer>

            {showMediaPicker && (
                <AddMovieModal 
                    onClose={() => setShowMediaPicker(false)} 
                    onSelect={handleMediaSelect}
                    chatMode={true}
                />
            )}
        </div>
    );
};

export default Chat;
