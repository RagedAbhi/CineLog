import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/global.css';

const RecommendModal = ({ movie, onClose, onRecommend }) => {
    const [friends, setFriends] = useState([]);
    const [selectedFriend, setSelectedFriend] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/friends', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFriends(res.data);
        } catch (err) {
            console.error('Error fetching friends:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFriend) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/recommendations', {
                receiverId: selectedFriend,
                mediaTitle: movie.title,
                mediaType: movie.mediaType || 'movie',
                imdbID: movie.imdbID,
                poster: movie.poster,
                message: message
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onRecommend();
        } catch (err) {
            console.error('Error sending recommendation:', err);
            alert('Failed to send recommendation');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <h3>Recommend to Friend</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        Sharing <strong>{movie.title}</strong>
                    </p>

                    <div className="form-group">
                        <label className="form-label">Select Friend</label>
                        {loading ? (
                            <div>Loading friends...</div>
                        ) : friends.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)' }}>You haven't added any friends yet.</div>
                        ) : (
                            <select
                                className="form-input"
                                value={selectedFriend}
                                onChange={e => setSelectedFriend(e.target.value)}
                                required
                            >
                                <option value="">-- Choose a friend --</option>
                                {friends.map(f => (
                                    <option key={f._id} value={f._id}>{f.name} (@{f.username})</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Personal Note (Optional)</label>
                        <textarea
                            className="form-input"
                            placeholder="Why are you recommending this?"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="modal-actions" style={{ marginTop: '24px' }}>
                        <button type="submit" className="btn btn-primary" disabled={!selectedFriend}>Send Recommendation</button>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RecommendModal;
