import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import '../styles/global.css';

const FriendsPage = () => {
    const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'requests' | 'search'
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const token = localStorage.getItem('token');
    const apiHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchFriends();
        fetchRequests();

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
            alert('Request sent!');
        } catch (err) { alert(err.response?.data?.message || 'Error'); }
    };

    const acceptRequest = async (requestId) => {
        try {
            await axios.post('http://localhost:5000/api/friends/accept', { requestId }, apiHeader);
            fetchFriends();
            fetchRequests();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="container-fluid social-container" style={{ maxWidth: '900px', margin: '0 auto', paddingTop: '40px' }}>
            <div className="page-header" style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h1 style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-2px' }}>Social</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '18px' }}>Connect with fellow cinephiles</p>
            </div>

            <div className="glass-panel" style={{
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
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: activeTab === tab ? 'var(--accent)' : 'transparent',
                            color: activeTab === tab ? '#000' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '100px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '14px',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative'
                        }}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {tab === 'requests' && requests.length > 0 && (
                            <span style={{
                                position: 'absolute', top: '-5px', right: '-5px',
                                background: 'var(--accent)', color: '#000',
                                fontSize: '10px', width: '18px', height: '18px',
                                borderRadius: '50%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontWeight: 'bold',
                                border: '2px solid var(--bg)'
                            }}>
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
                            friends.map(friend => (
                                <Link to={`/profile/${friend._id}`} key={friend._id} className="glass-panel" style={{
                                    padding: '24px',
                                    textDecoration: 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    transition: 'transform 0.3s ease, border-color 0.3s ease'
                                }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                                    <div style={{
                                        width: '64px', height: '64px', borderRadius: '50%',
                                        background: 'linear-gradient(45deg, var(--accent), var(--accent-dim))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '24px', fontWeight: 'bold', color: '#000', marginBottom: '16px',
                                        boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
                                    }}>
                                        {friend.name.charAt(0)}
                                    </div>
                                    <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>{friend.name}</h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>@{friend.username}</p>
                                </Link>
                            ))
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
                                        <button className="btn-clear" style={{ color: 'var(--text-muted)' }} onClick={() => rejectRequest(req._id)}>Decline</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'search' && (
                    <div>
                        <div className="glass-panel" style={{ padding: '8px', borderRadius: '100px', display: 'flex', gap: '10px', marginBottom: '40px' }}>
                            <input
                                className="form-input"
                                style={{ border: 'none', background: 'transparent', padding: '12px 24px', flex: 1 }}
                                placeholder="Search by username..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                            <button className="btn btn-primary" style={{ borderRadius: '100px', padding: '0 30px' }} onClick={handleSearch} disabled={loading}>
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                            {searchResults.map(user => (
                                <div key={user._id} className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <h4 style={{ margin: 0 }}>{user.name}</h4>
                                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>@{user.username}</p>
                                    </div>
                                    <button className="btn btn-secondary btn-sm" onClick={() => sendRequest(user._id)}>Add</button>
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
