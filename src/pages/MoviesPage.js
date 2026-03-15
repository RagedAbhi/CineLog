import { Component } from 'react';
import { connect } from 'react-redux';
import { fetchMovies, addMovie, deleteMovie } from '../store/thunks';
import { setFilter, setSearch, clearFilters } from '../store/actions';
import MovieCard from '../components/MovieCard';
import AddMovieModal from '../components/AddMovieModal';
import Toast from '../components/Toast';

const GENRES = ['all', 'Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller', 'Horror', 'Romance', 'Animation', 'Documentary', 'Fantasy', 'Crime', 'Mystery', 'Adventure'];

class MoviesPage extends Component {
    constructor(props) {
        super(props);
        this.state = { showAddModal: false, toast: null, statusFilter: 'all' };
    }

    componentDidMount() {
        if (this.props.movies.length === 0) this.props.fetchMovies();
        this.props.clearFilters();
    }

    handleAddMovie = async (movieData) => {
        await this.props.addMovie(movieData);
        this.setState({ showAddModal: false, toast: { message: 'Movie added!', type: 'success' } });
    }

    getFiltered() {
        const { movies, filters } = this.props;
        const { statusFilter } = this.state;
        let list = movies.filter(m => !m.mediaType || m.mediaType === 'movie');

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

                    <select className="filter-select" value={statusFilter} onChange={(e) => this.setState({ statusFilter: e.target.value })}>
                        <option value="all">All Status</option>
                        <option value="watchlist">Watchlist</option>
                        <option value="watched">Watched</option>
                    </select>

                    <select className="filter-select" value={filters.genre} onChange={(e) => this.props.setFilter('genre', e.target.value)}>
                        {GENRES.map(g => <option key={g} value={g}>{g === 'all' ? 'All Genres' : g}</option>)}
                    </select>
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
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => this.setState({ toast: null })} />}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ movies: state.movies.items, loading: state.movies.loading, filters: state.filters });
const mapDispatchToProps = { fetchMovies, addMovie, deleteMovie, setFilter, setSearch, clearFilters };
export default connect(mapStateToProps, mapDispatchToProps)(MoviesPage);
