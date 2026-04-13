import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Eye, Bookmark, Send, Check, Search, X, Loader2, Star } from 'lucide-react';
import { showToast } from '../store/actions';
import { addMovie, fetchMovies } from '../store/thunks';
import CineSelect from './CineSelect';
import { getMovieDetailsExternal as getMovieDetails } from '../services/movieService';

const GENRES = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller', 'Horror', 'Romance', 'Animation', 'Documentary', 'Fantasy', 'Crime', 'Mystery', 'Adventure', 'Biography', 'History'];

const AddMovieModal = ({ onClose, onSubmit, initialData, defaultType, chatMode, onSelect }) => {
    const [mediaType, setMediaType] = useState(initialData?.mediaType || defaultType || 'movie');
    const [query, setQuery] = useState(initialData?.title || '');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [fetchedMovie, setFetchedMovie] = useState(initialData ? {
        title: initialData.title,
        mediaType: initialData.mediaType,
        poster: initialData.poster,
        imdbID: initialData.imdbID,
        genre: 'Loading...',
        year: ''
    } : null);
    
    const [manualData, setManualData] = useState({
        title: '',
        genre: 'Drama',
        year: '',
        director: ''
    });

    const [manualMode, setManualMode] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [pendingActions, setPendingActions] = useState({});
    const [actionLoading, setActionLoading] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Personalization is now handled entirely on the backend for consistency

    useEffect(() => {
        document.body.classList.add('modal-open');
        if (initialData?.imdbID) {
            fetchDetails(initialData.imdbID, initialData.mediaType);
        }
        return () => document.body.classList.remove('modal-open');
    }, [initialData]);

    const fetchDetails = async (imdbID, type) => {
        setSearching(true);
        try {
            const details = await getMovieDetails(imdbID, type);
            setFetchedMovie(details);
        } catch (err) {
            setSearchError(`Details fetch failed: ${err.message}`);
        } finally {
            setSearching(false);
        }
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
        setSearching(true);
        setSearchError('');
        setSearchResults([]);
        setFetchedMovie(null);
        setManualMode(false);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${config.API_URL}/api/search?q=${encodeURIComponent(query.trim())}&type=${mediaType}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Backend returns { all: [], movies: [], tvShows: [], people: [] }
            // All results from backend are already sorted by personalizationScore
            const data = response.data.all || [];
            
            const results = data.map(item => ({
                ...item,
                imdbID: item.imdbID || String(item.id),
                recommendationReason: item.socialMetadata?.text || (item.personalizationScore > 10 ? 'Matches your taste' : '')
            }));

            setSearchResults(results);
            setSelectedIndex(-1);
        } catch (err) {
            setSearchError(err.message || 'Not found');
        } finally {
            setSearching(false);
        }
    };

    const toggleAction = (e, imdbID, type) => {
        e.stopPropagation();
        setPendingActions(prev => {
            const current = prev[imdbID] || { status: null, recommend: false };
            const next = { ...current };
            if (type === 'watched') next.status = current.status === 'watched' ? null : 'watched';
            else if (type === 'watchlist') next.status = current.status === 'watchlist' ? null : 'watchlist';
            else if (type === 'recommend') next.recommend = !current.recommend;
            return { ...prev, [imdbID]: next };
        });
    };

    const handleExecuteActions = async (e, movie) => {
        e.stopPropagation();
        const actions = pendingActions[movie.imdbID];
        if (!actions) return;

        setActionLoading(true);
        try {
            if (actions.status && actions.status !== 'null') {
                const details = await getMovieDetails(movie.imdbID, movie.mediaType);
                await dispatch(addMovie({
                    ...details,
                    imdbID: movie.imdbID,
                    status: actions.status,
                    watchedOn: actions.status === 'watched' ? new Date().toISOString().split('T')[0] : null
                }));
            }
            if (actions.recommend) {
                onClose(); 
                window.location.href = `/movies/${movie.imdbID}?external=true&recommend=true`;
                return;
            }
            if (actions.status) {
                dispatch(showToast(`${movie.title} added to your library!`, 'success'));
                onClose();
            }
        } catch (err) {
            // Error toast already dispatched by the addMovie thunk — do nothing
            console.error('Action Error:', err);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: '540px' }}>
                <div className="modal-header">
                    <h3>Add to Library</h3>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                
                <div className="modal-body" data-lenis-prevent style={{ paddingBottom: '40px' }}>
                    {!manualMode && !fetchedMovie && (
                        <div className="form-group">
                            <div className="filter-toggle-group" style={{ marginBottom: '16px', justifyContent: 'center' }}>
                                <button 
                                    className={`filter-toggle-btn ${mediaType === 'movie' ? 'active' : ''}`}
                                    onClick={() => setMediaType('movie')}
                                >
                                    Movie
                                </button>
                                <button 
                                    className={`filter-toggle-btn ${mediaType === 'series' ? 'active' : ''}`}
                                    onClick={() => setMediaType('series')}
                                >
                                    TV Show
                                </button>
                            </div>
                            <label className="form-label">Search {mediaType === 'movie' ? 'Movies' : 'Shows'}</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    className="form-input"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (!searchResults.length) return;
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
                                        } else if (e.key === 'Enter') {
                                            if (selectedIndex >= 0) {
                                                const res = searchResults[selectedIndex];
                                                if (chatMode && onSelect) {
                                                    onSelect(res);
                                                } else {
                                                    onClose();
                                                    navigate(`/movies/${res.imdbID}?external=true&type=${res.mediaType}`);
                                                }
                                            } else {
                                                handleSearch();
                                            }
                                        }
                                    }}
                                    placeholder={`Type a ${mediaType === 'movie' ? 'movie' : 'show'} title…`}
                                    style={{ flex: 1 }}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={handleSearch}
                                    disabled={searching || !query.trim()}
                                >
                                    {searching ? <Loader2 className="spinner" size={16} /> : <Search size={16} />}
                                </button>
                            </div>
                        </div>
                    )}

                    {searchResults.length > 0 && !fetchedMovie && (
                        <div className="search-results-list glass-panel" style={{ marginTop: '20px', maxHeight: '350px', overflowY: 'auto' }}>
                            {searchResults.map((res, idx) => {
                                const actions = pendingActions[res.imdbID] || { status: null, recommend: false };
                                const hasSelection = actions.status || actions.recommend;
                                
                                return (
                                    <div 
                                        key={res.imdbID} 
                                        className={`search-result-item ${idx === selectedIndex ? 'selected' : ''}`}
                                        style={{ display: 'flex', gap: '12px', padding: '12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                        onClick={() => {
                                            if (chatMode && onSelect) {
                                                onSelect(res);
                                            } else {
                                                onClose();
                                                navigate(`/movies/${res.imdbID}?external=true&type=${res.mediaType}`);
                                            }
                                        }}
                                    >
                                        <img src={res.poster || 'https://via.placeholder.com/150'} alt="poster" style={{ width: '45px', height: '65px', borderRadius: '6px', objectFit: 'cover' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                                <div style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>{res.title}</div>
                                                {idx === 0 && <span className="top-match-badge" style={{ fontSize: '9px', padding: '1px 5px' }}>Top Match</span>}
                                                {res.recommendationReason && <span className="recommendation-reason-badge" style={{ fontSize: '9px', padding: '1px 5px' }}>{res.recommendationReason}</span>}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                                {res.year} • {res.mediaType}
                                                {res.subtitle && <span className="search-item-subtitle"> • {res.subtitle}</span>}
                                                {res.rating !== 'N/A' && <span style={{ marginLeft: '8px', color: 'var(--accent)' }}><Star size={10} fill="var(--accent)" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} /> {res.rating}</span>}
                                            </div>
                                            
                                            {!chatMode && (
                                                <div className="search-item-actions" style={{ opacity: 1, transform: 'none', pointerEvents: 'auto', marginTop: 0 }} onClick={e => e.stopPropagation()}>
                                                    <div className="action-icons-group">
                                                        <button 
                                                            className={`action-icon-btn ${actions.status === 'watched' ? 'active' : ''}`}
                                                            onClick={(e) => toggleAction(e, res.imdbID, 'watched')}
                                                            title="Mark as Watched"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button 
                                                            className={`action-icon-btn ${actions.status === 'watchlist' ? 'active' : ''}`}
                                                            onClick={(e) => toggleAction(e, res.imdbID, 'watchlist')}
                                                            title="Add to Watchlist"
                                                        >
                                                            <Bookmark size={14} />
                                                        </button>
                                                        <button 
                                                            className={`action-icon-btn ${actions.recommend ? 'active' : ''}`}
                                                            onClick={(e) => toggleAction(e, res.imdbID, 'recommend')}
                                                            title="Recommend"
                                                        >
                                                            <Send size={14} />
                                                        </button>
                                                    </div>
                                                    {hasSelection && (
                                                        <button className="btn-execute-actions" onClick={(e) => handleExecuteActions(e, res)}>
                                                            <Check size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!searching && query.length > 0 && searchResults.length === 0 && !fetchedMovie && !manualMode && (
                        <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ width: '100%', marginTop: '12px' }}
                            onClick={() => setManualMode(true)}
                        >
                            + Add Manually
                        </button>
                    )}

                    {manualMode && (
                        <div className="manual-form glass-panel" style={{ marginTop: '20px', padding: '20px' }}>
                            <div className="form-group">
                                <label className="form-label">Media Type</label>
                                <div className="filter-toggle-group" style={{ marginBottom: '16px' }}>
                                    <button 
                                        className={`filter-toggle-btn ${mediaType === 'movie' ? 'active' : ''}`}
                                        onClick={() => setMediaType('movie')}
                                    >
                                        Movie
                                    </button>
                                    <button 
                                        className={`filter-toggle-btn ${mediaType === 'series' ? 'active' : ''}`}
                                        onClick={() => setMediaType('series')}
                                    >
                                        TV Show
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input 
                                    className="form-input" 
                                    value={manualData.title} 
                                    onChange={e => setManualData({...manualData, title: e.target.value})}
                                    placeholder="Enter title"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Genre</label>
                                    <CineSelect 
                                        options={GENRES.map(g => ({ value: g, label: g }))}
                                        value={manualData.genre}
                                        onChange={val => setManualData({...manualData, genre: val})}
                                    />
                                </div>
                                <div className="form-group" style={{ width: '100px' }}>
                                    <label className="form-label">Year</label>
                                    <input 
                                        className="form-input" 
                                        value={manualData.year} 
                                        onChange={e => setManualData({...manualData, year: e.target.value})}
                                        placeholder="YYYY"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Director / Creator</label>
                                <input 
                                    className="form-input" 
                                    value={manualData.director} 
                                    onChange={e => setManualData({...manualData, director: e.target.value})}
                                    placeholder="Name"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ flex: 1 }}
                                    onClick={() => {
                                        if(!manualData.title) return dispatch(showToast("Title is required", "error"));
                                        onSubmit({
                                            ...manualData,
                                            mediaType,
                                            status: 'watchlist'
                                        });
                                    }}
                                >
                                    Add to Watchlist
                                </button>
                                <button 
                                    className="btn btn-secondary glass-panel" 
                                    onClick={() => setManualMode(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddMovieModal;
