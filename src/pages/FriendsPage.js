import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../store/actions';
import { fetchRecommendations } from '../store/thunks';
import config from '../config';
import { useNavigate } from 'react-router-dom';

import gsap from 'gsap';
import '../styles/global.css';

const FriendsPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'requests' | 'recommendations' | 'search'
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [showAllInbox, setShowAllInbox] = useState(false);
    const [showAllSent, setShowAllSent] = useState(false);
    const dispatch = useDispatch();
    const { user, recommendations, unreadMessages } = useSelector(state => state.auth);

    const getApiHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

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
            const res = await axios.get(`${config.API_URL}/api/friends`, getApiHeader());
            setFriends(res.data);
        } catch (err) { console.error('fetchFriends error:', err); }
    };

    const fetchRequests = async () => {
        try {
            const res = await axios.get(`${config.API_URL}/api/friends/requests`, getApiHeader());
            setRequests(res.data);
        } catch (err) { console.error('fetchRequests error:', err); }
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const res = await axios.get(`${config.API_URL}/api/users/search?username=${searchQuery}`, getApiHeader());
            setSearchResults(res.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const sendRequest = async (recipientId) => {
        try {
            await axios.post(`${config.API_URL}/api/friends/request`, { recipientId }, getApiHeader());
            dispatch(showToast('Request sent!', 'success'));
        } catch (err) { 
            dispatch(showToast(err.response?.data?.message || 'Error sending request', 'error')); 
        }
    };

    const acceptRequest = async (requestId) => {
        try {
            await axios.post(`${config.API_URL}/api/friends/accept`, { requestId }, getApiHeader());
            fetchFriends();
            fetchRequests();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="container-fluid social-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="page-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2>Social</h2>
                <p>Connect with fellow cinephiles</p>
            </div>



            <div style={{
                display: 'flex',
                gap: '8px',
                padding: '0',
                marginBottom: '40px',
                maxWidth: '500px',
                margin: '0 auto 40px',
                background: 'transparent',
                boxShadow: 'none',
                border: 'none'
            }}>
                {['friends', 'requests', 'recommendations', 'search'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`nav-item-premium ${activeTab === tab ? 'active' : ''}`}
                        style={{ 
                            flex: 1, 
                            justifyContent: 'center', 
                            color: activeTab === tab ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                            background: activeTab === tab ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                            boxShadow: 'none',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '100px',
                            fontWeight: '600',
                            fontSize: '15px',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {tab === 'friends' && (unreadMessages?.length || 0) > 0 && (
                            <span className="badge-premium" style={{ marginLeft: '8px', marginBottom: 0 }}>
                                {unreadMessages.length}
                            </span>
                        )}
                        {tab === 'recommendations' && recommendations.filter(r => !r.read && (r.receiver?._id || r.receiver) === user?._id).length > 0 && (
                            <span className="badge-premium" style={{ marginLeft: '8px', marginBottom: 0 }}>
                                {recommendations.filter(r => !r.read && (r.receiver?._id || r.receiver) === user?._id).length}
                            </span>
                        )}
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
                                                    <img src={friend.profilePicture.startsWith('http') ? friend.profilePicture : `${config.API_URL}/${friend.profilePicture}`} alt={friend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    (friend.name || friend.username || '?').charAt(0)
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

                {activeTab === 'recommendations' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px', alignItems: 'start' }}>
                        <div>
                           <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--accent)' }}>Inbox</h3>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {(() => {
                                    const currentUserId = (user?._id || user?.id)?.toString();
                                    const inboxRecs = (recommendations || []).filter(r => {
                                        const receiverId = (r.receiver?._id || r.receiver)?.toString();
                                        return receiverId === currentUserId;
                                    });
                                    if (inboxRecs.length === 0) return <p style={{ color: 'var(--text-muted)' }}>No recommendations received.</p>;

                                    // Group by Title and Type fallback for absolute deduplication
                                    const grouped = {};
                                    inboxRecs.forEach(r => {
                                        const key = `${r.mediaTitle?.toLowerCase().trim()}-${r.mediaType}`;
                                        if (!grouped[key]) {
                                            grouped[key] = { ...r, count: 1, allIds: [r._id], allSenders: [r.sender] };
                                        } else {
                                            grouped[key].count += 1;
                                            grouped[key].allIds.push(r._id);
                                            // Dedupe senders in list
                                            const senderId = (r.sender?._id || r.sender)?.toString();
                                            if (!grouped[key].allSenders.some(s => (s?._id || s)?.toString() === senderId)) {
                                                grouped[key].allSenders.push(r.sender);
                                            }
                                        }
                                    });

                                    const groupedVals = Object.values(grouped);
                                    const renderedRecs = showAllInbox ? groupedVals : groupedVals.slice(0, 5);

                                    return (
                                        <>
                                            {renderedRecs.map(rec => (
                                                <div key={rec._id} className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
                                                    <div style={{ position: 'relative' }}>
                                                        <img src={rec.poster} style={{ width: '40px', height: '60px', borderRadius: '4px', objectFit: 'cover' }} alt="" />
                                                        {rec.count > 1 && (
                                                            <div 
                                                                title={`Recommended by: ${rec.allSenders.map(s => s.name || s.username).join(', ')}`}
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '-8px',
                                                                    left: '-8px',
                                                                    background: 'white',
                                                                    color: '#1a1a2e',
                                                                    fontSize: '10px',
                                                                    fontWeight: 'bold',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '10px',
                                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                                    cursor: 'help',
                                                                    zIndex: 2
                                                                }}
                                                            >
                                                                x{rec.count}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                                            <h4 style={{ margin: 0 }}>{rec.mediaTitle}</h4>
                                                            <span style={{ 
                                                                fontSize: '10px', 
                                                                padding: '1px 6px', 
                                                                borderRadius: '4px', 
                                                                background: rec.mediaType === 'series' ? 'rgba(74, 158, 255, 0.1)' : 'rgba(255, 74, 147, 0.1)', 
                                                                color: rec.mediaType === 'series' ? '#4a9eff' : '#ff4a93', 
                                                                border: `1px solid ${rec.mediaType === 'series' ? 'rgba(74, 158, 255, 0.2)' : 'rgba(255, 74, 147, 0.2)'}`,
                                                                fontWeight: '600',
                                                                letterSpacing: '0.05em',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {rec.mediaType === 'series' ? 'Series' : 'Movie'}
                                                            </span>
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                            by {rec.allSenders[0]?.name || rec.allSenders[0]?.username || 'Unknown'}{rec.allSenders.length > 1 ? ` and ${rec.allSenders.length - 1} others` : ''} • {rec.message || 'No message'}
                                                        </p>
                                                    </div>
                                                    <button className="btn btn-primary btn-sm" onClick={() => navigate(`/movies/${rec.imdbID}?external=true&type=${rec.mediaType}`)}>View</button>
                                                </div>
                                            ))}
                                            {groupedVals.length > 5 && (
                                                <button 
                                                    className="btn btn-secondary" 
                                                    style={{ width: '100%', marginTop: '8px' }}
                                                    onClick={() => setShowAllInbox(!showAllInbox)}
                                                >
                                                    {showAllInbox ? 'Show Less' : `Show All (${groupedVals.length - 5} more)`}
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                           </div>
                        </div>

                        <div>
                           <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--accent)' }}>Sent by You</h3>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {(() => {
                                    const currentUserId = (user?._id || user?.id)?.toString();
                                    const sentRecs = (recommendations || []).filter(r => {
                                        const senderId = (r.sender?._id || r.sender)?.toString();
                                        return senderId === currentUserId;
                                    });
                                    if (sentRecs.length === 0) return <p style={{ color: 'var(--text-muted)' }}>You haven't sent any recommendations yet.</p>;

                                    // Group by Title and Type fallback for absolute deduplication
                                    const grouped = {};
                                    sentRecs.forEach(r => {
                                        const key = `${r.mediaTitle?.toLowerCase().trim()}-${r.mediaType}`;
                                        if (!grouped[key]) {
                                            grouped[key] = { ...r, count: 1, allIds: [r._id], allReceivers: [r.receiver] };
                                        } else {
                                            grouped[key].count += 1;
                                            grouped[key].allIds.push(r._id);
                                            // Dedupe receivers in list
                                            const receiverId = (r.receiver?._id || r.receiver)?.toString();
                                            if (!grouped[key].allReceivers.some(re => (re?._id || re)?.toString() === receiverId)) {
                                                grouped[key].allReceivers.push(r.receiver);
                                            }
                                        }
                                    });

                                    const groupedVals = Object.values(grouped);
                                    const renderedRecs = showAllSent ? groupedVals : groupedVals.slice(0, 5);

                                    return (
                                        <>
                                            {renderedRecs.map(rec => (
                                                <div key={rec._id} className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
                                                    <div style={{ position: 'relative' }}>
                                                        <img src={rec.poster} style={{ width: '40px', height: '60px', borderRadius: '4px', objectFit: 'cover' }} alt="" />
                                                        {rec.count > 1 && (
                                                            <div 
                                                                title={`Sent to: ${rec.allReceivers.map(re => re.name || re.username).join(', ')}`}
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '-8px',
                                                                    left: '-8px',
                                                                    background: 'white',
                                                                    color: '#1a1a2e',
                                                                    fontSize: '10px',
                                                                    fontWeight: 'bold',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '10px',
                                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                                    cursor: 'help',
                                                                    zIndex: 2
                                                                }}
                                                            >
                                                                x{rec.count}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                                            <h4 style={{ margin: 0 }}>{rec.mediaTitle}</h4>
                                                            <span style={{ 
                                                                fontSize: '10px', 
                                                                padding: '1px 6px', 
                                                                borderRadius: '4px', 
                                                                background: rec.mediaType === 'series' ? 'rgba(74, 158, 255, 0.1)' : 'rgba(255, 74, 147, 0.1)', 
                                                                color: rec.mediaType === 'series' ? '#4a9eff' : '#ff4a93', 
                                                                border: `1px solid ${rec.mediaType === 'series' ? 'rgba(74, 158, 255, 0.2)' : 'rgba(255, 74, 147, 0.2)'}`,
                                                                fontWeight: '600',
                                                                letterSpacing: '0.05em',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {rec.mediaType === 'series' ? 'Series' : 'Movie'}
                                                            </span>
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                            To {rec.allReceivers[0]?.name || rec.allReceivers[0]?.username || 'Unknown'}{rec.allReceivers.length > 1 ? ` and ${rec.allReceivers.length - 1} others` : ''} • {rec.message || 'No message'}
                                                        </p>
                                                    </div>
                                                    <button 
                                                        className="btn btn-secondary btn-sm" 
                                                        style={{ color: 'var(--red)', borderColor: 'rgba(255, 59, 48, 0.2)' }}
                                                        onClick={() => {
                                                            const receiverNames = rec.allReceivers?.map(re => re?.name || re?.username || 'Friend').join(', ');
                                                            dispatch(showConfirmModal({
                                                                title: 'Unrecommend',
                                                                message: `Withdraw your recommendation for "${rec.mediaTitle}" sent to ${rec.count} friend${rec.count > 1 ? 's' : ''}${rec.count > 1 ? ` (${receiverNames})` : ''}?`,
                                                                confirmText: 'Unrecommend',
                                                                cancelText: 'Cancel',
                                                                isDangerous: true,
                                                                onConfirm: async () => {
                                                                    try {
                                                                        if (rec.allIds && rec.allIds.length > 0) {
                                                                            await Promise.all(rec.allIds.map(id => axios.delete(`${config.API_URL}/api/recommendations/${id}`, getApiHeader())));
                                                                        } else {
                                                                            await axios.delete(`${config.API_URL}/api/recommendations/${rec._id}`, getApiHeader());
                                                                        }
                                                                        dispatch(fetchRecommendations());
                                                                        dispatch(showToast('Recommendation(s) withdrawn'));
                                                                    } catch (err) {
                                                                        dispatch(showToast('Error withdrawing recommendation', 'error'));
                                                                    }
                                                                }
                                                            }));
                                                        }}
                                                    >
                                                        Withdraw
                                                    </button>
                                                </div>
                                            ))}
                                            {groupedVals.length > 5 && (
                                                <button 
                                                    className="btn btn-secondary" 
                                                    style={{ width: '100%', marginTop: '8px' }}
                                                    onClick={() => setShowAllSent(!showAllSent)}
                                                >
                                                    {showAllSent ? 'Show Less' : `Show All (${groupedVals.length - 5} more)`}
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                           </div>
                        </div>
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
