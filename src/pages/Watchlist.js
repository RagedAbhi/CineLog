import { Component } from 'react';
import { connect } from 'react-redux';
import { fetchMovies, addMovie, deleteMovie } from '../store/thunks';
import { setFilter, setSearch, clearFilters } from '../store/actions';
import MovieCard from '../components/MovieCard';
import AddMovieModal from '../components/AddMovieModal';
import Toast from '../components/Toast';

const GENRES = ['all', 'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction', 'TV Movie', 'Thriller', 'War', 'Western'];

class Watchlist extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showAddModal: false,
      toast: null,
      sortOrder: 'latest'
    };
  }

  componentDidMount() {
    if (this.props.movies.length === 0) {
      this.props.fetchMovies();
    }
    // Reset filters when entering this page
    this.props.clearFilters();
  }

  showToast = (message, type = 'success') => {
    this.setState({ toast: { message, type } });
  }

  handleAddMovie = async (movieData) => {
    await this.props.addMovie({ ...movieData, status: 'watchlist' });
    this.setState({ showAddModal: false });
    this.showToast('Added to watchlist!');
  }

  getFilteredMovies() {
    const { movies, filters } = this.props;
    let list = movies.filter(m => m.status === 'watchlist');

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

    if (filters.mediaType !== 'all') {
      list = list.filter(m => m.mediaType === filters.mediaType);
    }

    const { sortOrder = 'latest' } = this.state;
    list = list.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
    });

    // --- UI Deduplication ---
    const seen = new Set();
    list = list.filter(m => {
        // Use a more robust key than just _id to catch true duplicates
        const titleKey = `${m.title?.toLowerCase().trim()}|${m.mediaType || 'movie'}|${m.year || ''}`;
        const key = m.imdbID || titleKey;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return list;
  }

  render() {
    const { loading, filters } = this.props;
    const { showAddModal, toast } = this.state;
    const filtered = this.getFilteredMovies();

    return (
      <div className="container-fluid">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Watchlist</h2>
            <p>{filtered.length} film{filtered.length !== 1 ? 's' : ''} to watch</p>
          </div>
          <button className="btn btn-primary" onClick={() => this.setState({ showAddModal: true })}>
            + Add Movie
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

          {(filters.search || filters.genre !== 'all' || filters.mediaType !== 'all') && (
            <button className="btn-clear" onClick={this.props.clearFilters}>Clear filters</button>
          )}
        </div>

        {/* Media Tabs */}
        <div className="analytics-controls" style={{ marginTop: 20 }}>
            <div className="analytics-media-tabs">
                {['all', 'movie', 'series'].map(type => (
                <button 
                    key={type}
                    className={`media-tab ${filters.mediaType === type ? 'active' : ''}`}
                    onClick={() => this.props.setFilter('mediaType', type)}
                >
                    {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
                </button>
                ))}
            </div>
        </div>

        {loading && this.props.movies.length === 0 ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading watchlist...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◎</div>
            <h3>No films found</h3>
            <p>Try adjusting your filters or add a new film</p>
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
  deleteMovie,
  setFilter,
  setSearch,
  clearFilters
};

export default connect(mapStateToProps, mapDispatchToProps)(Watchlist);
