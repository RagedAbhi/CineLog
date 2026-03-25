import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { showToast } from '../store/actions';
import CineSelect from './CineSelect';
import '../styles/global.css';

const RecommendModal = ({ movie, onClose, onRecommend }) => {
    const [friends, setFriends] = useState([]);
    const [selectedFriend, setSelectedFriend] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const dispatch = useDispatch();

    useEffect(() => {
        document.body.classList.add('modal-open');
        fetchFriends();
        return () => document.body.classList.remove('modal-open');
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

        console.log('[RecommendModal] Sending recommendation:', {
            receiverId: selectedFriend,
            mediaTitle: movie.title,
            mediaType: movie.mediaType || 'movie',
            imdbID: movie.imdbID
        });

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('http://localhost:5000/api/recommendations', {
                receiverId: selectedFriend,
                mediaTitle: movie.title,
                mediaType: movie.mediaType || 'movie',
                imdbID: movie.imdbID,
                poster: movie.poster,
                message: message
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('[RecommendModal] Success:', res.data);
            onRecommend();
        } catch (err) {
            console.error('Error sending recommendation:', err);
            dispatch(showToast('Failed to send recommendation', 'error'));
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <h3>Recommend to Friend</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body" data-lenis-prevent style={{ overflowX: 'visible', paddingBottom: '40px' }}>
                    <div style={{ 
                        display: 'flex', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.03)', 
                        borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' 
                    }}>
                        <img 
                            src={movie.poster || 'https://via.placeholder.com/150'} 
                            alt="poster" 
                            style={{ width: '60px', height: '90px', borderRadius: '8px', objectFit: 'cover' }} 
                        />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Recommending</div>
                            <div style={{ fontWeight: 700, fontSize: '18px', color: '#fff' }}>{movie.title}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{movie.year} • {movie.mediaType?.toUpperCase()}</div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ position: 'relative', zIndex: 3000 }}>
                            <label className="form-label">Select Friend</label>
                            {loading ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading friends...</div>
                            ) : friends.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>You haven't added any friends yet.</div>
                            ) : (
                            <CineSelect
                                options={friends.map(f => ({ value: f._id, label: `${f.name} (@${f.username})` }))}
                                value={selectedFriend}
                                onChange={setSelectedFriend}
                                placeholder="-- Choose a friend --"
                            />
                            )}
                        </div>

                        <div className="form-group" style={{ marginTop: '20px' }}>
                            <label className="form-label" style={{ opacity: 0.9 }}>Personal Note (Optional)</label>
                            <textarea
                                className="form-input"
                                placeholder="Why are you recommending this?"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                rows={3}
                                style={{ background: 'rgba(255,255,255,0.03)' }}
                            />
                        </div>

                        <div className="form-actions" style={{ marginTop: '24px' }}>
                            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={!selectedFriend}>Send Recommendation</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RecommendModal;
