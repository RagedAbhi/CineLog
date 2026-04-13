import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, Bookmark, Send, TrendingUp, Star, Clock, X, PlayCircle, CheckCircle } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { getMovieDetailsExternal } from '../services/movieService';
import { fetchStreamingAvailability, fetchTrailerID, getTrendingTMDB } from '../services/tmdbService';
import { showToast, showRecommendModal, showTrailerModal, setTeleporting } from '../store/actions';
import { addMovie } from '../store/thunks';
import axios from 'axios';
import config from '../config';

const GlobalSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState({ all: [], movies: [], tvShows: [], people: [] });
    const [trending, setTrending] = useState([]);
    const [recentSearches, setRecentSearches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const searchRef = useRef(null);
    const redirectInProgress = useRef(null);

    const location = useLocation();
    
    // Load recent searches
    useEffect(() => {
        const stored = localStorage.getItem('cuerates_recent_searches');
        if (stored) {
            try { setRecentSearches(JSON.parse(stored)); } catch(e){}
        }
    }, []);

    const saveRecentSearch = useCallback((term) => {
        if (!term || !term.trim()) return;
        setRecentSearches(prev => {
            const newSearches = [term, ...prev.filter(t => t.toLowerCase() !== term.toLowerCase())].slice(0, 8);
            localStorage.setItem('cuerates_recent_searches', JSON.stringify(newSearches));
            return newSearches;
        });
    }, []);

    const clearRecentSearches = (e) => {
        e.stopPropagation();
        setRecentSearches([]);
        localStorage.removeItem('cuerates_recent_searches');
    };

    const handleSelect = useCallback((item) => {
        saveRecentSearch(query || item.title || item.name);
        setIsOpen(false);
        setQuery('');

        try {
            const token = localStorage.getItem('token');
            axios.post(`${config.API_URL}/api/search/track`, {
                id: item.id.toString(),
                title: item.title || item.name,
                mediaType: item.mediaType,
                genreIds: item.genreIds
            }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (e) {}

        if (item.mediaType === 'person') {
            navigate(`/person/${item.id}`);
            return;
        }

        if (item.libraryStatus && item.libraryId) {
            navigate(`/movies/${item.libraryId}`);
            return;
        }

        const idToUse = item.imdbID || item.id;
        navigate(`/movies/${idToUse}?external=true&type=${item.mediaType}`);
    }, [navigate, query, saveRecentSearch]);

    useEffect(() => {
        const fetchTrending = async () => {
            const data = await getTrendingTMDB();
            setTrending(data);
        };
        fetchTrending();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // SILENT AUTO-TELEPORT: Listen for redirect parameter in URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const searchTerm = params.get('search');
        const isRedirect = params.get('redirect') === 'true';

        if (isRedirect && searchTerm && redirectInProgress.current !== searchTerm) {
            redirectInProgress.current = searchTerm;
            const filterType = params.get('type') || 'all';
            
            const silentSearch = async () => {
                dispatch(setTeleporting(true));
                try {
                    const token = localStorage.getItem('token');
                    const response = await axios.get(`${config.API_URL}/api/search?q=${encodeURIComponent(searchTerm)}&type=${filterType}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    const allPeople = response.data.people || 
                                    response.data.all?.filter(p => p.mediaType === 'person') || [];

                    const sortedPeople = [...allPeople].sort((a, b) => {
                        const aHasPic = !!(a.poster || a.profile_path);
                        const bHasPic = !!(b.poster || b.profile_path);
                        if (aHasPic && !bHasPic) return -1;
                        if (!aHasPic && bHasPic) return 1;
                        return (b.popularity || 0) - (a.popularity || 0);
                    });

                    const firstMatch = sortedPeople[0] || response.data.all?.[0];

                    if (firstMatch) {
                        if (firstMatch.mediaType === 'person') {
                            setTimeout(() => {
                                navigate(`/person/${firstMatch.id}`, { replace: true });
                                dispatch(setTeleporting(false));
                            }, 800);
                        } else {
                            handleSelect(firstMatch);
                            dispatch(setTeleporting(false));
                        }
                    } else {
                        dispatch(setTeleporting(false));
                        setQuery(searchTerm);
                        setIsOpen(true);
                    }
                } catch (err) {
                    console.error('Silent Search Error:', err);
                    dispatch(setTeleporting(false));
                } finally {
                    redirectInProgress.current = null;
                }
            };
            
            silentSearch();
            // Clear URL WITHOUT using replace yet to avoid triggering another effect too early
            // though standard practice is fine here.
            navigate(location.pathname, { replace: true });
        } else if (searchTerm && !isRedirect) {
            // Standard pre-fill logic for non-redirect searches
            const filterType = params.get('type');
            if (filterType) setActiveFilter(filterType);
            setQuery(decodeURIComponent(searchTerm));
            setIsOpen(true);
            navigate(location.pathname, { replace: true });
        }
    }, [location.search, location.pathname, navigate, handleSelect]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.trim().length > 2) {
                setLoading(true);
                setIsOpen(true);
                try {
                    const token = localStorage.getItem('token');
                    const response = await axios.get(`${config.API_URL}/api/search?q=${encodeURIComponent(query)}&type=${activeFilter}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setResults(response.data);
                } catch (err) {
                    console.error('Global Search Error:', err);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults({ all: [], movies: [], tvShows: [], people: [] });
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [query, activeFilter]);

    const handleQuickAction = async (e, movie, actionType) => {
        e.stopPropagation();
        if (actionLoading) return;
        if (actionType === 'recommend') {
            dispatch(showRecommendModal(movie));
            return;
        }

        setActionLoading(true);
        try {
            const idToUse = movie.imdbID || movie.id;
            const details = await getMovieDetailsExternal(idToUse, movie.mediaType);
            await dispatch(addMovie({
                ...details,
                imdbID: idToUse,
                status: actionType,
                watchedOn: actionType === 'watched' ? new Date().toISOString().split('T')[0] : null
            }));
            dispatch(showToast(`${movie.title} added to your ${actionType}!`, 'success'));
        } catch (err) {
            console.error('Quick Action Error:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handlePlayTrailer = async (e, movie) => {
        e.stopPropagation();
        try {
            dispatch(showToast('Fetching trailer...', 'info'));
            const videoId = await fetchTrailerID(movie);
            if (videoId) {
                dispatch(showTrailerModal(videoId));
            } else {
                dispatch(showToast('No trailer found on YouTube', 'error'));
            }
        } catch (err) {
            dispatch(showToast('Failed to load trailer', 'error'));
        }
    };

    const renderMediaCard = (item) => (
        <div 
            key={item.imdbID || item.id} 
            className="search-item"
            onClick={() => handleSelect(item)}
        >
            <div className="search-item-poster-container">
                <img 
                    src={item.poster && item.poster !== 'N/A' ? item.poster : 'https://via.placeholder.com/40x60'} 
                    alt={item.title} 
                />
            </div>
            <div className="search-item-info">
                <div className="search-item-header">
                    <div className="search-item-title-row">
                        <div className="search-item-title">{item.title}</div>
                    </div>
                    {item.rating !== 'N/A' && (
                        <div className="search-item-rating">
                            <Star size={12} fill="var(--accent)" />
                            <span>{item.rating}</span>
                        </div>
                    )}
                </div>
                <div className="search-item-meta">
                    <div className="search-item-meta-main">
                        {item.year} • {item.mediaType}
                    </div>
                </div>
                
                {item.socialMetadata && (
                    <div className="search-item-social" style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 'bold', marginTop: '4px' }}>
                        👥 {item.socialMetadata.text}
                    </div>
                )}
                
                <div className="search-item-overview">{item.overview?.substring(0, 80)}...</div>
                
                <div className="search-item-actions">
                    <div className="action-icons-group">
                        <button className="action-icon-btn" onClick={(e) => handlePlayTrailer(e, item)} title="Play Trailer"><PlayCircle size={16} /></button>
                        
                        {item.libraryStatus ? (
                            <div className="library-status-badge" style={{ 
                                background: 'var(--accent)', 
                                color: 'black', 
                                padding: '2px 10px', 
                                borderRadius: '100px', 
                                fontSize: '10px', 
                                fontWeight: 'bold', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px' 
                            }}>
                                <CheckCircle size={10} />
                                {item.libraryStatus.toUpperCase()}
                            </div>
                        ) : (
                            <>
                                <button className="action-icon-btn" onClick={(e) => handleQuickAction(e, item, 'watched')} title="Mark as Watched"><Eye size={16} /></button>
                                <button className="action-icon-btn" onClick={(e) => handleQuickAction(e, item, 'watchlist')} title="Add to Watchlist"><Bookmark size={16} /></button>
                            </>
                        )}
                        
                        <button className="action-icon-btn" onClick={(e) => handleQuickAction(e, item, 'recommend')} title="Recommend"><Send size={16} /></button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderPersonCard = (person) => (
        <div 
            key={person.id} 
            className="search-person-item"
            onClick={() => handleSelect(person)}
            style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <img 
                src={person.image || 'https://via.placeholder.com/50'} 
                alt={person.name} 
                style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div>
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{person.name}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Known for: {person.knownFor || 'Acting'}</div>
            </div>
        </div>
    );

    const renderGroupedResults = () => {
        if (loading) return <div className="search-loading-state"><div className="spinner-medium" />Searching...</div>;
        
        const hasQuery = query.trim().length > 2;
        // Fallback merge just in case backend isn't returning 'all' explicitly yet
        const allItems = results.all && results.all.length > 0 
            ? results.all 
            : [...(results.people || []), ...(results.movies || []), ...(results.tvShows || [])]
                .sort((a,b) => ((b.personalizationScore || 0) + (b.popularity || 0)/1000) - ((a.personalizationScore || 0) + (a.popularity || 0)/1000));
                
        const hasResults = allItems.length > 0;

        if (!hasQuery && (trending.length > 0 || recentSearches.length > 0)) {
            return (
                <div className="search-discovery-section">
                    {recentSearches.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <div className="search-section-header" style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={16} />
                                    <span>Recent Searches</span>
                                </div>
                                <X size={14} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={clearRecentSearches} title="Clear history" />
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 15px' }}>
                                {recentSearches.map(term => (
                                    <div 
                                        key={term} 
                                        onClick={() => { setQuery(term); setIsOpen(true); }}
                                        style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer' }}
                                    >
                                        {term}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="search-section-header">
                        <TrendingUp size={16} />
                        <span>Trending Now</span>
                    </div>
                    <div className="trending-list">
                        {trending.map((item, idx) => (
                            <div key={idx} className="trending-item" onClick={() => handleSelect(item)}>
                                <span className="trending-rank">{idx + 1}</span>
                                <img src={item.poster} alt="" />
                                <div className="trending-info">
                                    <div className="trending-title">{item.title}</div>
                                    <div className="trending-meta">{item.year} • {item.mediaType}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (hasResults) {
            return (
                <div className="search-results-list" style={{ paddingBottom: '15px' }}>
                    
                    {activeFilter === 'all' && allItems.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                            <div className="search-section-header" style={{ padding: '10px 15px', fontSize: '14px', color: 'var(--accent)' }}>Top Results</div>
                            {allItems.map(item => item.mediaType === 'person' ? renderPersonCard(item) : renderMediaCard(item))}
                        </div>
                    )}

                    {activeFilter === 'person' && results.people.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                            <div className="search-section-header" style={{ padding: '10px 15px', fontSize: '14px', color: 'var(--accent)' }}>People</div>
                            {results.people.map(renderPersonCard)}
                        </div>
                    )}
                    
                    {activeFilter === 'movie' && results.movies.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                            <div className="search-section-header" style={{ padding: '10px 15px', fontSize: '14px', color: 'var(--accent)' }}>Movies</div>
                            {results.movies.map(renderMediaCard)}
                        </div>
                    )}

                    {activeFilter === 'tv' && results.tvShows.length > 0 && (
                        <div>
                            <div className="search-section-header" style={{ padding: '10px 15px', fontSize: '14px', color: 'var(--accent)' }}>TV Shows</div>
                            {results.tvShows.map(renderMediaCard)}
                        </div>
                    )}

                    {/* Loading Overlay for results list to prevent flickering feeling */}
                    {loading && (
                        <div className="search-loading-overlay" style={{
                            position: 'absolute', inset: 0, 
                            background: 'rgba(3,2,19,0.4)', backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 10, borderRadius: 'inherit',
                            animation: 'fadeIn 0.2s ease'
                        }}>
                            <div className="spinner-medium" />
                        </div>
                    )}
                </div>
            );
        }

        return !loading && hasQuery && <div className="search-no-results">No results found for "{query}"</div>;
    };

    return (
        <div className="global-search-container" ref={searchRef}>
            <div className="global-search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    className="global-search-input"
                    placeholder="Search movies, tv, people..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                />
                {(loading || actionLoading) && <div className="spinner-small" />}
            </div>

            {isOpen && (
                <div className="global-search-dropdown glass-panel" data-lenis-prevent>
                    <div className="search-filter-pills" style={{
                        display: 'flex', gap: '8px', padding: '12px 15px 12px', overflowX: 'auto',
                        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        {['all', 'movie', 'tv', 'person'].map(f => (
                            <button 
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                style={{
                                    padding: '6px 14px', borderRadius: '100px', border: 'none',
                                    fontSize: '12px', fontWeight: 'bold', textTransform: 'capitalize', cursor: 'pointer',
                                    background: activeFilter === f ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                                    color: activeFilter === f ? 'black' : 'rgba(255,255,255,0.6)',
                                    transition: 'all 0.2s ease', whiteSpace: 'nowrap'
                                }}
                            >
                                {f === 'tv' ? 'TV Shows' : f === 'person' ? 'People' : f === 'movie' ? 'Movies' : 'All'}
                            </button>
                        ))}
                    </div>
                    {renderGroupedResults()}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
