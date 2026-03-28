import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, Bookmark, Send, Check, TrendingUp, Star } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { getMovieDetailsExternal, createMovie } from '../services/movieService';
import { searchMultiTMDB, getTrendingTMDB, GENRE_MAP, getBatchProvidersTMDB } from '../services/tmdbService';
import { showToast, showRecommendModal } from '../store/actions';

const GlobalSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [trending, setTrending] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [providerData, setProviderData] = useState({}); // { id: [providers] }
    
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const searchRef = useRef(null);
    const userMovies = useSelector(state => state.movies.items);

    // Auto-search from URL param
    const location = useLocation();
    useEffect(() => {
        const searchParam = new URLSearchParams(location.search).get('search');
        if (searchParam) {
            setQuery(searchParam);
            setIsOpen(true);
        }
    }, [location.search]);
    
    // Calculate user genre/cast/director/type preferences for personalization
    const userPreferences = useMemo(() => {
        const prefs = { genres: {}, actors: {}, directors: {}, types: { movie: 0, series: 0 } };
        userMovies.forEach(m => {
            // Genres
            (m.genre?.split(', ') || []).forEach(g => {
                prefs.genres[g] = (prefs.genres[g] || 0) + 1;
            });
            // Actors
            (m.cast?.split(', ') || []).forEach(a => {
                prefs.actors[a] = (prefs.actors[a] || 0) + 1;
            });
            // Director
            if (m.director) {
                prefs.directors[m.director] = (prefs.directors[m.director] || 0) + 1;
            }
            // Types
            if (m.mediaType === 'series') prefs.types.series++;
            else prefs.types.movie++;
        });
        return prefs;
    }, [userMovies]);

    const typeWeights = useMemo(() => {
        const total = userMovies.length || 1;
        return {
            movie: (userPreferences.types.movie / total) * 50,
            series: (userPreferences.types.series / total) * 50
        };
    }, [userPreferences, userMovies.length]);

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

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.length > 2) {
                setLoading(true);
                setIsOpen(true);
                try {
                    const data = await searchMultiTMDB(query);
                    
                    const personalized = data.map(item => {
                        let score = item.popularity || 0;
                        let reasons = [];

                        // 1. Media Type Preference
                        const typeBoost = typeWeights[item.mediaType] || 0;
                        if (typeBoost > 25) reasons.push(`Top ${item.mediaType === 'series' ? 'Series' : 'Movie'} Pick`);

                        // 2. Genre match
                        let genreBoost = 0;
                        let topGenre = '';
                        item.genreIds.forEach(gid => {
                            const gName = GENRE_MAP[gid];
                            const count = userPreferences.genres[gName] || 0;
                            if (count > genreBoost) {
                                genreBoost = count;
                                topGenre = gName;
                            }
                        });
                        
                        if (topGenre && genreBoost > 2) reasons.push(`Matches your love for ${topGenre}`);

                        // 3. Overview match for favorite actors/directors
                        let personBoost = 0;
                        let matchedPerson = '';
                        const textToSearch = `${item.title} ${item.overview} ${item.subtitle || ''}`.toLowerCase();
                        
                        Object.keys(userPreferences.actors).forEach(actor => {
                            if (textToSearch.includes(actor.toLowerCase())) {
                                const boost = userPreferences.actors[actor] * 15;
                                if (boost > personBoost) {
                                    personBoost = boost;
                                    matchedPerson = actor;
                                }
                            }
                        });

                        Object.keys(userPreferences.directors).forEach(dir => {
                            if (textToSearch.includes(dir.toLowerCase())) {
                                const boost = userPreferences.directors[dir] * 20;
                                if (boost > personBoost) {
                                    personBoost = boost;
                                    matchedPerson = dir;
                                }
                            }
                        });
                        
                        if (matchedPerson) reasons.push(`Featured: ${matchedPerson}`);

                        const typeScore = Math.min((typeBoost / 50) * 20, 20);
                        const genreScore = Math.min((genreBoost / 10) * 40, 40);
                        const personScore = Math.min((personBoost / 50) * 40, 40);
                        
                        const matchPercentage = Math.round(typeScore + genreScore + personScore);
                        
                        if (topGenre && genreBoost > 2) reasons.push(topGenre);
                        if (matchedPerson) reasons.push(matchedPerson);
                        
                        let combinedReason = '';
                        if (reasons.length > 0) {
                            combinedReason = `Matches your love for ${reasons.join(' & ')}`;
                        } else if (typeBoost > 25) {
                            combinedReason = `Top ${item.mediaType === 'series' ? 'Series' : 'Movie'} for you`;
                        }

                        const totalMatchScore = (genreBoost * 20) + personBoost + typeBoost;
                        
                        // Map IDs to human-readable genre string
                        const genreString = (item.genreIds || [])
                            .map(gid => GENRE_MAP[gid])
                            .filter(Boolean)
                            .join(', ');

                        return { 
                            ...item, 
                            genre: genreString,
                            matchScore: totalMatchScore, 
                            totalScore: score + totalMatchScore,
                            matchPercentage: Math.min(matchPercentage, 99),
                            recommendationReason: combinedReason
                        };
                    }).sort((a, b) => b.totalScore - a.totalScore);

                    setResults(personalized || []);
                    setSelectedIndex(-1);
                    
                    // Fetch streaming providers for results in background
                    if (personalized.length > 0) {
                        getBatchProvidersTMDB(personalized).then(pResults => {
                            const pMap = {};
                            pResults.forEach(pr => { pMap[pr.id] = pr.providers; });
                            setProviderData(prev => ({ ...prev, ...pMap }));
                        });
                    }
                } catch (err) {
                    console.error('Global Search Error:', err);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [query, userPreferences, typeWeights]);

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
            await createMovie({
                ...details,
                imdbID: idToUse,
                status: actionType,
                watchedOn: actionType === 'watched' ? new Date().toISOString().split('T')[0] : null
            });
            dispatch(showToast(`${movie.title} added to your ${actionType}!`, 'success'));
            setIsOpen(false);
            setQuery('');
        } catch (err) {
            console.error('Quick Action Error:', err);
            dispatch(showToast('Operation failed', 'error'));
        } finally {
            setActionLoading(false);
        }
    };



    const handleSelect = (movie) => {
        setIsOpen(false);
        setQuery('');
        const idToUse = movie.imdbID || movie.id;
        navigate(`/movies/${idToUse}?external=true&type=${movie.mediaType}`);
    };

    const renderSearchResults = () => {
        if (loading) return <div className="search-loading-state"><div className="spinner-medium" />Searching...</div>;
        
        if (query.length === 0 && trending.length > 0) {
            return (
                <div className="search-discovery-section">
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

        if (results.length > 0) {
            return (
                <div className="search-results-list">
                    {results.map((item, index) => {
                        const isTopMatch = index === 0 && item.matchScore > 0;

                        return (
                            <div 
                                key={item.imdbID || item.id} 
                                className={`search-item ${index === selectedIndex ? 'selected' : ''}`}
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
                                            {item.subtitle && <span className="search-item-subtitle"> • {item.subtitle}</span>}
                                        </div>
                                        {providerData[item.id] && providerData[item.id].length > 0 && (
                                            <div className="search-item-providers">
                                                {providerData[item.id].map(p => (
                                                    <img key={p.name} src={p.logo} alt={p.name} title={p.name} className="provider-tiny-logo" />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="search-item-overview">{item.overview?.substring(0, 80)}...</div>
                                    
                                    <div className="search-item-actions">
                                        <div className="action-icons-group">
                                            <button 
                                                className="action-icon-btn"
                                                onClick={(e) => handleQuickAction(e, item, 'watched')}
                                                title="Mark as Watched"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button 
                                                className="action-icon-btn"
                                                onClick={(e) => handleQuickAction(e, item, 'watchlist')}
                                                title="Add to Watchlist"
                                            >
                                                <Bookmark size={16} />
                                            </button>
                                            <button 
                                                className="action-icon-btn"
                                                onClick={(e) => handleQuickAction(e, item, 'recommend')}
                                                title="Recommend"
                                            >
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        return !loading && query.length > 2 && <div className="search-no-results">No results found for "{query}"</div>;
    };

    return (
        <div className="global-search-container" ref={searchRef}>
            <div className="global-search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    className="global-search-input"
                    placeholder="Search titles, actors, genres..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (!results.length) return;
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
                        } else if (e.key === 'Enter' && selectedIndex >= 0) {
                            handleSelect(results[selectedIndex]);
                        }
                    }}
                    onFocus={() => setIsOpen(results.length > 0 || trending.length > 0)}
                />
                {(loading || actionLoading) && <div className="spinner-small" />}
            </div>

            {isOpen && (
                <div className="global-search-dropdown glass-panel" data-lenis-prevent>
                    {renderSearchResults()}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
