import React, { Component } from 'react';
import { connect } from 'react-redux';
import axios from 'axios';
import { fetchMovies, addMovie, deleteMovie, fetchRecommendations } from '../store/thunks';
import { setFilter, setSearch, clearFilters, showToast, showConfirmModal } from '../store/actions';
import MovieCard from '../components/MovieCard';
import AddMovieModal from '../components/AddMovieModal';
import CineSelect from '../components/CineSelect';

const GENRES = ['all', 'Action', 'Adventure', 'Comedy', 'Drama', 'Sci-Fi', 'Science Fiction', 'Thriller', 'Horror', 'Romance', 'Animation', 'Documentary', 'Fantasy', 'Crime', 'Mystery'];

class MoviesPage extends Component {
    constructor(props) {
        super(props);
        this.state = { showAddModal: false, statusFilter: 'all', dismissedIds: new Set() };
    }

    componentDidMount() {
        if (this.props.movies.length === 0) this.props.fetchMovies();
        this.props.fetchRecommendations();
        this.props.clearFilters();
    }

    handleAddMovie = async (movieData) => {
        await this.props.addMovie(movieData);
        this.setState({ showAddModal: false });
        this.props.showToast('Movie added!', 'success');
    }

    handleDismissRec = async (recId, e) => {
        if (e) e.stopPropagation();
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`http://localhost:5000/api/recommendations/${recId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            this.setState(prev => ({ dismissedIds: new Set([...prev.dismissedIds, recId.toString()]) }));
            this.props.fetchRecommendations();
            this.props.showToast('Recommendation dismissed', 'success');
        } catch (err) { 
            console.error('Error dismissing:', err);
            this.props.showToast('Failed to dismiss recommendation', 'error');
        }
    }

    getFiltered() {
        const { movies, filters, user } = this.props;
        const { statusFilter } = this.state;

        if (statusFilter === 'recommendations') {
            const { recommendations, filters } = this.props;
            const { sortOrder = 'latest' } = this.state; // Default to latest
            if (!recommendations) return [];
            
            let list = recommendations.filter(r => r.mediaType === 'movie' && !this.state.dismissedIds.has(r._id?.toString()));
            
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

        let list = movies.filter(m => m.mediaType === 'movie' || !m.mediaType);

        if (statusFilter !== 'all') {
            list = list.filter(m => m.status === statusFilter);
        }

        if (filters.search) {
            const q = filters.search.toLowerCase();
            list = list.filter(m => m.title.toLowerCase().includes(q) || (m.director && m.director.toLowerCase().includes(q)));
        }
        if (filters.genre !== 'all') {
            list = list.filter(m => m.genre && m.genre.toLowerCase().includes(filters.genre.toLowerCase()));
        }
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
                        <h2>Movies</h2>
                        <p>{filtered.length} movie{filtered.length !== 1 ? 's' : ''} shown</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => this.setState({ showAddModal: true })}>+ Add Movie</button>
                </div>

                <div className="filters-bar">
                    <input className="search-input" placeholder="Search movies…" value={filters.search} onChange={(e) => this.props.setSearch(e.target.value)} />

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
                    <div className="loading-spinner"><div className="spinner" /><span>Loading movies...</span></div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🎬</div>
                        <h3>No movies found</h3>
                        <p>Add some movies to get started!</p>
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
                        {filtered.map(movie => <MovieCard key={movie._id} movie={movie} />)}
                    </div>
                )}

                {showAddModal && <AddMovieModal onSubmit={this.handleAddMovie} onClose={() => this.setState({ showAddModal: false })} defaultType="movie" />}
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
const mapDispatchToProps = { fetchMovies, addMovie, deleteMovie, setFilter, setSearch, clearFilters, fetchRecommendations, showToast, showConfirmModal };
export default connect(mapStateToProps, mapDispatchToProps)(MoviesPage);
