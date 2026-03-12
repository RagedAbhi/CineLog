import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import '../styles/global.css';

const FriendsPage = () => {
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'requests' | 'search'
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const token = localStorage.getItem('token');
    const apiHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchFriends();
        fetchRequests();
        fetchRecommendations();
    }, []);

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

    const fetchRecommendations = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/recommendations', apiHeader);
            setRecommendations(res.data);
        } catch (err) { console.error(err); }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
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
            alert('Friend request sent!');
        } catch (err) { alert(err.response?.data?.message || 'Error sending request'); }
    };

    const acceptRequest = async (requestId) => {
        try {
            await axios.post('http://localhost:5000/api/friends/accept', { requestId }, apiHeader);
            fetchFriends();
            fetchRequests();
        } catch (err) { console.error(err); }
    };

    const rejectRequest = async (requestId) => {
        try {
            await axios.post('http://localhost:5000/api/friends/reject', { requestId }, apiHeader);
            fetchRequests();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="friends-page-container" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '32px' }}>Social</h1>

            <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', borderBottom: '1px solid var(--border)' }}>
                {['list', 'requests', 'search'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '12px 24px', background: 'none', border: 'none',
                            color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                            fontWeight: 600, cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid var(--accent)' : 'none'
                        }}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)} {tab === 'requests' && requests.length > 0 && `(${requests.length})`}
                    </button>
                ))}
            </div>

            <div className="friends-content-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '40px' }}>

                {/* Main Content Area */}
                <div className="friends-main">
                    {activeTab === 'list' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {friends.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '16px' }}>
                                    No friends yet. Go to 'Search' to find users!
                                </div>
                            ) : (
                                friends.map(friend => (
                                    <div key={friend._id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '20px', background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)'
                                    }}>
                                        <div>
                                            <h4 style={{ margin: 0 }}>{friend.name}</h4>
                                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>@{friend.username}</p>
                                        </div>
                                        <Link to={`/profile/${friend._id}`} className="btn btn-secondary">View Profile</Link>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'requests' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {requests.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '16px' }}>
                                    No pending friend requests.
                                </div>
                            ) : (
                                requests.map(req => (
                                    <div key={req._id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '20px', background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)'
                                    }}>
                                        <div>
                                            <h4 style={{ margin: 0 }}>{req.requester.name}</h4>
                                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>@{req.requester.username}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => acceptRequest(req._id)} className="btn btn-primary" style={{ padding: '8px 16px' }}>Accept</button>
                                            <button onClick={() => rejectRequest(req._id)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Reject</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'search' && (
                        <div>
                            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                                <input
                                    className="form-input"
                                    placeholder="Enter username..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? '...' : 'Search'}
                                </button>
                            </form>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {searchResults.map(user => (
                                    <div key={user._id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '20px', background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)'
                                    }}>
                                        <div>
                                            <h4 style={{ margin: 0 }}>{user.name}</h4>
                                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>@{user.username}</p>
                                        </div>
                                        <button onClick={() => sendRequest(user._id)} className="btn btn-secondary">Add Friend</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar: Recommendations */}
                <div className="friends-sidebar">
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Personal Suggestions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {recommendations.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No recommendations from friends yet.</p>
                        ) : (
                            recommendations.map(rec => (
                                <div key={rec._id} style={{
                                    padding: '16px', background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)'
                                }}>
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                        {rec.poster && <img src={rec.poster} alt="" style={{ width: '50px', height: '75px', borderRadius: '4px', objectFit: 'cover' }} />}
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{rec.mediaTitle}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>From {rec.sender.name}</div>
                                        </div>
                                    </div>
                                    {rec.message && (
                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px', margin: 0 }}>
                                            "{rec.message}"
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default FriendsPage;
