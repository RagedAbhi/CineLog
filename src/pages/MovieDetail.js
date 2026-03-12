import { Component } from 'react';
import { connect } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchMovies, updateMovie, deleteMovie, markAsWatched } from '../store/thunks';
import MarkWatchedModal from '../components/MarkWatchedModal';
import Toast from '../components/Toast';
import { fetchStreamingAvailability } from '../services/tmdbService';

function MovieDetailWrapper(props) {
  const navigate = useNavigate();
  const { id } = useParams();
  return <MovieDetail {...props} navigate={navigate} movieId={parseInt(id)} />;
}

class MovieDetail extends Component {
  constructor(props) {
    super(props);
    this.state = {
      editing: false,
      showMarkWatched: false,
      toast: null,
      editForm: {}
    };
  }

  async componentDidMount() {
    if (this.props.movies.length === 0) {
      await this.props.fetchMovies();
    }
    this.fetchStreamingInfo();
  }

  async componentDidUpdate(prevProps) {
    if (prevProps.movies.length === 0 && this.props.movies.length > 0) {
      this.fetchStreamingInfo();
    }
  }

  fetchStreamingInfo = async () => {
    const movie = this.getMovie();
    if (movie && movie.title) {
      const res = await fetchStreamingAvailability(movie.title, movie.mediaType || 'movie', movie.year);
      if (res && res.error) {
        this.setState({ ottError: res.error });
      } else if (res) {
        this.setState({ streamingProviders: res, ottError: null });
      }
    }
  }

  renderOTTSection() {
    const { streamingProviders, ottError } = this.state;

    if (ottError === 'NO_API_KEY' || ottError === 'INVALID_API_KEY') {
      return (
        <div className="detail-ott-section tmdb-setup-guide">
          <div className="setup-card">
            <div className="setup-icon">ℹ️</div>
            <div className="setup-content">
              <h4>OTT Links Disabled</h4>
              <p>Please add a valid <strong>TMDB API Key</strong> to your <code>.env</code> file to see where to watch this movie.</p>
              <div className="setup-steps">
                <span>1. Get key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">TheMovieDB.org</a></span>
                <span>2. Open <code>.env</code> and set <code>REACT_APP_TMDB_API_KEY</code></span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!streamingProviders || streamingProviders.length === 0) return null;

    return (
      <div className="detail-ott-section">
        <div className="detail-label">Available on OTT (India):</div>
        <div className="detail-platforms">
          {streamingProviders.map(p => (
            <a
              key={p.name}
              href={p.link}
              target="_blank"
              rel="noreferrer"
              className="detail-ott-link"
              title={`Watch on ${p.name}`}
            >
              <img src={p.logo} alt={p.name} className="detail-ott-logo" />
              <span>{p.name}</span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  getMovie() {
    return this.props.movies.find(m => m.id === this.props.movieId);
  }

  showToast = (message, type = 'success') => {
    this.setState({ toast: { message, type } });
  }

  startEditing = () => {
    const movie = this.getMovie();
    this.setState({
      editing: true,
      editForm: {
        title: movie.title,
        genre: movie.genre,
        director: movie.director || '',
        year: movie.year,
        rating: movie.rating || '',
        review: movie.review || '',
        priority: movie.priority,
        poster: movie.poster || ''
      }
    });
  }

  handleEditChange = (e) => {
    const { name, value } = e.target;
    this.setState(prev => ({ editForm: { ...prev.editForm, [name]: value } }));
  }

  handleEditSave = async () => {
    const movie = this.getMovie();
    const { editForm } = this.state;
    await this.props.updateMovie(movie.id, {
      ...editForm,
      year: parseInt(editForm.year),
      rating: editForm.rating ? parseInt(editForm.rating) : movie.rating
    });
    this.setState({ editing: false });
    this.showToast('Changes saved!');
  }

  handleMarkWatched = async (watchData) => {
    const movie = this.getMovie();
    await this.props.markAsWatched(movie.id, watchData);
    this.setState({ showMarkWatched: false });
    this.showToast('Marked as watched! 🎬');
  }

  handleDelete = async () => {
    if (!window.confirm('Remove this movie from your list?')) return;
    const movie = this.getMovie();
    await this.props.deleteMovie(movie.id);
    this.props.navigate(-1);
  }

  renderStars(rating) {
    const filled = Math.round(rating / 2);
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < filled ? 'var(--accent)' : 'var(--border)' }}>★</span>
    ));
  }

  render() {
    const { navigate, loading } = this.props;
    const { editing, editForm, showMarkWatched, toast } = this.state;
    const movie = this.getMovie();

    if (loading && !movie) {
      return (
        <div className="loading-spinner">
          <div className="spinner" />
          <span>Loading...</span>
        </div>
      );
    }

    if (!movie) {
      return (
        <div className="empty-state">
          <div className="empty-icon">🎬</div>
          <h3>Movie not found</h3>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: 16 }}>Go Back</button>
        </div>
      );
    }

    return (
      <div>
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>

        {!editing ? (
          <div className="detail-layout">
            {/* Poster */}
            <div>
              <div className="detail-poster">
                {movie.poster
                  ? <img src={movie.poster} alt={movie.title} onError={(e) => e.target.style.display = 'none'} />
                  : <div className="detail-poster-placeholder">🎬</div>
                }
              </div>
            </div>

            {/* Info */}
            <div className="detail-info">
              <div className="detail-genre-year">{movie.genre} · {movie.year}</div>
              <h1 className="detail-title">{movie.title}</h1>
              {movie.director && <div className="detail-director">Directed by {movie.director}</div>}

              {movie.status === 'watched' && movie.rating && (
                <div className="detail-rating-display">
                  <div className="rating-big">{movie.rating}</div>
                  <div>
                    <div className="rating-stars">{this.renderStars(movie.rating)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>out of 10</div>
                  </div>
                </div>
              )}

              {movie.review && (
                <div className="detail-review">"{movie.review}"</div>
              )}

              <div className="detail-meta-grid">
                <div className="detail-meta-item">
                  <div className="label">Status</div>
                  <div className="value" style={{ color: movie.status === 'watched' ? 'var(--green)' : 'var(--accent)' }}>
                    {movie.status === 'watched' ? '✓ Watched' : '◎ In Watchlist'}
                  </div>
                </div>
                <div className="detail-meta-item">
                  <div className="label">Priority</div>
                  <div className="value">
                    <span className={`priority-badge priority-${movie.priority}`} style={{ position: 'static', display: 'inline-block' }}>
                      {movie.priority}
                    </span>
                  </div>
                </div>
                {movie.watchedOn && (
                  <div className="detail-meta-item">
                    <div className="label">Watched On</div>
                    <div className="value">{movie.watchedOn}</div>
                  </div>
                )}
                <div className="detail-meta-item">
                  <div className="label">Added On</div>
                  <div className="value">{movie.addedOn}</div>
                </div>
              </div>

              {this.renderOTTSection()}

              <div className="detail-actions">
                {movie.status === 'watchlist' && (
                  <button className="btn btn-primary" onClick={() => this.setState({ showMarkWatched: true })}>
                    ✓ Mark as Watched
                  </button>
                )}
                <button className="btn btn-secondary" onClick={this.startEditing}>
                  ✎ Edit
                </button>
                <button className="btn btn-danger" onClick={this.handleDelete}>
                  ✕ Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Edit Form */
          <div>
            <div className="page-header">
              <h2>Edit Movie</h2>
            </div>
            <div style={{ maxWidth: 600 }}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" name="title" value={editForm.title} onChange={this.handleEditChange} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Genre</label>
                  <input className="form-input" name="genre" value={editForm.genre} onChange={this.handleEditChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input className="form-input" type="number" name="year" value={editForm.year} onChange={this.handleEditChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Director</label>
                  <input className="form-input" name="director" value={editForm.director} onChange={this.handleEditChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-input" name="priority" value={editForm.priority} onChange={this.handleEditChange}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              {movie.status === 'watched' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Rating (1-10)</label>
                    <input className="form-input" type="number" name="rating" min="1" max="10" value={editForm.rating} onChange={this.handleEditChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Review</label>
                    <textarea className="form-input" name="review" value={editForm.review} onChange={this.handleEditChange} />
                  </div>
                </>
              )}
              <div className="form-group">
                <label className="form-label">Poster URL</label>
                <input className="form-input" name="poster" value={editForm.poster} onChange={this.handleEditChange} />
              </div>
              <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                <button className="btn btn-primary" onClick={this.handleEditSave}>Save Changes</button>
                <button className="btn btn-secondary" onClick={() => this.setState({ editing: false })}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showMarkWatched && (
          <MarkWatchedModal
            movie={movie}
            onSubmit={this.handleMarkWatched}
            onClose={() => this.setState({ showMarkWatched: false })}
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
  loading: state.movies.loading
});

const mapDispatchToProps = { fetchMovies, updateMovie, deleteMovie, markAsWatched };

export default connect(mapStateToProps, mapDispatchToProps)(MovieDetailWrapper);
