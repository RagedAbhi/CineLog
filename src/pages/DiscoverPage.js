import React, { Component } from 'react';
import { connect } from 'react-redux';
import MovieCard from '../components/MovieCard';
import axios from 'axios';
import config from '../config';
import { fetchMovies } from '../store/thunks';
import { showToast } from '../store/actions';
import gsap from 'gsap';

const GENRES = [
    { id: 28, name: 'Action' }, { id: 35, name: 'Comedy' }, { id: 18, name: 'Drama' },
    { id: 27, name: 'Horror' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Sci-Fi' },
    { id: 53, name: 'Thriller' }, { id: 16, name: 'Animation' }, { id: 99, name: 'Documentary' },
    { id: 14, name: 'Fantasy' }, { id: 80, name: 'Crime' }, { id: 9648, name: 'Mystery' },
];

const LANGUAGES = [
    { code: 'en', name: 'English' }, { code: 'hi', name: 'Hindi' },
    { code: 'ko', name: 'Korean' }, { code: 'ja', name: 'Japanese' },
    { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' },
    { code: 'zh', name: 'Chinese' }, { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' }, { code: 'ml', name: 'Malayalam' },
];

class DiscoverPage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            recommendations: [],
            loading: true,
            loadingMore: false,
            error: null,
            feedGeneratedAt: null,
            page: 1,
            hasMore: true,
            // Filters
            typeFilter: 'all',
            genreFilter: null,
            languageFilter: null,
        };
        this.headerRef = React.createRef();
        this.gridRef = React.createRef();
        this.observer = null;
    }

    async componentDidMount() {
        if (this.props.movies.length === 0) {
            await this.props.fetchMovies();
        }
        this.generateFeed();
        gsap.fromTo(this.headerRef.current,
            { opacity: 0, y: -20 },
            { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
        );
    }

    componentWillUnmount() {
        if (this.observer) this.observer.disconnect();
    }

    handleObserver = (node) => {
        if (this.observer) this.observer.disconnect();
        if (node) {
            this.observer = new IntersectionObserver((entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && !this.state.loading && !this.state.loadingMore && this.state.hasMore) {
                    this.loadMore();
                }
            }, { root: null, rootMargin: '100px', threshold: 0.1 });
            this.observer.observe(node);
        }
    }

    loadMore = () => {
        this.setState(prev => ({ page: prev.page + 1, loadingMore: true }), () => {
            this.generateFeed(true, this.state.page);
        });
    }

    setFilter = (key, value) => {
        // Toggle off if same value clicked again
        const current = this.state[key];
        this.setState({ [key]: current === value ? (key === 'typeFilter' ? 'all' : null) : value });
    }

    generateFeed = async (silent = false, page = 1) => {
        const isInitialLoad = page === 1;
        if (!silent && isInitialLoad) this.setState({ loading: true, error: null, page: 1, hasMore: true });
        if (!isInitialLoad) this.setState({ loadingMore: true });

        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${config.API_URL}/api/search/discover`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page, limit: 60 }
            });
            const recs = res.data;

            this.setState(prev => ({
                recommendations: isInitialLoad ? recs : [...prev.recommendations, ...recs],
                loading: false,
                loadingMore: false,
                hasMore: recs.length === 60,
                feedGeneratedAt: isInitialLoad ? Date.now() : prev.feedGeneratedAt
            }), () => {
                if (!silent && isInitialLoad && this.gridRef.current) {
                    gsap.fromTo(this.gridRef.current.children,
                        { opacity: 0, y: 30 },
                        { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, ease: "back.out(1.2)" }
                    );
                }
            });
        } catch (error) {
            console.error("Discovery engine failed:", error);
            this.setState({ loading: false, loadingMore: false, error: "Failed to generate your personalized feed." });
            this.props.showToast("Personalization engine encountered an error", "error");
        }
    }

    getFilteredRecs() {
        const { recommendations, typeFilter, genreFilter, languageFilter } = this.state;
        return recommendations.filter(m => {
            if (typeFilter === 'movie' && m.mediaType !== 'movie') return false;
            if (typeFilter === 'series' && m.mediaType !== 'series') return false;
            if (genreFilter && !(m.genreIds || []).includes(genreFilter)) return false;
            if (languageFilter && m.originalLanguage !== languageFilter) return false;
            return true;
        });
    }

    render() {
        const { loading, error, typeFilter, genreFilter, languageFilter } = this.state;
        const filtered = this.getFilteredRecs();
        const activeFilters = (typeFilter !== 'all' ? 1 : 0) + (genreFilter ? 1 : 0) + (languageFilter ? 1 : 0);

        return (
            <div className="collection-page discover-page">
                {/* Header */}
                <div className="page-header" ref={this.headerRef} style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                            <h2>Trending Now</h2>
                            <p className="page-subtitle" style={{ color: '#999', fontSize: '0.95rem' }}>
                                The most popular global movies and shows this week.
                            </p>
                        </div>
                        <button
                            className="primary-btn"
                            onClick={() => this.generateFeed(false)}
                            disabled={loading}
                            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spin' : ''}><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="discover-filter-bar">
                    {/* Type Filter */}
                    <div className="filter-group">
                        {['all', 'movie', 'series'].map(t => (
                            <button
                                key={t}
                                className={`filter-pill ${typeFilter === t ? 'active' : ''}`}
                                onClick={() => this.setState({ typeFilter: t })}
                            >
                                {t === 'all' ? '🎬 All' : t === 'movie' ? '🎥 Movies' : '📺 Shows'}
                            </button>
                        ))}
                    </div>

                    <div className="filter-divider" />

                    {/* Genre Filter */}
                    <div className="filter-group filter-scroll">
                        {GENRES.map(g => (
                            <button
                                key={g.id}
                                className={`filter-pill ${genreFilter === g.id ? 'active' : ''}`}
                                onClick={() => this.setFilter('genreFilter', g.id)}
                            >
                                {g.name}
                            </button>
                        ))}
                    </div>

                    <div className="filter-divider" />

                    {/* Language Filter */}
                    <div className="filter-group filter-scroll">
                        {LANGUAGES.map(l => (
                            <button
                                key={l.code}
                                className={`filter-pill ${languageFilter === l.code ? 'active' : ''}`}
                                onClick={() => this.setFilter('languageFilter', l.code)}
                            >
                                {l.name}
                            </button>
                        ))}
                    </div>

                    {activeFilters > 0 && (
                        <button
                            className="filter-clear"
                            onClick={() => this.setState({ typeFilter: 'all', genreFilter: null, languageFilter: null })}
                        >
                            ✕ Clear ({activeFilters})
                        </button>
                    )}
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="loading-state" style={{ height: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <div className="spinner" style={{ width: '50px', height: '50px', border: '3px solid rgba(255,165,0,0.1)', borderTopColor: '#f39c12', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <h3 style={{ marginTop: '20px', color: '#fff', letterSpacing: '0.5px' }}>Scanning the Globe...</h3>
                        <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '8px' }}>Fetching the hottest movies and TV shows.</p>
                    </div>
                )}

                {!loading && error && (
                    <div className="empty-state">
                        <div className="empty-icon">⚠️</div>
                        <h3>Algorithm Offline</h3>
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">🔍</div>
                        <h3>No results found</h3>
                        <p>Try adjusting your filters or refresh for new content.</p>
                    </div>
                )}

                {!loading && !error && filtered.length > 0 && (
                    <>
                        <div className="movie-grid discover-grid" ref={this.gridRef}>
                            {filtered.map(movie => (
                                <MovieCard
                                    key={`${movie.id}-${movie.mediaType}`}
                                    movie={{ ...movie, isExternal: true, imdbID: movie.imdbID || String(movie.id) }}
                                />
                            ))}
                        </div>

                        <div ref={this.handleObserver} style={{ height: '20px', margin: '20px 0' }}></div>

                        {this.state.loadingMore && (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                                <div style={{ width: '30px', height: '30px', border: '3px solid rgba(255,165,0,0.1)', borderTopColor: '#f39c12', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            </div>
                        )}
                        {!this.state.hasMore && (
                            <div style={{ textAlign: 'center', color: '#666', padding: '30px 0', fontSize: '0.9rem' }}>
                                You've seen it all! Check back later for more.
                            </div>
                        )}
                    </>
                )}

                <style>{`
                    .discover-grid {
                        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)) !important;
                        gap: 16px !important;
                    }
                    .discover-filter-bar {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-wrap: wrap;
                        margin-bottom: 24px;
                        padding: 14px 16px;
                        background: rgba(255,255,255,0.03);
                        border: 1px solid rgba(255,255,255,0.07);
                        border-radius: 16px;
                    }
                    .filter-group {
                        display: flex;
                        gap: 6px;
                        flex-wrap: wrap;
                    }
                    .filter-scroll {
                        flex-wrap: nowrap;
                        overflow-x: auto;
                        scrollbar-width: none;
                        max-width: 100%;
                    }
                    .filter-scroll::-webkit-scrollbar { display: none; }
                    .filter-divider {
                        width: 1px;
                        height: 24px;
                        background: rgba(255,255,255,0.1);
                        flex-shrink: 0;
                    }
                    .filter-pill {
                        padding: 5px 14px;
                        border-radius: 100px;
                        border: 1px solid rgba(255,255,255,0.1);
                        background: rgba(255,255,255,0.04);
                        color: rgba(255,255,255,0.6);
                        font-size: 0.8rem;
                        font-weight: 600;
                        cursor: pointer;
                        white-space: nowrap;
                        transition: all 0.2s ease;
                    }
                    .filter-pill:hover {
                        background: rgba(255,255,255,0.1);
                        color: white;
                        border-color: rgba(255,255,255,0.2);
                    }
                    .filter-pill.active {
                        background: var(--accent, #a855f7);
                        border-color: var(--accent, #a855f7);
                        color: white;
                        box-shadow: 0 0 12px rgba(168,85,247,0.3);
                    }
                    .filter-clear {
                        padding: 5px 12px;
                        border-radius: 100px;
                        border: 1px solid rgba(239,68,68,0.3);
                        background: rgba(239,68,68,0.1);
                        color: #ef4444;
                        font-size: 0.78rem;
                        font-weight: 700;
                        cursor: pointer;
                        white-space: nowrap;
                        transition: all 0.2s;
                        flex-shrink: 0;
                    }
                    .filter-clear:hover { background: rgba(239,68,68,0.2); }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    movies: state.movies.items || state.movies
});

const mapDispatchToProps = { fetchMovies, showToast };

export default connect(mapStateToProps, mapDispatchToProps)(DiscoverPage);
