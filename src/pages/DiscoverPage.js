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
            <div className="container-fluid">
                {/* Header — matches page-header pattern used in Movies/TV pages */}
                <div className="page-header" ref={this.headerRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2>Trending Now</h2>
                        <p>The most popular global movies and shows this week.</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => this.generateFeed(false)}
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spin' : ''}><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                        Refresh
                    </button>
                </div>

                {/* Filter Bar — uses the shared filters-bar class for consistent spacing */}
                <div className="filters-bar discover-filters">
                    {/* Segmented Type Control */}
                    <div className="filter-segment">
                        {[{v:'all',l:'All'},{v:'movie',l:'Movies'},{v:'series',l:'Shows'}].map(t => (
                            <button
                                key={t.v}
                                className={`segment-btn ${typeFilter === t.v ? 'active' : ''}`}
                                onClick={() => this.setState({ typeFilter: t.v })}
                            >{t.l}</button>
                        ))}
                    </div>

                    {/* Genre Dropdown */}
                    <select
                        className="filter-select"
                        value={genreFilter || ''}
                        onChange={e => this.setState({ genreFilter: e.target.value ? parseInt(e.target.value) : null })}
                    >
                        <option value="">Genre</option>
                        {GENRES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>

                    {/* Language Dropdown */}
                    <select
                        className="filter-select"
                        value={languageFilter || ''}
                        onChange={e => this.setState({ languageFilter: e.target.value || null })}
                    >
                        <option value="">Language</option>
                        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>

                    {activeFilters > 0 && (
                        <button
                            className="btn-clear"
                            onClick={() => this.setState({ typeFilter: 'all', genreFilter: null, languageFilter: null })}
                        >Clear filters</button>
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
                    .discover-filters {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .filter-segment {
                        display: flex;
                        background: rgba(255,255,255,0.05);
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 10px;
                        padding: 3px;
                        gap: 2px;
                        flex-shrink: 0;
                    }
                    .segment-btn {
                        padding: 5px 14px;
                        border-radius: 7px;
                        border: none;
                        background: transparent;
                        color: rgba(255,255,255,0.45);
                        font-size: 0.82rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.18s ease;
                        white-space: nowrap;
                    }
                    .segment-btn:hover { color: rgba(255,255,255,0.8); }
                    .segment-btn.active {
                        background: rgba(255,255,255,0.1);
                        color: #fff;
                    }
                    .filter-select {
                        appearance: none;
                        -webkit-appearance: none;
                        background: rgba(255,255,255,0.05) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center;
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 10px;
                        color: rgba(255,255,255,0.7);
                        font-size: 0.82rem;
                        font-weight: 600;
                        padding: 6px 30px 6px 12px;
                        cursor: pointer;
                        transition: border-color 0.18s, color 0.18s;
                        min-width: 110px;
                        outline: none;
                    }
                    .filter-select:hover, .filter-select:focus {
                        border-color: rgba(255,255,255,0.2);
                        color: #fff;
                    }
                    .filter-select option {
                        background: #1a1a2e;
                        color: #fff;
                    }
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
