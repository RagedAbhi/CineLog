import { Component } from 'react';
import { connect } from 'react-redux';
import { fetchMovies, addMovie, deleteMovie, fetchRecommendations } from '../store/thunks';
import { setFilter, setSearch, clearFilters, showToast, showConfirmModal } from '../store/actions';
import MovieCard from '../components/MovieCard';
import AddMovieModal from '../components/AddMovieModal';
import CineSelect from '../components/CineSelect';

const GENRES = ['all', 'Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller', 'Horror', 'Romance', 'Animation', 'Documentary', 'Fantasy', 'Crime', 'Mystery', 'Adventure'];

class MoviesPage extends Component {
    constructor(props) {
        super(props);
        this.state = { showAddModal: false, statusFilter: 'all' };
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

    getFiltered() {
        const { movies, filters, user } = this.props;
        const { statusFilter } = this.state;

        if (statusFilter === 'recommendations') {
            const { recommendations } = this.props;
            if (!recommendations) return [];
            let list = recommendations.filter(r => !r.mediaType || r.mediaType === 'movie');
            if (filters.search) {
                const q = filters.search.toLowerCase();
                list = list.filter(m => m.mediaTitle && m.mediaTitle.toLowerCase().includes(q));
            }
            return list.map(rec => ({
                _id: rec.imdbID,
                title: rec.mediaTitle,
                poster: rec.poster,
                imdbID: rec.imdbID,
                mediaType: rec.mediaType || 'movie',
                isExternal: true,
                isRecommendation: true
            }));
        }

        let list = movies.filter(m => m.mediaType === 'movie' || !m.mediaType);

        if (statusFilter !== 'all') {
            list = list.filter(m => m.status === statusFilter);
        }

        if (filters.search) {
            const q = filters.search.toLowerCase();
            list = list.filter(m => m.title.toLowerCase().includes(q) || (m.director && m.director.toLowerCase().includes(q)));
        }
        if (filters.genre !== 'all') list = list.filter(m => m.genre === filters.genre);
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
