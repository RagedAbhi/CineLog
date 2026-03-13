import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import MovieCard from '../components/MovieCard';
import '../styles/global.css';

const Profile = () => {
    const { id } = useParams();
    const { user: currentUser } = useSelector(state => state.auth);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ name: '', bio: '' });

    useEffect(() => {
        fetchProfile();
    }, [id]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const url = id ? `http://localhost:5000/api/users/${id}` : 'http://localhost:5000/api/users/me';
            const token = localStorage.getItem('token');
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProfile(response.data);
            setFormData({ name: response.data.name, bio: response.data.bio });
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
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
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    };

    if (loading) return <div className="loading">Loading profile...</div>;
    if (!profile) return <div className="error">Profile not found.</div>;

    const isOwnProfile = !id || id === currentUser?.id;

    return (
        <div className="container-fluid">
            <div className="profile-header" style={{
                background: 'var(--bg-elevated)', borderRadius: '24px', padding: '40px',
                border: '1px solid var(--border)', marginBottom: '40px', position: 'relative'
            }}>
                {isOwnProfile && !isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        Edit Profile
                    </button>
                )}

                {isEditing ? (
                    <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Bio (Tell us about your movie taste!)</label>
                            <textarea className="form-input" value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} rows={3} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button type="submit" className="btn btn-primary">Save Changes</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                        </div>
                    </form>
                ) : (
                    <>
                        <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>{profile.name}</h1>
                        <p style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '16px' }}>@{profile.username}</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '18px', lineHeight: '1.6', maxWidth: '600px' }}>
                            {profile.bio || 'This user hasn\'t added a bio yet.'}
                        </p>
                    </>
                )}
            </div>

            <div className="top-picks-section">
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    ⭐ Top Picks <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}>({profile.topPicks?.length || 0})</span>
                </h2>

                {profile.topPicks?.length > 0 ? (
                    <div className="media-grid">
                        {profile.topPicks.map(media => (
                            <MovieCard key={media._id} movie={media} />
                        ))}
                    </div>
                ) : (
                    <div style={{
                        padding: '40px', textAlign: 'center', borderRadius: '16px',
                        border: '2px dashed var(--border)', color: 'var(--text-muted)'
                    }}>
                        No top picks added yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
