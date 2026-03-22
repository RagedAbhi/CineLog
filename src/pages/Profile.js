import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import gsap from 'gsap';
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
                    <div className="profile-avatar-circle">
                        {profile.name?.charAt(0) || profile.username?.charAt(0) || '?'}
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
                                    <span className="stat-value">Active</span>
                                    <span className="stat-label">Member</span>
                                </div>
                            </div>
                            <div className="profile-bio-minimal">
                                {profile.bio || "No bio yet. Deep into cinematic experiences."}
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleUpdate} className="minimal-edit-form">
                            <div className="form-group-minimal">
                                <label>Name</label>
                                <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
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
                </div>
            </div>

            <div className="top-picks-container profile-anim">
                <div className="picks-header">
                    <h2 className="picks-title">Top Picks</h2>
                    <div className="picks-line"></div>
                </div>

                {profile.topPicks?.length > 0 ? (
                    <div className="media-grid-minimal">
                        {profile.topPicks.map((media, index) => (
                            <MovieCard key={media._id} movie={media} index={index} />
                        ))}
                    </div>
                ) : (
                    <div className="picks-empty-minimal">
                        <p>Discover and add your favorites to this collection.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
