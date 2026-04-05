import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import { User, Film, Play, Star, Calendar, MapPin, Info, ArrowLeft, Filter, Search } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import gsap from 'gsap';
import '../styles/global.css';

const PersonPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [person, setPerson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('actedIn'); // 'actedIn' | 'directed'
    const [filterQuery, setFilterQuery] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('All');
    const [isBioExpanded, setIsBioExpanded] = useState(false);
    
    const containerRef = useRef(null);

    useEffect(() => {
        const fetchPerson = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${config.API_URL}/api/search/person/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPerson(res.data);
                
                // Set default tab based on what's available
                if (res.data.actedIn.length === 0 && res.data.directed.length > 0) {
                    setActiveTab('directed');
                }
            } catch (err) {
                console.error('Fetch Person Error:', err);
                setError('Failed to load person details');
            } finally {
                setLoading(false);
            }
        };

        fetchPerson();
    }, [id]);

    useEffect(() => {
        if (!loading && person) {
            gsap.from(".person-header-content > *", {
                opacity: 0,
                y: 20,
                stagger: 0.1,
                duration: 0.8,
                ease: "power3.out"
            });
        }
    }, [loading, person]);

    const items = useMemo(() => {
        if (!person) return [];
        const baseItems = activeTab === 'actedIn' ? person.actedIn : person.directed;
        
        return baseItems.filter(item => {
            const matchesQuery = item.title.toLowerCase().includes(filterQuery.toLowerCase());
            // Genre filtering would require a mapping or TMDB genre IDs check
            return matchesQuery;
        });
    }, [person, activeTab, filterQuery]);

    if (loading) return (
        <div className="loading-spinner">
            <div className="spinner" />
            <span>Discovering filmography...</span>
        </div>
    );

    if (error) return (
        <div className="error-state glass-panel">
            <Info size={40} color="var(--accent)" />
            <h3>{error}</h3>
            <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
        </div>
    );

    return (
        <div className="container-fluid person-page" ref={containerRef}>
            {/* Header / Profile Section */}
            <div className="person-header glass-panel">
                <button className="back-button" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </button>
                
                <div className="person-header-content">
                    <div className="person-profile-container">
                        {person.info.image ? (
                            <img src={person.info.image} alt={person.info.name} className="person-large-photo" />
                        ) : (
                            <div className="person-photo-placeholder"><User size={60} /></div>
                        )}
                    </div>
                    
                    <div className="person-info-details">
                        <div className="person-badge">{person.info.knownFor}</div>
                        <h1>{person.info.name}</h1>
                        
                        <div className="person-meta-row">
                            {person.info.birthday && (
                                <div className="meta-item">
                                    <Calendar size={14} />
                                    <span>Born {new Date(person.info.birthday).toLocaleDateString()}</span>
                                </div>
                            )}
                            {person.info.placeOfBirth && (
                                <div className="meta-item">
                                    <MapPin size={14} />
                                    <span>{person.info.placeOfBirth}</span>
                                </div>
                            )}
                        </div>

                        {person.info.bio && (
                            <div className="person-bio-container">
                                <p className="person-bio">
                                    {(() => {
                                        const bioText = person.info.bio;
                                        const THRESHOLD = 350;
                                        const isTruncated = bioText.length > THRESHOLD;
                                        
                                        if (!isTruncated) return bioText;
                                        
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
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="person-stats">
                    <div className="stat-card">
                        <span className="stat-value">{person.actedIn.length}</span>
                        <span className="stat-label">Acting Credits</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-value">{person.directed.length}</span>
                        <span className="stat-label">Directing Credits</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-value">TMDB</span>
                        <span className="stat-label">Source</span>
                    </div>
                </div>
            </div>

            {/* Filmography Section */}
            <div className="filmography-container">
                <div className="section-header">
                    <div className="tabs-premium">
                        {person.actedIn.length > 0 && (
                            <button 
                                className={`tab-item ${activeTab === 'actedIn' ? 'active' : ''}`}
                                onClick={() => setActiveTab('actedIn')}
                            >
                                <Play size={16} />
                                Acted In
                            </button>
                        )}
                        {person.directed.length > 0 && (
                            <button 
                                className={`tab-item ${activeTab === 'directed' ? 'active' : ''}`}
                                onClick={() => setActiveTab('directed')}
                            >
                                <Film size={16} />
                                Directed
                            </button>
                        )}
                    </div>

                    <div className="filter-search-bar glass-panel-sm">
                        <Search size={16} />
                        <input 
                            type="text" 
                            placeholder="Search filmography..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                        />
                    </div>
                </div>

                {items.length === 0 ? (
                    <div className="empty-results glass-panel">
                        <Info size={32} />
                        <p>No matches found for this filter.</p>
                    </div>
                ) : (
                    <div className="movie-grid">
                        {items.map((item, idx) => (
                            <MovieCard 
                                key={`${item.id}-${idx}`} 
                                movie={{
                                    ...item,
                                    imdbID: item.id.toString(), // For compatibility with MovieCard
                                }}
                                index={idx}
                            />
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .person-page {
                    max-width: 1200px;
                    margin: 40px auto;
                    padding: 0 20px;
                }
                .person-header {
                    position: relative;
                    padding: 40px;
                    margin-bottom: 40px;
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                    border-radius: 30px;
                    overflow: hidden;
                }
                .back-button {
                    position: absolute;
                    top: 20px;
                    left: 20px;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .back-button:hover {
                    background: var(--accent);
                    transform: translateX(-3px);
                }
                .person-header-content {
                    display: flex;
                    gap: 40px;
                    align-items: flex-start;
                }
                .person-large-photo {
                    width: 200px;
                    height: 300px;
                    object-fit: cover;
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                }
                .person-photo-placeholder {
                    width: 200px;
                    height: 300px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255,255,255,0.3);
                }
                .person-info-details h1 {
                    font-size: 48px;
                    margin: 10px 0 15px;
                    font-weight: 800;
                    background: linear-gradient(to right, #fff, rgba(255,255,255,0.6));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .person-badge {
                    background: var(--accent);
                    color: black;
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    display: inline-block;
                }
                .person-meta-row {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: rgba(255,255,255,0.6);
                    font-size: 14px;
                }
                .person-bio {
                    color: rgba(255,255,255,0.7);
                    line-height: 1.8;
                    font-size: 15px;
                    max-width: 850px;
                }
                .bio-toggle-btn {
                    display: inline-block;
                    background: none;
                    border: none;
                    color: var(--accent);
                    font-weight: 700;
                    font-size: 13px;
                    margin-left: 8px;
                    cursor: pointer;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    padding: 0;
                    transition: all 0.3s ease;
                    opacity: 0.8;
                }
                .bio-toggle-btn:hover {
                    opacity: 1;
                    text-decoration: underline;
                    filter: drop-shadow(0 0 5px var(--accent));
                }
                .person-stats {
                    display: flex;
                    gap: 20px;
                    padding-top: 30px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                .stat-card {
                    background: rgba(255,255,255,0.03);
                    padding: 15px 25px;
                    border-radius: 15px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: var(--accent);
                }
                .stat-label {
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: rgba(255,255,255,0.4);
                    margin-top: 4px;
                }
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                }
                .tabs-premium {
                    background: rgba(255,255,255,0.05);
                    padding: 6px;
                    border-radius: 100px;
                    display: flex;
                    gap: 5px;
                }
                .tab-item {
                    padding: 10px 20px;
                    border-radius: 100px;
                    border: none;
                    background: transparent;
                    color: rgba(255,255,255,0.6);
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .tab-item.active {
                    background: var(--accent);
                    color: black;
                }
                .filter-search-bar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 20px;
                    border-radius: 100px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    min-width: 300px;
                }
                .filter-search-bar input {
                    background: transparent;
                    border: none;
                    color: white;
                    outline: none;
                    width: 100%;
                }
                @media (max-width: 900px) {
                    .person-header-content {
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                    }
                    .person-meta-row {
                        justify-content: center;
                    }
                    .section-header {
                        flex-direction: column;
                        gap: 20px;
                    }
                }
            `}</style>
        </div>
    );
};

export default PersonPage;
