import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Bookmark, Send, Check } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { searchMoviesExternal, getMovieDetailsExternal, createMovie } from '../services/movieService';
import { showToast, showRecommendModal } from '../store/actions';

const GlobalSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const searchRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.length > 2) {
                setLoading(true);
                setIsOpen(true);
                try {
                    const data = await searchMoviesExternal(query);
                    setResults(data || []);
                } catch (err) {
                    console.error('Global Search Error:', err);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
                setIsOpen(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const [pendingActions, setPendingActions] = useState({}); // { imdbID: { status: 'watched'|'watchlist'|null, recommend: bool } }

    const toggleAction = (e, imdbID, type) => {
        e.stopPropagation();
        setPendingActions(prev => {
            const current = prev[imdbID] || { status: null, recommend: false };
            const next = { ...current };
            
            if (type === 'watched') {
                next.status = current.status === 'watched' ? null : 'watched';
            } else if (type === 'watchlist') {
                next.status = current.status === 'watchlist' ? null : 'watchlist';
            } else if (type === 'recommend') {
                next.recommend = !current.recommend;
            }
            
            return { ...prev, [imdbID]: next };
        });
    };

    const handleExecuteActions = async (e, movie) => {
        e.stopPropagation();
        const actions = pendingActions[movie.imdbID];
        if (!actions) return;

        setActionLoading(true);
        try {
            // 1. Handle Status (Add to Library)
            if (actions.status && actions.status !== 'null') {
                const details = await getMovieDetailsExternal(movie.imdbID, movie.mediaType);
                await createMovie({
                    ...details,
                    imdbID: movie.imdbID,
                    status: actions.status,
                    watchedOn: actions.status === 'watched' ? new Date().toISOString().split('T')[0] : null
                });
            }

            // 2. Handle Recommendation
            if (actions.recommend) {
                dispatch(showRecommendModal(movie));
                return; // Global recommendation modal will handle the rest
            }

            if (actions.status) {
                dispatch(showToast(`${movie.title} added to your ${actions.status}!`, 'success'));
                setIsOpen(false);
                setQuery('');
            }
        } catch (err) {
            console.error('Action Error:', err);
            dispatch(showToast('Operation failed', 'error'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleSelect = (movie) => {
        setIsOpen(false);
        setQuery('');
        navigate(`/movies/${movie.imdbID}?external=true`);
    };

    return (
        <div className="global-search-container" ref={searchRef}>
            <div className="global-search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    className="global-search-input"
                    placeholder="Search any movie or show..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length > 2 && setIsOpen(true)}
                />
                {(loading || actionLoading) && <div className="spinner-small" />}
            </div>

            {isOpen && (
                <div className="global-search-dropdown glass-panel">
                    {results.length > 0 ? (
                        results.map((item) => {
                            const actions = pendingActions[item.imdbID] || { status: null, recommend: false };
                            const hasSelection = actions.status || actions.recommend;

                            return (
                                <div 
                                    key={item.imdbID} 
                                    className="search-item"
                                    onClick={() => handleSelect(item)}
                                >
                                    <img 
                                        src={item.poster && item.poster !== 'N/A' ? item.poster : 'https://via.placeholder.com/40x60'} 
                                        alt={item.title} 
                                    />
                                    <div className="search-item-info">
                                        <div className="search-item-title">{item.title}</div>
                                        <div className="search-item-meta">{item.year} • {item.mediaType}</div>
                                        <div className="search-item-actions">
                                            <div className="action-icons-group">
                                                <button 
                                                    className={`action-icon-btn ${actions.status === 'watched' ? 'active' : ''}`}
                                                    onClick={(e) => toggleAction(e, item.imdbID, 'watched')}
                                                    title="Mark as Watched"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button 
                                                    className={`action-icon-btn ${actions.status === 'watchlist' ? 'active' : ''}`}
                                                    onClick={(e) => toggleAction(e, item.imdbID, 'watchlist')}
                                                    title="Add to Watchlist"
                                                >
                                                    <Bookmark size={16} />
                                                </button>
                                                <button 
                                                    className={`action-icon-btn ${actions.recommend ? 'active' : ''}`}
                                                    onClick={(e) => toggleAction(e, item.imdbID, 'recommend')}
                                                    title="Recommend"
                                                >
                                                    <Send size={16} />
                                                </button>
                                            </div>
                                            
                                            {hasSelection && (
                                                <button 
                                                    className="btn-execute-actions"
                                                    onClick={(e) => handleExecuteActions(e, item)}
                                                >
                                                    <Check size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        !loading && <div className="search-no-results">No results found for "{query}"</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
