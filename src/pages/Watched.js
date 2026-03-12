import { Component } from 'react';
import { connect } from 'react-redux';
import { fetchMovies, addMovie } from '../store/thunks';
import { setFilter, setSearch, clearFilters } from '../store/actions';
import MovieCard from '../components/MovieCard';
import AddMovieModal from '../components/AddMovieModal';
import Toast from '../components/Toast';

const GENRES = ['all', 'Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller', 'Horror', 'Romance', 'Animation', 'Documentary', 'Fantasy'];

class Watched extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showAddModal: false,
      toast: null,
      sortBy: 'watchedOn'
    };
  }

  componentDidMount() {
    if (this.props.movies.length === 0) {
      this.props.fetchMovies();
    }
    this.props.clearFilters();
  }

  showToast = (message, type = 'success') => {
    this.setState({ toast: { message, type } });
  }

  handleAddMovie = async (movieData) => {
    await this.props.addMovie(movieData);
    this.setState({ showAddModal: false });
    this.showToast('Movie logged!');
  }

  getFilteredMovies() {
    const { movies, filters } = this.props;
    const { sortBy } = this.state;
    let list = movies.filter(m => m.status === 'watched');

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        (m.director && m.director.toLowerCase().includes(q))
      );
    }

    if (filters.genre !== 'all') {
      list = list.filter(m => m.genre === filters.genre);
    }

    if (filters.rating !== 'all') {
      const minRating = parseInt(filters.rating);
      list = list.filter(m => m.rating && m.rating >= minRating);
    }

    // Sort
    if (sortBy === 'watchedOn') {
      list = list.sort((a, b) => new Date(b.watchedOn || 0) - new Date(a.watchedOn || 0));
    } else if (sortBy === 'rating') {
      list = list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'title') {
      list = list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }

  render() {
    const { loading, filters } = this.props;
    const { showAddModal, toast, sortBy } = this.state;
    const filtered = this.getFilteredMovies();

    return (
      <div>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Watched</h2>
            <p>{filtered.length} film{filtered.length !== 1 ? 's' : ''} logged</p>
          </div>
          <button className="btn btn-primary" onClick={() => this.setState({ showAddModal: true })}>
            + Log Movie
          </button>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <input
            className="search-input"
            placeholder="Search by title or director..."
            value={filters.search}
            onChange={(e) => this.props.setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={filters.genre}
            onChange={(e) => this.props.setFilter('genre', e.target.value)}
          >
            {GENRES.map(g => (
              <option key={g} value={g}>{g === 'all' ? 'All Genres' : g}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={filters.rating}
            onChange={(e) => this.props.setFilter('rating', e.target.value)}
          >
            <option value="all">All Ratings</option>
            <option value="9">9+ (Masterpiece)</option>
            <option value="7">7+ (Great)</option>
            <option value="5">5+ (Good)</option>
          </select>
          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => this.setState({ sortBy: e.target.value })}
          >
            <option value="watchedOn">Sort: Recently Watched</option>
            <option value="rating">Sort: Highest Rated</option>
            <option value="title">Sort: Title A-Z</option>
          </select>
          {(filters.search || filters.genre !== 'all' || filters.rating !== 'all') && (
            <button className="btn-clear" onClick={this.props.clearFilters}>Clear filters</button>
          )}
        </div>

        {loading && this.props.movies.length === 0 ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading films...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✦</div>
            <h3>No films found</h3>
            <p>Log your first watched film!</p>
          </div>
        ) : (
          <div className="movie-grid">
            {filtered.map(movie => (
              <MovieCard key={movie._id} movie={movie} />
            ))}
          </div>
        )}

        {showAddModal && (
          <AddMovieModal
            onSubmit={this.handleAddMovie}
            onClose={() => this.setState({ showAddModal: false })}
          />
        )}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => this.setState({ toast: null })}
          />
        )}
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  movies: state.movies.items,
  loading: state.movies.loading,
  filters: state.filters
});

const mapDispatchToProps = {
  fetchMovies,
  addMovie,
  setFilter,
  setSearch,
  clearFilters
};

export default connect(mapStateToProps, mapDispatchToProps)(Watched);
