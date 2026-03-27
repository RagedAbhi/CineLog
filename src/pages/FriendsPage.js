import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../store/actions';
import { fetchRecommendations } from '../store/thunks';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import '../styles/global.css';

const FriendsPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'requests' | 'search'
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const dispatch = useDispatch();
    const { user, recommendations, unreadMessages } = useSelector(state => state.auth);

    const token = localStorage.getItem('token');
    const apiHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchFriends();
        fetchRequests();
        dispatch(fetchRecommendations());

        // Initial entry animation
        gsap.from(".social-container > *", {
            opacity: 0,
            y: 20,
            stagger: 0.1,
            duration: 0.8,
            ease: "power3.out"
        });
    }, []);

    useEffect(() => {
        // Tab switch animation
        gsap.fromTo(".social-content-area",
            { opacity: 0, x: 10 },
            { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" }
        );
    }, [activeTab]);

    const fetchFriends = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/friends', apiHeader);
            setFriends(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchRequests = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/friends/requests', apiHeader);
            setRequests(res.data);
        } catch (err) { console.error(err); }
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/users/search?username=${searchQuery}`, apiHeader);
            setSearchResults(res.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const sendRequest = async (recipientId) => {
        try {
            await axios.post('http://localhost:5000/api/friends/request', { recipientId }, apiHeader);
            dispatch(showToast('Request sent!', 'success'));
        } catch (err) { 
            dispatch(showToast(err.response?.data?.message || 'Error sending request', 'error')); 
        }
    };

    const acceptRequest = async (requestId) => {
        try {
            await axios.post('http://localhost:5000/api/friends/accept', { requestId }, apiHeader);
            fetchFriends();
            fetchRequests();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="container-fluid social-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="page-header" style={{ textAlign: 'center', marginBottom: '80px' }}>
                <h2>Social</h2>
                <p>Connect with fellow cinephiles</p>
            </div>

            <div className="glass-panel-premium" style={{
                display: 'flex',
                gap: '8px',
                padding: '6px',
                borderRadius: '100px',
                marginBottom: '40px',
                maxWidth: '500px',
                margin: '0 auto 40px'
            }}>
                {['friends', 'requests', 'search'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`nav-item-premium ${activeTab === tab ? 'active' : ''}`}
                        style={{ flex: 1, justifyContent: 'center' }}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {tab === 'requests' && requests.length > 0 && (
                            <span className="badge-premium" style={{ marginLeft: '8px', marginBottom: 0 }}>
                                {requests.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="social-content-area">
                {activeTab === 'friends' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                        {friends.length === 0 ? (
                            <div className="glass-panel" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px' }}>
                                <div style={{ fontSize: '40px', marginBottom: '20px' }}>👥</div>
                                <h3>No friends yet</h3>
                                <p style={{ color: 'var(--text-muted)' }}>Start by searching for users to add.</p>
                                <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => setActiveTab('search')}>Find Friends</button>
                            </div>
                        ) : (
                            friends.map(friend => {
                                const recs = recommendations || user?.recommendations || [];
                                const unreadFromFriendRecs = recs.filter(r => {
                                    const senderId = (r.sender?._id || r.sender)?.toString();
                                    const receiverId = (r.receiver?._id || r.receiver)?.toString();
                                    const currentUserId = (user?._id || user?.id)?.toString();
                                    const friendId = friend._id?.toString();
                                    return senderId === friendId && receiverId === currentUserId && !r.read;
                                }).length;

                                const unreadFromFriendMsgs = (unreadMessages || []).filter(m => {
                                    const senderId = (m.sender?._id || m.sender)?.toString();
                                    const friendId = friend._id?.toString();
                                    return senderId === friendId;
                                }).length;

                                const totalUnreadFromFriend = unreadFromFriendRecs + unreadFromFriendMsgs;

                                return (
                                    <div key={friend._id} className="stat-card glass-panel" style={{
                                        padding: '32px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        position: 'relative'
                                    }}>
                                        {totalUnreadFromFriend > 0 && (
                                            <span className="dot-notification-friend">{totalUnreadFromFriend}</span>
                                        )}
                                        <Link to={`/profile/${friend._id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'inherit' }}>
                                            <div className="avatar-wrapper" style={{ width: '80px', height: '80px', fontSize: '32px', marginBottom: '20px', overflow: 'hidden' }}>
                                                {friend.profilePicture ? (
                                                    <img src={friend.profilePicture.startsWith('http') ? friend.profilePicture : `http://localhost:5000/${friend.profilePicture}`} alt={friend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    friend.name.charAt(0)
                                                )}
                                            </div>
                                            <h4 className="stat-value" style={{ fontSize: '24px', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{friend.name}</h4>
                                            <p className="stat-label" style={{ marginBottom: '20px' }}>@{friend.username}</p>
                                        </Link>
                                        <Link to={`/chat/${friend._id}`} className="btn btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                            💬 Message
                                        </Link>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {requests.length === 0 ? (
                            <div className="glass-panel" style={{ textAlign: 'center', padding: '60px' }}>
                                <div style={{ fontSize: '40px', marginBottom: '20px' }}>📩</div>
                                <p style={{ color: 'var(--text-muted)' }}>No pending requests.</p>
                            </div>
                        ) : (
                            requests.map(req => (
                                <div key={req._id} className="glass-panel" style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                            {req.requester.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0 }}>{req.requester.name}</h4>
                                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>@{req.requester.username} wants to connect</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button className="btn btn-primary" onClick={() => acceptRequest(req._id)}>Accept</button>
                                        <button className="btn-clear" style={{ color: 'var(--text-muted)' }} onClick={() => console.log('Reject functionality not yet in backend')}>Decline</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'search' && (
                    <div>
                        <div className="glass-panel-premium" style={{ padding: '8px', borderRadius: '100px', display: 'flex', gap: '10px', marginBottom: '60px' }}>
                            <input
                                className="global-search-input"
                                style={{ border: 'none', background: 'transparent', padding: '12px 32px', flex: 1, fontSize: '16px' }}
                                placeholder="Search by username..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
                                {loading ? 'Searching...' : 'Search Users'}
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                            {searchResults.map(user => (
                                <div key={user._id} className="glass-panel" style={{ 
                                    padding: '24px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    cursor: 'pointer'
                                }} onClick={() => navigate(`/profile/${user._id}`)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                            {user.name?.charAt(0) || user.username?.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0 }}>{user.name}</h4>
                                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>@{user.username}</p>
                                        </div>
                                    </div>
                                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); sendRequest(user._id); }}>Add</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FriendsPage;
