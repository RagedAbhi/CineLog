import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import { fetchCurrentUser, fetchRecommendations, fetchMovies } from '../store/thunks';
import { showToast, showConfirmModal } from '../store/actions';
import gsap from 'gsap';
import MovieCard from '../components/MovieCard';
import CineSelect from '../components/CineSelect';
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
    }, [loading, profile, isEditing]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const url = id ? `http://localhost:5000/api/users/${id}` : 'http://localhost:5000/api/users/me';
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

    useEffect(() => {
        if (!loading && profile && !isEditing) {
            markReadIfNeeded();
        }
    }, [loading, profile, isEditing, id, currentUser]);

    const markReadIfNeeded = async () => {
        const token = localStorage.getItem('token');
        const currentUserId = (currentUser?._id || currentUser?.id)?.toString();
        const profileId = id?.toString();
        
        console.log(`[markReadIfNeeded] currentUserId: ${currentUserId}, profileId: ${profileId}`);

        // Check if there are actually any unread recommendations from this friend to avoid infinite loops
        const hasUnread = recommendations?.some(r => {
            const senderId = (r.sender?._id || r.sender)?.toString();
            const receiverId = (r.receiver?._id || r.receiver)?.toString();
            return senderId === profileId && receiverId === currentUserId && !r.read;
        });

        if (profileId && profileId !== currentUserId && hasUnread) {
            console.log(`[markReadIfNeeded] Marking all from sender ${profileId} as read`);
            try {
                const res = await axios.patch(`http://localhost:5000/api/recommendations/mark-all-read/${profileId}`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log(`[markReadIfNeeded] Backend response:`, res.data);
                dispatch(fetchCurrentUser());
                dispatch(fetchRecommendations()); // Ensure notifications clear
            } catch (err) { console.error('Error marking read:', err); }
        }
    };

    const dismissRecommendation = async (recId, e) => {
        if (e) e.stopPropagation();
        console.log(`[Profile] Dismissing recommendation: ${recId}`);
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`http://localhost:5000/api/recommendations/${recId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(`[Profile] Dismiss success for: ${recId}`);
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
            await axios.patch('http://localhost:5000/api/users/profile', formData, {
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
            await axios.patch('http://localhost:5000/api/users/profile/password', passwordData, {
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
            const response = await axios.post('http://localhost:5000/api/users/upload-avatar', formData, {
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

    const currentUserId = currentUser?.id || currentUser?._id?.toString() || getTokenUserId();
    const isOwnProfile = !id || id === currentUserId;

    return (
        <div className="container-fluid">
            <div className="profile-minimal-header profile-anim">
                <div className="profile-top-bar">
                    <div className="profile-badge">PRO</div>
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
                                {profile.bio || "No bio yet. Deep into cinematic experiences."}
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

            {/* Recommendations Received SECTION */}
            <div className="top-picks-container profile-anim" style={{ marginTop: '60px' }}>
                <div className="picks-header">
                    <h2 className="picks-title">
                        {isOwnProfile ? "Recommended by Friends" : "Recommended to me"}
                    </h2>
                    <div className="picks-line"></div>
                </div>

                {(() => {
                    const profileId = profile._id?.toString();

                    let filtered = profile.recommendations?.filter(r => {
                        const recReceiverId = (r.receiver?._id || r.receiver)?.toString();
                        const recSenderId = (r.sender?._id || r.sender)?.toString();

                        // 1. Filter by profile context
                        let isValidContext = false;
                        if (isOwnProfile) isValidContext = (recReceiverId === profileId);
                        else isValidContext = (recSenderId === profileId && recReceiverId === currentUserId);
                        
                        if (!isValidContext) return false;

                        // 2. Filter out if already in watchlist/watched (DISABLED as per user request)
                        // const alreadyAdded = myMovies?.some(m => m.imdbID === r.imdbID && (m.status === 'watchlist' || m.status === 'watched'));
                        // if (alreadyAdded) return false;

                        return true;
                    }) || [];

                    // 3. Group duplicates and count them
                    const grouped = {};
                    filtered.forEach(r => {
                        // Use imdbID or a canonical combination of title + type to group
                        const canonicalKey = (r.imdbID || (r.mediaTitle + '|' + r.mediaType)).toLowerCase().replace(/\s/g, '');
                        
                        if (!grouped[canonicalKey]) {
                            grouped[canonicalKey] = { 
                                ...r, 
                                count: 1, 
                                allIds: [r._id], 
                                allSenders: [r.sender] 
                            };
                        } else {
                            grouped[canonicalKey].count += 1;
                            grouped[canonicalKey].allIds.push(r._id);
                            grouped[canonicalKey].allSenders.push(r.sender);
                            // Merge unread status: if any are unread, mark group as unread
                            if (!r.read) grouped[canonicalKey].read = false;
                        }
                    });
                    
                    filtered = Object.values(grouped);

                    // 4. Apply Filters
                    if (recGenreFilter && recGenreFilter !== 'all') {
                        const q = recGenreFilter.toLowerCase();
                        filtered = filtered.filter(r => {
                            if (!r.genre) return false;
                            const normalized = r.genre.toLowerCase();
                            // Special case for Sci-Fi
                            if (q === 'sci-fi' || q === 'science fiction') {
                                return normalized.includes('sci-fi') || normalized.includes('science fiction');
                            }
                            return normalized.includes(q);
                        });
                    }

                    // 4.5 Apply Media Type Filter
                    if (recMediaTypeFilter !== 'all') {
                        filtered = filtered.filter(r => r.mediaType === recMediaTypeFilter);
                    }

                    // 5. Apply Sort
                    filtered = [...filtered].sort((a, b) => {
                        const dateA = new Date(a.createdAt);
                        const dateB = new Date(b.createdAt);
                        return recSortOrder === 'latest' ? dateB - dateA : dateA - dateB;
                    });

                    return (
                        <>
                            <div className="profile-rec-controls" style={{ 
                                display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', 
                                flexWrap: 'wrap', padding: '0 4px' 
                            }}>
                                <div style={{ width: '160px' }}>
                                    <CineSelect
                                        options={GENRES.map(g => ({ value: g, label: g === 'all' ? 'All Genres' : g }))}
                                        value={recGenreFilter}
                                        onChange={setRecGenreFilter}
                                        placeholder="Genre"
                                    />
                                </div>
                                <div className="analytics-media-tabs" style={{ margin: 0, padding: '2px', height: '38px' }}>
                                    {['all', 'movie', 'series'].map(type => (
                                        <button 
                                            key={type}
                                            className={`media-tab ${recMediaTypeFilter === type ? 'active' : ''}`}
                                            onClick={() => setRecMediaTypeFilter(type)}
                                            style={{ fontSize: '12px', padding: '0 12px' }}
                                        >
                                            {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
                                        </button>
                                    ))}
                                </div>
                                <div className="filter-toggle-group" style={{ margin: 0, height: '38px' }}>
                                    <button 
                                        className={`filter-toggle-btn ${recSortOrder === 'latest' ? 'active' : ''}`}
                                        onClick={() => setRecSortOrder('latest')}
                                    >
                                        Latest
                                    </button>
                                    <button 
                                        className={`filter-toggle-btn ${recSortOrder === 'oldest' ? 'active' : ''}`}
                                        onClick={() => setRecSortOrder('oldest')}
                                    >
                                        Oldest
                                    </button>
                                </div>
                                {recGenreFilter !== 'all' && (
                                    <button className="btn-clear" onClick={() => setRecGenreFilter('all')}>Clear</button>
                                )}
                            </div>

                            {filtered.length > 0 ? (
                                <div className="media-grid-minimal">
                                    {filtered.map((rec, index) => {
                                        const isUnseen = !rec.read && (rec.receiver?._id || rec.receiver)?.toString() === currentUserId;
                                        
                                        // Try to find genre in my movies if missing in recommendation
                                        let displayGenre = rec.genre;
                                        if (!displayGenre || displayGenre === 'Unknown') {
                                            const myMatch = myMovies?.find(m => m.imdbID === rec.imdbID);
                                            if (myMatch && myMatch.genre) displayGenre = myMatch.genre;
                                        }

                                        return (
                                        <div key={rec._id} className="rec-card-wrapper" style={{ opacity: 1, visibility: 'visible', position: 'relative' }}>
                                            <MovieCard 
                                                movie={{
                                                    _id: rec.imdbID,
                                                    title: rec.mediaTitle,
                                                    poster: rec.poster,
                                                    imdbID: rec.imdbID,
                                                    mediaType: rec.mediaType,
                                                    genre: displayGenre,
                                                    isExternal: true,
                                                    isRecommendation: true
                                                }} 
                                                index={index} 
                                            />
                                            {rec.count > 1 && (
                                                <div 
                                                    className="rec-count-badge" 
                                                    title={`Recommended by: ${rec.allSenders?.map(s => s?.name || s?.username || 'Friend').join(', ')}`}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '10px',
                                                        left: '10px',
                                                        background: 'rgba(255, 255, 255, 0.95)',
                                                        color: '#1a1a2e',
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        zIndex: 15,
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                                        border: '1px solid rgba(0,0,0,0.1)',
                                                        cursor: 'help'
                                                    }}
                                                >
                                                    x{rec.count}
                                                </div>
                                            )}
                                            {isUnseen && (
                                                <div className="rec-unseen-badge" style={{
                                                    position: 'absolute',
                                                    top: '-10px',
                                                    right: '-10px',
                                                    background: 'linear-gradient(135deg, rgba(255, 59, 48, 0.9), rgba(200, 20, 20, 0.9))',
                                                    color: 'white',
                                                    fontSize: '11px',
                                                    fontWeight: '800',
                                                    padding: '4px 8px',
                                                    borderRadius: '12px',
                                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                                    backdropFilter: 'blur(8px)',
                                                    WebkitBackdropFilter: 'blur(8px)',
                                                    boxShadow: '0 4px 15px rgba(255, 59, 48, 0.4)',
                                                    zIndex: 5,
                                                    letterSpacing: '1px'
                                                }}>
                                                    NEW
                                                </div>
                                            )}
                                            {isOwnProfile && (
                                                <button
                                                    onClick={(e) => {
                                                        if (e) e.stopPropagation();
                                                        const senderNames = rec.allSenders?.map(s => s?.name || s?.username || 'Friend').join(', ');
                                                        dispatch(showConfirmModal({
                                                            title: 'Remove Recommendation',
                                                            message: `This was recommended by ${rec.count} friend${rec.count > 1 ? 's' : ''}${rec.count > 1 ? ` (${senderNames})` : ''}. Are you sure you want to remove the recommendation for "${rec.mediaTitle}"?`,
                                                            confirmText: 'Remove',
                                                            cancelText: 'Cancel',
                                                            isDangerous: true,
                                                            onConfirm: () => {
                                                                if (rec.allIds && rec.allIds.length > 0) {
                                                                    rec.allIds.forEach(id => dismissRecommendation(id));
                                                                } else {
                                                                    dismissRecommendation(rec._id);
                                                                }
                                                            }
                                                        }));
                                                    }}
                                                    title=""
                                                    style={{
                                                        position: 'absolute',
                                                        top: '-10px',
                                                        left: '-10px',
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: 'rgba(30, 30, 40, 0.85)',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                        backdropFilter: 'blur(10px)',
                                                        WebkitBackdropFilter: 'blur(10px)',
                                                        color: 'rgba(255,255,255,0.7)',
                                                        fontSize: '14px',
                                                        lineHeight: '1',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 10,
                                                        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background='rgba(255,59,48,0.85)'; e.currentTarget.style.color='white'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background='rgba(30,30,40,0.85)'; e.currentTarget.style.color='rgba(255,255,255,0.7)'; }}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                            <div className="rec-attribution" style={{ marginTop: '10px' }}>
                                                {isOwnProfile 
                                                    ? `From @${rec.sender?.username || 'friend'}${rec.count > 1 ? ` and ${rec.count - 1} others` : ''}` 
                                                    : `To @${profile.username || 'user'}${rec.count > 1 ? ` (shared by ${rec.count} friends)` : ''}`
                                                }
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                            ) : (
                                <div className="picks-empty-minimal">
                                    <p>{isOwnProfile ? "No recommendations received yet." : `No recommendations from ${profile.name || profile.username} yet.`}</p>
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Recommendations Sent SECTION */}
            <div className="top-picks-container profile-anim" style={{ marginTop: '60px' }}>
                <div className="picks-header">
                    <h2 className="picks-title">
                        {isOwnProfile ? "Recommended to Friends" : "Recommended by me"}
                    </h2>
                    <div className="picks-line"></div>
                </div>

                {(() => {
                    const profileId = profile._id?.toString();

                    let filtered = profile.recommendations?.filter(r => {
                        const recSenderId = (r.sender?._id || r.sender)?.toString();
                        const recReceiverId = (r.receiver?._id || r.receiver)?.toString();

                        if (isOwnProfile) return recSenderId === profileId;

                        // For friend's profile: SHOW ONLY me -> friend
                        return recSenderId === currentUserId && recReceiverId === profileId;
                    }) || [];

                    // 3. Group duplicates and count them
                    const grouped = {};
                    filtered.forEach(r => {
                        const canonicalKey = (r.imdbID || (r.mediaTitle + '|' + r.mediaType)).toLowerCase().replace(/\s/g, '');
                        
                        if (!grouped[canonicalKey]) {
                            grouped[canonicalKey] = { 
                                ...r, 
                                count: 1, 
                                allIds: [r._id], 
                                allReceivers: [r.receiver] 
                            };
                        } else {
                            grouped[canonicalKey].count += 1;
                            grouped[canonicalKey].allIds.push(r._id);
                            grouped[canonicalKey].allReceivers.push(r.receiver);
                        }
                    });
                    
                    filtered = Object.values(grouped);

                    // 4. Apply Filters
                    if (sentGenreFilter && sentGenreFilter !== 'all') {
                        const q = sentGenreFilter.toLowerCase();
                        filtered = filtered.filter(r => {
                            if (!r.genre) return false;
                            const normalized = r.genre.toLowerCase();
                            // Special case for Sci-Fi
                            if (q === 'sci-fi' || q === 'science fiction') {
                                return normalized.includes('sci-fi') || normalized.includes('science fiction');
                            }
                            return normalized.includes(q);
                        });
                    }

                    // 4.5 Apply Media Type Filter
                    if (sentMediaTypeFilter !== 'all') {
                        filtered = filtered.filter(r => r.mediaType === sentMediaTypeFilter);
                    }

                    // 5. Apply Sort
                    filtered = [...filtered].sort((a, b) => {
                        const dateA = new Date(a.createdAt);
                        const dateB = new Date(b.createdAt);
                        return sentSortOrder === 'latest' ? dateB - dateA : dateA - dateB;
                    });

                    return (
                        <>
                            <div className="profile-rec-controls" style={{ 
                                display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', 
                                flexWrap: 'wrap', padding: '0 4px' 
                            }}>
                                <div style={{ width: '160px' }}>
                                    <CineSelect
                                        options={GENRES.map(g => ({ value: g, label: g === 'all' ? 'All Genres' : g }))}
                                        value={sentGenreFilter}
                                        onChange={setSentGenreFilter}
                                        placeholder="Genre"
                                    />
                                </div>
                                <div className="analytics-media-tabs" style={{ margin: 0, padding: '2px', height: '38px' }}>
                                    {['all', 'movie', 'series'].map(type => (
                                        <button 
                                            key={type}
                                            className={`media-tab ${sentMediaTypeFilter === type ? 'active' : ''}`}
                                            onClick={() => setSentMediaTypeFilter(type)}
                                            style={{ fontSize: '12px', padding: '0 12px' }}
                                        >
                                            {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
                                        </button>
                                    ))}
                                </div>
                                <div className="filter-toggle-group" style={{ margin: 0, height: '38px' }}>
                                    <button 
                                        className={`filter-toggle-btn ${sentSortOrder === 'latest' ? 'active' : ''}`}
                                        onClick={() => setSentSortOrder('latest')}
                                    >
                                        Latest
                                    </button>
                                    <button 
                                        className={`filter-toggle-btn ${sentSortOrder === 'oldest' ? 'active' : ''}`}
                                        onClick={() => setSentSortOrder('oldest')}
                                    >
                                        Oldest
                                    </button>
                                </div>
                                {sentGenreFilter !== 'all' && (
                                    <button className="btn-clear" onClick={() => setSentGenreFilter('all')}>Clear</button>
                                )}
                            </div>

                            {filtered.length > 0 ? (
                                <div className="media-grid-minimal">
                                    {filtered.map((rec, index) => {
                                        // Try to find genre in my movies if missing in recommendation
                                        let displayGenre = rec.genre;
                                        if (!displayGenre || displayGenre === 'Unknown') {
                                            const myMatch = myMovies?.find(m => m.imdbID === rec.imdbID);
                                            if (myMatch && myMatch.genre) displayGenre = myMatch.genre;
                                        }
                                        
                                        return (
                                        <div key={rec._id} className="rec-card-wrapper" style={{ opacity: 1, visibility: 'visible', position: 'relative' }}>
                                            <MovieCard 
                                                movie={{
                                                    _id: rec.imdbID,
                                                    title: rec.mediaTitle,
                                                    poster: rec.poster,
                                                    imdbID: rec.imdbID,
                                                    mediaType: rec.mediaType,
                                                    genre: displayGenre,
                                                    isExternal: true,
                                                    isRecommendation: true
                                                }} 
                                                index={index} 
                                            />
                                            {rec.count > 1 && (
                                                <div 
                                                    className="rec-count-badge" 
                                                    title={`Sent to: ${rec.allReceivers?.map(re => re?.name || re?.username || 'Friend').join(', ')}`}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '10px',
                                                        left: '10px',
                                                        background: 'rgba(255, 255, 255, 0.95)',
                                                        color: '#1a1a2e',
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        zIndex: 15,
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                                        border: '1px solid rgba(0,0,0,0.1)',
                                                        cursor: 'help'
                                                    }}
                                                >
                                                    x{rec.count}
                                                </div>
                                            )}
                                            {isOwnProfile && (
                                                <button
                                                    onClick={(e) => {
                                                        if (e) e.stopPropagation();
                                                        const receiverNames = rec.allReceivers?.map(re => re?.name || re?.username || 'Friend').join(', ');
                                                        dispatch(showConfirmModal({
                                                            title: 'Retract Recommendation',
                                                            message: `Withdraw your recommendation for "${rec.mediaTitle}" sent to ${rec.count} friend${rec.count > 1 ? 's' : ''}${rec.count > 1 ? ` (${receiverNames})` : ''}?`,
                                                            confirmText: 'Withdraw',
                                                            cancelText: 'Cancel',
                                                            isDangerous: true,
                                                            onConfirm: () => {
                                                                if (rec.allIds && rec.allIds.length > 0) {
                                                                    rec.allIds.forEach(id => dismissRecommendation(id));
                                                                } else {
                                                                    dismissRecommendation(rec._id);
                                                                }
                                                            }
                                                        }));
                                                    }}
                                                    title=""
                                                    style={{
                                                        position: 'absolute',
                                                        top: '-10px',
                                                        left: '-10px',
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: 'rgba(30, 30, 40, 0.85)',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                        backdropFilter: 'blur(10px)',
                                                        WebkitBackdropFilter: 'blur(10px)',
                                                        color: 'rgba(255,255,255,0.7)',
                                                        fontSize: '14px',
                                                        lineHeight: '1',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 10,
                                                        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background='rgba(255,59,48,0.85)'; e.currentTarget.style.color='white'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background='rgba(30,30,40,0.85)'; e.currentTarget.style.color='rgba(255,255,255,0.7)'; }}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                            <div className="rec-attribution" style={{ marginTop: '10px' }}>
                                                {isOwnProfile 
                                                    ? `To @${rec.receiver?.username || 'friend'}${rec.count > 1 ? ` and ${rec.count - 1} others` : ''}` 
                                                    : `From you${rec.count > 1 ? ` (to ${rec.count} friends)` : ''}`
                                                }
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                            ) : (
                                <div className="picks-empty-minimal">
                                    <p>{isOwnProfile ? "Start sharing your favorites with friends!" : `You haven't recommended anything to ${profile.name || profile.username} yet.`}</p>
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>
        </div>
    );
};

export default Profile;
