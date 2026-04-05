import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import { fetchCurrentUser, fetchRecommendations, fetchMovies } from '../store/thunks';
import config from '../config';
import { showToast, showConfirmModal } from '../store/actions';
import gsap from 'gsap';
import MovieCard from '../components/MovieCard';
import CineSelect from '../components/CineSelect';
import { motion } from 'framer-motion';
import '../styles/global.css';

const GENRES = ['all', 'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Science Fiction', 'Thriller', 'War', 'Western'];

const Profile = () => {
    const { id } = useParams();
    const dispatch = useDispatch();
    const { user: currentUser, recommendations } = useSelector(state => state.auth);
    const { items: myMovies } = useSelector(state => state.movies);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [formData, setFormData] = useState({ name: '', bio: '', username: '', profilePicture: '' });
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
    
    // Filters
    const [recGenreFilter, setRecGenreFilter] = useState('all');
    const [recMediaTypeFilter, setRecMediaTypeFilter] = useState('all');
    const [recSortOrder, setRecSortOrder] = useState('latest');
    
    const [sentGenreFilter, setSentGenreFilter] = useState('all');
    const [sentMediaTypeFilter, setSentMediaTypeFilter] = useState('all');
    const [sentSortOrder, setSentSortOrder] = useState('latest');

    const [topGenreFilter, setTopGenreFilter] = useState('all');
    const [topMediaTypeFilter, setTopMediaTypeFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('expertise'); // ['expertise', 'top_picks', 'received', 'sent']
    const [isBioExpanded, setIsBioExpanded] = useState(false);
    
    const fileInputRef = useRef(null);

    // Reset filters on profile change
    useEffect(() => {
        setRecGenreFilter('all');
        setRecMediaTypeFilter('all');
        setSentGenreFilter('all');
        setSentMediaTypeFilter('all');
        setTopGenreFilter('all');
        setTopMediaTypeFilter('all');
    }, [id]);

    // Decode JWT to get current user ID reliably (works on page refresh when Redux state is empty)
    const getTokenUserId = () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.id;
        } catch { return null; }
    };

    useEffect(() => {
        fetchProfile();
        dispatch(fetchMovies());
    }, [id]);

    useEffect(() => {
        if (!loading && profile) {
            gsap.fromTo(".profile-anim",
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "circ.out" }
            );
        }
        if (!loading && profile && !isEditing) {
            markReadIfNeeded();
        }
    }, [loading, profile, isEditing, id, currentUser]);

    const renderReceivedRecs = () => {
        const profileId = profile._id?.toString();
        const currentUserId = (currentUser?._id || currentUser?.id || getTokenUserId())?.toString();

        let filtered = profile.recommendations?.filter(r => {
            const recReceiverId = (r.receiver?._id || r.receiver)?.toString();
            const recSenderId = (r.sender?._id || r.sender)?.toString();
            const isOwnProfile = !id || id.toString() === currentUserId;

            let isValidContext = false;
            if (isOwnProfile) isValidContext = (recReceiverId === profileId);
            else isValidContext = (recSenderId === profileId && recReceiverId === currentUserId);
            
            return isValidContext;
        }) || [];

        const grouped = {};
        filtered.forEach(r => {
            const canonicalKey = (r.mediaTitle?.toLowerCase().trim() + '|' + r.mediaType).toLowerCase().replace(/\s/g, '');
            if (!grouped[canonicalKey]) {
                grouped[canonicalKey] = { ...r, count: 1, allIds: [r._id], allSenders: [r.sender] };
            } else {
                grouped[canonicalKey].count += 1;
                grouped[canonicalKey].allIds.push(r._id);
                const currentSenderId = (r.sender?._id || r.sender)?.toString();
                if (!grouped[canonicalKey].allSenders.some(s => (s?._id || s)?.toString() === currentSenderId)) {
                    grouped[canonicalKey].allSenders.push(r.sender);
                }
                if (!r.read) grouped[canonicalKey].read = false;
            }
        });
        
        filtered = Object.values(grouped);
        if (recGenreFilter !== 'all') {
            const q = recGenreFilter.toLowerCase();
            filtered = filtered.filter(r => r.genre?.toLowerCase().includes(q));
        }
        if (recMediaTypeFilter !== 'all') filtered = filtered.filter(r => r.mediaType === recMediaTypeFilter);
        
        filtered = [...filtered].sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return recSortOrder === 'latest' ? dateB - dateA : dateA - dateB;
        });

        return (
            <>
                <div className="profile-rec-controls" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <div style={{ width: '160px' }}>
                        <CineSelect options={GENRES.map(g => ({ value: g, label: g === 'all' ? 'All Genres' : g }))} value={recGenreFilter} onChange={setRecGenreFilter} placeholder="Genre" />
                    </div>
                    <div className="analytics-media-tabs" style={{ margin: 0, padding: '2px', height: '38px' }}>
                        {['all', 'movie', 'series'].map(type => (
                            <button key={type} className={`media-tab ${recMediaTypeFilter === type ? 'active' : ''}`} onClick={() => setRecMediaTypeFilter(type)} style={{ fontSize: '12px', padding: '0 12px' }}>
                                {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
                            </button>
                        ))}
                    </div>
                    <div className="filter-toggle-group" style={{ margin: 0, height: '38px' }}>
                        {['latest', 'oldest'].map(order => (
                            <button key={order} className={`filter-toggle-btn ${recSortOrder === order ? 'active' : ''}`} onClick={() => setRecSortOrder(order)}>
                                {order.charAt(0).toUpperCase() + order.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {filtered.length > 0 ? (
                    <div className="media-grid-minimal">
                        {filtered.map((rec, index) => (
                            <div key={rec._id} className="rec-card-wrapper" style={{ position: 'relative' }}>
                                <MovieCard 
                                    movie={{
                                        _id: rec.imdbID,
                                        title: rec.mediaTitle,
                                        poster: rec.poster,
                                        imdbID: rec.imdbID,
                                        mediaType: rec.mediaType,
                                        genre: rec.genre,
                                        isExternal: true,
                                        isRecommendation: true
                                    }} 
                                    index={index} 
                                />
                                {rec.count > 1 && <div className="rec-count-badge">Multi-Friend Pick</div>}
                                <div className="rec-attribution" style={{ marginTop: '10px' }}>
                                    by @{rec.sender?.username || 'friend'}
                                    {rec.allSenders?.length > 1 ? (
                                        <span className="others-trigger" onClick={(e) => e.stopPropagation()}>
                                            {` and ${rec.allSenders.length - 1} others`}
                                            <span className="others-tooltip">
                                                <span className="tooltip-header">Recommended by:</span>
                                                {rec.allSenders.map((s, i) => (
                                                    <span key={i} className="tooltip-user">
                                                        {s.name || s.username || 'Unknown User'}
                                                    </span>
                                                ))}
                                            </span>
                                        </span>
                                    ) : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="picks-empty-minimal">No recommendations received yet.</p>
                )}
            </>
        );
    };

    const renderSentRecs = () => {
        const profileId = profile._id?.toString();
        const currentUserId = (currentUser?._id || currentUser?.id || getTokenUserId())?.toString();
        const isOwnProfile = !id || id.toString() === currentUserId;

        let filtered = profile.recommendations?.filter(r => {
            const recSenderId = (r.sender?._id || r.sender)?.toString();
            return isOwnProfile ? recSenderId === profileId : (recSenderId === currentUserId && (r.receiver?._id || r.receiver)?.toString() === profileId);
        }) || [];

        const grouped = {};
        filtered.forEach(r => {
            const canonicalKey = (r.mediaTitle?.toLowerCase().trim() + '|' + r.mediaType).toLowerCase().replace(/\s/g, '');
            if (!grouped[canonicalKey]) {
                grouped[canonicalKey] = { ...r, count: 1, allIds: [r._id], allReceivers: [r.receiver] };
            } else {
                grouped[canonicalKey].count += 1;
                grouped[canonicalKey].allIds.push(r._id);
                if (r.receiver) grouped[canonicalKey].allReceivers.push(r.receiver);
            }
        });
        
        filtered = Object.values(grouped);
        if (sentGenreFilter !== 'all') filtered = filtered.filter(r => r.genre?.toLowerCase().includes(sentGenreFilter.toLowerCase()));
        if (sentMediaTypeFilter !== 'all') filtered = filtered.filter(r => r.mediaType === sentMediaTypeFilter);
        
        filtered = [...filtered].sort((a, b) => (sentSortOrder === 'latest' ? new Date(b.createdAt) - new Date(a.createdAt) : new Date(a.createdAt) - new Date(b.createdAt)));

        return (
            <>
                <div className="profile-rec-controls" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <div style={{ width: '160px' }}>
                        <CineSelect options={GENRES.map(g => ({ value: g, label: g === 'all' ? 'All Genres' : g }))} value={sentGenreFilter} onChange={setSentGenreFilter} placeholder="Genre" />
                    </div>
                    <div className="analytics-media-tabs" style={{ margin: 0, padding: '2px', height: '38px' }}>
                        {['all', 'movie', 'series'].map(type => (
                            <button key={type} className={`media-tab ${sentMediaTypeFilter === type ? 'active' : ''}`} onClick={() => setSentMediaTypeFilter(type)} style={{ fontSize: '12px', padding: '0 12px' }}>
                                {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
                            </button>
                        ))}
                    </div>
                </div>

                {filtered.length > 0 ? (
                    <div className="media-grid-minimal">
                        {filtered.map((rec, index) => (
                            <div key={rec._id} className="rec-card-wrapper" style={{ position: 'relative' }}>
                                <MovieCard 
                                    movie={{
                                        _id: rec.imdbID,
                                        title: rec.mediaTitle,
                                        poster: rec.poster,
                                        imdbID: rec.imdbID,
                                        mediaType: rec.mediaType,
                                        genre: rec.genre,
                                        isExternal: true,
                                        isRecommendation: true
                                    }} 
                                    index={index} 
                                />
                                <div className="rec-attribution" style={{ marginTop: '10px' }}>
                                    to @{rec.receiver?.username || 'friend'}
                                    {rec.count > 1 ? (
                                        <span className="others-trigger" onClick={(e) => e.stopPropagation()}>
                                            {` and ${rec.count - 1} others`}
                                            <span className="others-tooltip">
                                                <span className="tooltip-header">Sent to:</span>
                                                {rec.allReceivers?.map((s, i) => (
                                                    <span key={i} className="tooltip-user">
                                                        {s.name || s.username || 'Unknown User'}
                                                    </span>
                                                ))}
                                            </span>
                                        </span>
                                    ) : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="picks-empty-minimal">No recommendations sent yet.</p>
                )}
            </>
        );
    };

    const renderExpertise = () => {
        if (!profile || !profile.expertise) return null;

        const { expertise } = profile;
        const hasWatched = expertise.totalWatched > 0;
        
        const getRank = (count) => {
            if (count >= 30) return { name: 'Cinephile Master', color: '#ffd700' };
            if (count >= 15) return { name: 'Expert', color: 'var(--accent)' };
            if (count >= 5) return { name: 'Enthusiast', color: '#00e676' };
            return { name: 'Novice', color: '#90a4ae' };
        };

        const rank = getRank(expertise.totalWatched);

        return (
            <div className="profile-expertise-section profile-anim" style={{ marginBottom: '60px' }}>
                <div className="picks-header" style={{ marginBottom: '24px' }}>
                    <h2 className="picks-title">Cinema Expertise</h2>
                    <div className="picks-line"></div>
                </div>
                
                {hasWatched ? (
                    <div className="expertise-grid">
                        <div className="expertise-card glass-panel main-rank">
                            <div className="rank-badge" style={{ borderColor: rank.color, color: rank.color }}>{rank.name}</div>
                            <div className="rank-sub">{expertise.totalWatched} Titles Logged</div>
                        </div>
                        
                        <div className="expertise-card glass-panel">
                            <h4>Signature Style</h4>
                            <div className="stats-list">
                                {expertise.topGenres.map(({ name, count }) => (
                                    <div key={name} className="stat-item">
                                        <span className="stat-name">{name}</span>
                                        <div className="stat-bar-bg">
                                            <div className="stat-bar-fill" style={{ width: `${Math.min((count/15)*100, 100)}%` }}></div>
                                        </div>
                                        <span className="stat-count">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {expertise.topActor && (
                            <div className="expertise-card glass-panel">
                                <h4>Actor Focus</h4>
                                <div className="director-highlight">
                                    <div className="director-name">{expertise.topActor.name}</div>
                                    <div className="director-count">{expertise.topActor.count} Works Seen</div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="picks-empty-minimal" style={{ textAlign: 'center', padding: '40px' }}>
                        <p style={{ color: 'var(--text-muted)' }}>Start watching movies to build your cinema expertise! 🎬</p>
                    </div>
                )}
            </div>
        );
    };

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const url = id ? `${config.API_URL}/api/users/${id}` : `${config.API_URL}/api/users/me`;
            const token = localStorage.getItem('token');
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProfile(response.data);
            setFormData({ 
                name: response.data.name, 
                bio: response.data.bio,
                username: response.data.username,
                profilePicture: response.data.profilePicture || ''
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const markReadIfNeeded = async () => {
        const token = localStorage.getItem('token');
        const currentUserId = (currentUser?._id || currentUser?.id)?.toString();
        const profileId = id?.toString();
        

        // Check if there are actually any unread recommendations from this friend to avoid infinite loops
        const hasUnread = recommendations?.some(r => {
            const senderId = (r.sender?._id || r.sender)?.toString();
            const receiverId = (r.receiver?._id || r.receiver)?.toString();
            return senderId === profileId && receiverId === currentUserId && !r.read;
        });

        if (profileId && profileId !== currentUserId && hasUnread) {
            try {
                const res = await axios.patch(`${config.API_URL}/api/recommendations/mark-all-read/${profileId}`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                dispatch(fetchCurrentUser());
                dispatch(fetchRecommendations()); // Ensure notifications clear
            } catch (err) { console.error('Error marking read:', err); }
        }
    };

    const dismissRecommendation = async (recId, e) => {
        if (e) e.stopPropagation();
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${config.API_URL}/api/recommendations/${recId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            dispatch(showToast('Recommendation dismissed', 'success'));
            dispatch(fetchRecommendations());
            dispatch(fetchCurrentUser());
        } catch (err) { 
            console.error('[Profile] Error dismissing recommendation:', err);
            dispatch(showToast('Failed to dismiss recommendation', 'error'));
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${config.API_URL}/api/users/profile`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditing(false);
            fetchProfile();
            dispatch(fetchCurrentUser()); // Sync Redux state (username, name)
            dispatch(showToast('Profile updated successfully!', 'success'));
        } catch (error) {
            console.error('Error updating profile:', error);
            const msg = error.response?.data?.message || 'Error updating profile';
            dispatch(showToast(msg, 'error'));
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${config.API_URL}/api/users/profile/password`, passwordData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsChangingPassword(false);
            setPasswordData({ currentPassword: '', newPassword: '' });
            dispatch(showToast('Password updated successfully!', 'success'));
        } catch (error) {
            console.error('Error changing password:', error);
            const msg = error.response?.data?.message || 'Error updating password';
            dispatch(showToast(msg, 'error'));
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${config.API_URL}/api/users/upload-avatar`, formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            // Update local state and sync Redux
            setProfile({ ...profile, profilePicture: response.data.profilePicture });
            dispatch(fetchCurrentUser());
            dispatch(showToast('Profile picture updated!', 'success'));
        } catch (error) {
            console.error('Error uploading avatar:', error);
            dispatch(showToast('Failed to upload image', 'error'));
        }
    };

    if (loading) return <div className="loading">Loading profile...</div>;
    if (!profile) return <div className="error">Profile not found.</div>;

    const currentUserId = (currentUser?._id || currentUser?.id || getTokenUserId())?.toString();
    const isOwnProfile = !id || id.toString() === currentUserId;

    return (
        <div className="container-fluid">
            <Helmet>
                <title>{profile ? `${profile.name} (@${profile.username}) | Cuerates` : 'Profile | Cuerates'}</title>
                <meta name="description" content={profile?.bio || `View ${profile?.name}'s cinema expertise and top movie picks on Cuerates.`} />
                <meta property="og:title" content={`${profile?.name} on Cuerates`} />
                <meta property="og:description" content={profile?.bio || 'Check out my movie journal and recommendations!'} />
                <meta property="og:image" content={profile?.profilePicture} />
                <meta property="og:type" content="profile" />
                <meta property="profile:username" content={profile?.username} />
            </Helmet>
            <div className="profile-minimal-header profile-anim">
                <div className="profile-top-bar">

                    {isOwnProfile && !isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="minimal-edit-btn"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>

                <div className="profile-main-content">
                    <div 
                        className={`profile-avatar-circle ${isOwnProfile ? 'editable' : ''}`} 
                        style={{ overflow: 'hidden', position: 'relative', cursor: isOwnProfile ? 'pointer' : 'default' }}
                        onClick={() => isOwnProfile && fileInputRef.current.click()}
                    >
                        {profile.profilePicture ? (
                            <img src={profile.profilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            profile.name?.charAt(0) || profile.username?.charAt(0) || '?'
                        )}
                        {isOwnProfile && (
                            <div className="avatar-edit-overlay">
                                <span>📷</span>
                            </div>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleFileChange} 
                            accept="image/*"
                        />
                    </div>

                    {!isEditing ? (
                        <>
                            <h1 className="profile-name-minimal">{profile.name}</h1>
                            <p className="profile-handle">@{profile.username}</p>
                            <div className="profile-stats-row">
                                <div className="stat-item">
                                    <span className="stat-value">{profile.topPicks?.length || 0}</span>
                                    <span className="stat-label">Top Picks</span>
                                </div>
                                <div className="stat-divider"></div>
                                <div className="stat-item">
                                    {(() => {
                                        const lastSeen = profile.lastSeen;
                                        const isOnline = lastSeen && (new Date() - new Date(lastSeen)) < 120000; // 2 minutes
                                        return (
                                            <>
                                                <span className={`stat-value ${isOnline ? 'status-active' : 'status-away'}`}>
                                                    {isOnline ? 'Active' : 'Away'}
                                                </span>
                                                <span className="stat-label">Status</span>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="profile-bio-minimal">
                                {(() => {
                                    const bioText = profile.bio || "No bio yet. Deep into cinematic experiences.";
                                    const THRESHOLD = 160;
                                    const shouldTruncate = bioText.length > THRESHOLD;
                                    
                                    if (!shouldTruncate) return bioText;
                                    
                                    return (
                                        <>
                                            {isBioExpanded ? bioText : `${bioText.slice(0, THRESHOLD)}...`}
                                            <button 
                                                className="bio-toggle-btn"
                                                onClick={() => setIsBioExpanded(!isBioExpanded)}
                                            >
                                                {isBioExpanded ? 'Show Less' : 'See More'}
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleUpdate} className="minimal-edit-form">
                            <div className="form-group-minimal">
                                <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div className="form-group-minimal">
                                <label>Username</label>
                                <input value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required />
                            </div>
                            <div className="form-group-minimal">
                                <label>Bio</label>
                                <textarea value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} rows={3} />
                            </div>
                            <div className="form-actions-minimal">
                                <button type="submit" className="btn-minimal-save">Save</button>
                                <button type="button" className="btn-minimal-cancel" onClick={() => setIsEditing(false)}>Cancel</button>
                            </div>
                        </form>
                    )}

                    {isOwnProfile && !isEditing && !isChangingPassword && (
                        <button 
                            className="minimal-edit-btn" 
                            style={{ marginTop: '12px', opacity: 0.7 }}
                            onClick={() => setIsChangingPassword(true)}
                        >
                            Change Password
                        </button>
                    )}

                    {isChangingPassword && (
                        <form onSubmit={handlePasswordUpdate} className="minimal-edit-form" style={{ marginTop: '20px' }}>
                            <h4>Change Password</h4>
                            <div className="form-group-minimal">
                                <label>Current Password</label>
                                <input 
                                    type="password"
                                    value={passwordData.currentPassword} 
                                    onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })} 
                                    required 
                                />
                            </div>
                            <div className="form-group-minimal">
                                <label>New Password</label>
                                <input 
                                    type="password"
                                    value={passwordData.newPassword} 
                                    onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })} 
                                    required 
                                />
                            </div>
                            <div className="form-actions-minimal">
                                <button type="submit" className="btn-minimal-save">Update Password</button>
                                <button type="button" className="btn-minimal-cancel" onClick={() => setIsChangingPassword(false)}>Cancel</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Premium Tab Navigation */}
            <div className="profile-tabs-nav profile-anim" style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '4px', 
                marginBottom: '40px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                padding: '0 20px 16px'
            }}>
                {[
                    { id: 'expertise', label: 'Cinema Expertise', icon: '🎬' },
                    { id: 'top_picks', label: 'Top Picks', icon: '⭐' },
                    { id: 'received', label: 'Received', icon: '📥' },
                    { id: 'sent', label: 'Sent', icon: '📤' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`profile-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                            fontSize: '12px',
                            fontWeight: '700',
                            letterSpacing: '1.2px',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'all 0.3s ease',
                            padding: '12px 24px',
                            position: 'relative'
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>{tab.icon}</span> {tab.label}
                        {activeTab === tab.id && (
                            <motion.div 
                                layoutId="profileTabUnderline"
                                style={{ 
                                    position: 'absolute', 
                                    bottom: '-17px', 
                                    left: 0, 
                                    right: 0, 
                                    height: '2px', 
                                    background: 'var(--accent)',
                                    boxShadow: '0 0 15px var(--accent)'
                                }} 
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT */}
            <div className="profile-tab-content">
                {activeTab === 'expertise' && renderExpertise()}

                {activeTab === 'top_picks' && (
                    <div className="top-picks-container profile-anim">
                        <div className="picks-header">
                            <h2 className="picks-title">Top Picks</h2>
                            <div className="picks-line"></div>
                        </div>

                        <div className="profile-rec-controls" style={{ 
                            display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', 
                            flexWrap: 'wrap', padding: '0 4px' 
                        }}>
                            <div style={{ width: '160px' }}>
                                <CineSelect
                                    options={GENRES.map(g => ({ value: g, label: g === 'all' ? 'All Genres' : g }))}
                                    value={topGenreFilter}
                                    onChange={setTopGenreFilter}
                                    placeholder="Genre"
                                />
                            </div>
                            <div className="analytics-media-tabs" style={{ margin: 0, padding: '2px', height: '38px' }}>
                                {['all', 'movie', 'series'].map(type => (
                                    <button 
                                        key={type}
                                        className={`media-tab ${topMediaTypeFilter === type ? 'active' : ''}`}
                                        onClick={() => setTopMediaTypeFilter(type)}
                                        style={{ fontSize: '12px', padding: '0 12px' }}
                                    >
                                        {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {(() => {
                            let filtered = profile.topPicks || [];
                            
                            if (topGenreFilter !== 'all') {
                                const q = topGenreFilter.toLowerCase();
                                filtered = filtered.filter(m => {
                                    if (!m.genre) return false;
                                    const normalized = m.genre.toLowerCase();
                                    // Special case for Sci-Fi
                                    if (q === 'sci-fi' || q === 'science fiction') {
                                        return normalized.includes('sci-fi') || normalized.includes('science fiction');
                                    }
                                    return normalized.includes(q);
                                });
                            }

                            if (topMediaTypeFilter !== 'all') {
                                filtered = filtered.filter(m => m.mediaType === topMediaTypeFilter);
                            }

                            // --- UI Deduplication ---
                            const seen = new Set();
                            filtered = filtered.filter(m => {
                                const titleKey = `${m.title?.toLowerCase().trim()}|${m.mediaType || 'movie'}|${m.year || ''}`;
                                const key = m.imdbID || titleKey;
                                if (seen.has(key)) return false;
                                seen.add(key);
                                return true;
                            });

                            if (filtered.length > 0) {
                                return (
                                    <div className="media-grid-minimal">
                                        {filtered.map((media, index) => (
                                            <MovieCard key={media._id} movie={media} index={index} />
                                        ))}
                                    </div>
                                );
                            }

                            return (
                                <div className="picks-empty-minimal">
                                    <p>No matches found in Top Picks.</p>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'received' && (
                    <div className="top-picks-container profile-anim">
                        <div className="picks-header">
                            <h2 className="picks-title">
                                {isOwnProfile ? "Recommended by Friends" : "Recommended to me"}
                            </h2>
                            <div className="picks-line"></div>
                        </div>
                        {renderReceivedRecs()}
                    </div>
                )}

                {activeTab === 'sent' && (
                    <div className="top-picks-container profile-anim">
                        <div className="picks-header">
                            <h2 className="picks-title">
                                {isOwnProfile ? "Recommended to Friends" : "Recommended by me"}
                            </h2>
                            <div className="picks-line"></div>
                        </div>
                        {renderSentRecs()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
