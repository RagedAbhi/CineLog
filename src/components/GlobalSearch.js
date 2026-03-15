import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchMoviesExternal } from '../services/movieService';

const GlobalSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
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
        // We use IMDb ID for the detail page. If it's a new movie, MovieDetail should handle it.
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
                {loading && <div className="spinner-small" />}
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
                                </div>
                            </div>
                        ))
                    ) : (
                        !loading && <div className="search-no-results">No results found for "{query}"</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
