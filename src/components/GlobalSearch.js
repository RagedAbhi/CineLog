import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchMoviesExternal, getMovieDetailsExternal, createMovie } from '../services/movieService';
import RecommendModal from './RecommendModal';

const GlobalSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [showRecommendModal, setShowRecommendModal] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    
    const navigate = useNavigate();
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

    const handleSelect = (movie) => {
        setIsOpen(false);
        setQuery('');
        navigate(`/movies/${movie.imdbID}?external=true`);
    };

    const handleQuickAdd = async (e, movie, status = 'watched') => {
        e.stopPropagation();
        setActionLoading(true);
        try {
            const details = await getMovieDetailsExternal(movie.imdbID, movie.mediaType);
            const movieData = {
                ...details,
                imdbID: movie.imdbID,
                status,
                rating: null,
                review: '',
                watchedOn: status === 'watched' ? new Date().toISOString().split('T')[0] : null
            };
            await createMovie(movieData);
            alert(`${movie.title} added to your library!`);
            setIsOpen(false);
            setQuery('');
        } catch (err) {
            console.error('Quick Add Error:', err);
            alert('Failed to add movie');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRecommendClick = async (e, movie) => {
        e.stopPropagation();
        setSelectedMedia(movie);
        setShowRecommendModal(true);
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
                        results.map((item) => (
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
                                        <button 
                                            className="btn-search-quick primary"
                                            onClick={(e) => handleQuickAdd(e, item)}
                                        >
                                            + Watch
                                        </button>
                                        <button 
                                            className="btn-search-quick"
                                            onClick={(e) => handleRecommendClick(e, item)}
                                        >
                                            ✉️ Recommend & Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        !loading && <div className="search-no-results">No results found for "{query}"</div>
                    )}
                </div>
            )}

            {showRecommendModal && selectedMedia && (
                <RecommendModal 
                    movie={selectedMedia}
                    onClose={() => {
                        setShowRecommendModal(false);
                        setSelectedMedia(null);
                    }}
                    onRecommend={async () => {
                        // After recommending, also add to library if not there
                        try {
                            const details = await getMovieDetailsExternal(selectedMedia.imdbID, selectedMedia.mediaType);
                            await createMovie({
                                ...details,
                                imdbID: selectedMedia.imdbID,
                                status: 'watched',
                                watchedOn: new Date().toISOString().split('T')[0]
                            });
                        } catch (err) {
                            console.log('Already in library or failed to add');
                        }
                        setShowRecommendModal(false);
                        setSelectedMedia(null);
                        setIsOpen(false);
                        setQuery('');
                        alert('Recommended and added to watched!');
                    }}
                />
            )}
        </div>
    );
};

export default GlobalSearch;
