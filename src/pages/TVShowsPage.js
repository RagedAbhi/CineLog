import React, { Component } from 'react';
import { connect } from 'react-redux';
import axios from 'axios';
import { fetchMovies, addMovie, deleteMovie, fetchRecommendations } from '../store/thunks';
import { setFilter, setSearch, clearFilters } from '../store/actions';
import MovieCard from '../components/MovieCard';
import AddMovieModal from '../components/AddMovieModal';
import CineSelect from '../components/CineSelect';
import Toast from '../components/Toast';

const GENRES = ['all', 'Action & Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Kids', 'Mystery', 'News', 'Reality', 'Sci-Fi & Fantasy', 'Soap', 'Talk', 'War & Politics', 'Western'];

class TVShowsPage extends Component {
    constructor(props) {
        super(props);
        this.state = { showAddModal: false, toast: null, statusFilter: 'all', dismissedIds: new Set() };
    }

    componentDidMount() {
        if (this.props.movies.length === 0) this.props.fetchMovies();
        this.props.fetchRecommendations();
        this.props.clearFilters();
    }

    handleAddShow = async (movieData) => {
        await this.props.addMovie(movieData);
        this.setState({ showAddModal: false, toast: { message: 'TV Show added!', type: 'success' } });
    }

    handleDismissRec = async (recId, e) => {
        if (e) e.stopPropagation();
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`http://localhost:5000/api/recommendations/${recId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            this.setState(prev => ({ 
                dismissedIds: new Set([...prev.dismissedIds, recId.toString()]),
                toast: { message: 'Recommendation dismissed', type: 'success' }
            }));
            this.props.fetchRecommendations();
        } catch (err) { 
            console.error('Error dismissing:', err);
            this.setState({ toast: { message: 'Failed to dismiss recommendation', type: 'error' } });
        }
    }

    getFiltered() {
        const { movies, filters } = this.props;
        const { statusFilter } = this.state;

        if (statusFilter === 'recommendations') {
            const { recommendations, filters } = this.props;
            const { sortOrder = 'latest' } = this.state; // Default to latest
            if (!recommendations) return [];
            
            let list = recommendations.filter(r => r.mediaType === 'series' && !this.state.dismissedIds.has(r._id?.toString()));
            
            // Apply Genre Filter
            if (filters.genre && filters.genre !== 'all') {
                list = list.filter(r => r.genre && r.genre.toLowerCase().includes(filters.genre.toLowerCase()));
            }
            
            // Apply Search Filter
            if (filters.search) {
                const q = filters.search.toLowerCase();
                list = list.filter(m => m.mediaTitle && m.mediaTitle.toLowerCase().includes(q));
            }

            // Apply Sort
            list = [...list].sort((a, b) => {
                const dateA = new Date(a.createdAt);
                const dateB = new Date(b.createdAt);
                return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
            });

            return list;
        }

        let list = movies.filter(m => m.mediaType === 'series');

        if (statusFilter !== 'all') {
            list = list.filter(m => m.status === statusFilter);
        }

        if (filters.search) {
            const q = filters.search.toLowerCase();
            list = list.filter(m => 
                m.title.toLowerCase().includes(q) || 
                (m.director && m.director.toLowerCase().includes(q)) ||
                (m.genre && m.genre.toLowerCase().includes(q))
            );
        }
        if (filters.genre && filters.genre !== 'all') {
            const q = filters.genre.toLowerCase();
            list = list.filter(m => m.genre && m.genre.toLowerCase().includes(q));
        }

        // --- UI Deduplication ---
        const seen = new Set();
        list = list.filter(m => {
            const key = (m.imdbID || m._id || m.title).toString().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // --- Sorting ---
        const { sortOrder = 'latest' } = this.state;
        list = [...list].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.addedOn || 0);
            const dateB = new Date(b.createdAt || b.addedOn || 0);
            return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
        });

        return list;
    }

    render() {
        const { loading, filters } = this.props;
        const { showAddModal, toast, statusFilter } = this.state;
        const filtered = this.getFiltered();

        return (
            <div className="container-fluid">
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2>TV Shows</h2>
                        <p>{filtered.length} show{filtered.length !== 1 ? 's' : ''} shown</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => this.setState({ showAddModal: true })}>+ Add TV Show</button>
                </div>

                <div className="filters-bar">
                    <input className="search-input" placeholder="Search TV shows…" value={filters.search} onChange={(e) => this.props.setSearch(e.target.value)} />

                    <div className="filter-toggle-group">
                        <button 
                            className={`filter-toggle-btn ${statusFilter === 'all' ? 'active' : ''}`}
                            onClick={() => this.setState({ statusFilter: 'all' })}
                        >
                            All
                        </button>
                        <button 
                            className={`filter-toggle-btn ${statusFilter === 'watchlist' ? 'active' : ''}`}
                            onClick={() => this.setState({ statusFilter: 'watchlist' })}
                        >
                            Watchlist
                        </button>
                        <button 
                            className={`filter-toggle-btn ${statusFilter === 'watched' ? 'active' : ''}`}
                            onClick={() => this.setState({ statusFilter: 'watched' })}
                        >
                            Watched
                        </button>
                        <button 
                            className={`filter-toggle-btn ${statusFilter === 'recommendations' ? 'active' : ''}`}
                            onClick={() => this.setState({ statusFilter: 'recommendations' })}
                        >
                            Recommendations
                        </button>
                    </div>

                    <div style={{ width: '180px' }}>
                        <CineSelect
                            options={GENRES.map(g => ({ value: g, label: g === 'all' ? 'All Genres' : g }))}
                            value={filters.genre}
                            onChange={(val) => this.props.setFilter('genre', val)}
                            placeholder="Genre"
                        />
                    </div>

                    <div className="filter-toggle-group">
                        <button 
                            className={`filter-toggle-btn ${this.state.sortOrder !== 'oldest' ? 'active' : ''}`}
                            onClick={() => this.setState({ sortOrder: 'latest' })}
                        >
                            Latest
                        </button>
                        <button 
                            className={`filter-toggle-btn ${this.state.sortOrder === 'oldest' ? 'active' : ''}`}
                            onClick={() => this.setState({ sortOrder: 'oldest' })}
                        >
                            Oldest
                        </button>
                    </div>

                    {(filters.search || filters.genre !== 'all') && (
                        <button className="btn-clear" onClick={this.props.clearFilters}>Clear filters</button>
                    )}
                </div>

                {loading && this.props.movies.length === 0 ? (
                    <div className="loading-spinner"><div className="spinner" /><span>Loading shows...</span></div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📺</div>
                        <h3>No TV shows found</h3>
                        <p>Add some TV shows to get started!</p>
                    </div>
                ) : statusFilter === 'recommendations' ? (
                    <div className="movie-grid">
                        {filtered.map(rec => (
                            <div key={rec._id} style={{ position: 'relative' }}>
                                <MovieCard movie={{
                                    _id: rec.imdbID,
                                    title: rec.mediaTitle,
                                    poster: rec.poster,
                                    imdbID: rec.imdbID,
                                    mediaType: rec.mediaType,
                                    isExternal: true
                                }} />
                                <button
                                    onClick={(e) => this.handleDismissRec(rec._id, e)}
                                    title="Remove recommendation"
                                    style={{
                                        position: 'absolute', top: '-8px', left: '-8px',
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        background: 'rgba(20,20,30,0.85)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        backdropFilter: 'blur(10px)',
                                        color: 'rgba(255,255,255,0.7)',
                                        fontSize: '13px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        zIndex: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background='rgba(255,59,48,0.85)'; e.currentTarget.style.color='white'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background='rgba(20,20,30,0.85)'; e.currentTarget.style.color='rgba(255,255,255,0.7)'; }}
                                >✕</button>
                                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                    From @{rec.sender?.username || 'friend'}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="movie-grid">
                        {filtered.map(show => <MovieCard key={show._id} movie={show} />)}
                    </div>
                )}

                {showAddModal && <AddMovieModal onSubmit={this.handleAddShow} onClose={() => this.setState({ showAddModal: false })} defaultType="series" />}
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => this.setState({ toast: null })} />}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ 
    movies: state.movies.items, 
    loading: state.movies.loading, 
    filters: state.filters, 
    recommendations: state.auth.recommendations 
});
const mapDispatchToProps = { fetchMovies, addMovie, deleteMovie, setFilter, setSearch, clearFilters, fetchRecommendations };
export default connect(mapStateToProps, mapDispatchToProps)(TVShowsPage);
