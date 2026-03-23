import { Component } from 'react';
import { connect } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { fetchMovies, updateMovie, deleteMovie, markAsWatched, addMovie } from '../store/thunks';
import MarkWatchedModal from '../components/MarkWatchedModal';
import AddMovieModal from '../components/AddMovieModal';
import Toast from '../components/Toast';
import { fetchStreamingAvailability } from '../services/tmdbService';
import { getMovieDetailsExternal } from '../services/movieService';
import RecommendModal from '../components/RecommendModal';
import axios from 'axios';
import gsap from 'gsap';

function MovieDetailWrapper(props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isExternal = new URLSearchParams(location.search).get('external') === 'true';
  return <MovieDetail {...props} navigate={navigate} movieId={id} isExternal={isExternal} />;
}

class MovieDetail extends Component {
  constructor(props) {
    super(props);
    this.state = {
      editing: false,
      showMarkWatched: false,
      showRecommend: false,
      toast: null,
      editForm: {},
      externalMovie: null,
      localLoading: false
    };
  }

  async componentDidMount() {
    console.log('DEBUG: MovieDetail Mount. ID:', this.props.movieId);
    if (this.props.movies.length === 0) {
      console.log('DEBUG: Movies empty, fetching library...');
      await this.props.fetchMovies();
    }
    
    this.loadInitialData();
  }

  loadInitialData = () => {
    const movie = this.getMovie();
    console.log('DEBUG: Initial getMovie check:', movie ? movie.title : 'NULL');
    if (movie && (!this.props.isExternal || movie.status)) {
      this.fetchStreamingInfo();
      this.initAnimations();
    } else if (this.props.isExternal) {
        this.fetchExternalMovie();
    } else {
        this.fetchMovieDirectly();
    }
  }

  fetchExternalMovie = async () => {
    this.setState({ localLoading: true });
    try {
        const details = await getMovieDetailsExternal(this.props.movieId);
        this.setState({ 
            externalMovie: { ...details, isExternalRec: true, imdbID: this.props.movieId }, 
            localLoading: false 
        }, () => {
            this.fetchStreamingInfo();
            this.initAnimations();
        });
    } catch (err) {
        console.error('External fetch failed:', err);
        this.setState({ localLoading: false });
    }
  }

  fetchMovieDirectly = async () => {
    console.log('DEBUG: fetchMovieDirectly for', this.props.movieId);
    this.setState({ localLoading: true });
    try {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`http://localhost:5000/api/media/${this.props.movieId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data) {
                console.log('DEBUG: Found in library via direct API');
                this.setState({ externalMovie: { ...res.data, isExternalRec: false }, localLoading: false }, () => {
                    this.fetchStreamingInfo();
                    this.initAnimations();
                });
                return;
            }
        } catch (mediaErr) {
            console.log('DEBUG: Not in library (404 expected)', mediaErr.response?.status);
            this.fetchRecommendationFallback();
        }
    } catch (err) {
        console.error('DEBUG: Direct fetch failed:', err);
        this.setState({ localLoading: false });
    }
  }

  async componentDidUpdate(prevProps) {
    if (prevProps.movies.length === 0 && this.props.movies.length > 0) {
      console.log('DEBUG: Movies loaded into Redux, re-checking getMovie');
      this.loadInitialData();
    }
    if (prevProps.movieId !== this.props.movieId) {
      console.log('DEBUG: movieId changed, reloading...');
      this.loadInitialData();
    }
  }

  fetchRecommendationFallback = async () => {
    console.log('DEBUG: fetchRecommendationFallback for', this.props.movieId);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/recommendations/${this.props.movieId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const rec = res.data;
      console.log('DEBUG: Found as recommendation:', rec.mediaTitle);
      const movieData = {
        _id: rec._id,
        title: rec.mediaTitle,
        mediaType: rec.mediaType,
        poster: rec.poster,
        imdbID: rec.imdbID,
        isExternalRec: true,
        sender: rec.sender
      };
      this.setState({ externalMovie: movieData, localLoading: false }, () => {
        this.fetchStreamingInfo();
        this.initAnimations();
      });
    } catch (err) {
      console.error('DEBUG: Recommendation lookup failed:', err.response?.status);
      this.setState({ localLoading: false });
    }
  }

  initAnimations = () => {
    gsap.fromTo(".detail-tags-premium, .detail-title-premium, .detail-director-premium",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: "power3.out" }
    );

    gsap.to(".reveal", {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.1,
      ease: "power3.out",
      delay: 0.2
    });

    gsap.fromTo(".detail-backdrop-img",
      { opacity: 0, scale: 1.1 },
      { opacity: 1, scale: 1, duration: 2, ease: "power2.out" }
    );
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
    if (!this.props.movies || !this.props.movieId) return this.state.externalMovie;
    const movie = this.props.movies.find(m => 
        (m._id && m._id.toString() === this.props.movieId.toString())
    );
    return movie || this.state.externalMovie;
  }

  handleToggleTopPick = async () => {
    const movie = this.getMovie();
    try {
      const token = localStorage.getItem('token');
      const response = await axios.patch(`http://localhost:5000/api/users/profile/top-picks`, {
        mediaId: movie._id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      this.showToast(movie.isTopPick ? 'Removed from Top Picks' : 'Added to Top Picks!');
      this.props.fetchMovies(); // Refresh to get updated isTopPick status if we had it in the model, 
      // but actually User model stores the array. Let's assume we need to refresh or update local state.
      // Better: The media model itself could have as reference or we just refresh the profile later.
    } catch (error) {
      console.error('Error toggling top pick:', error);
    }
  }

  handleRecommend = () => {
    this.setState({ showRecommend: false });
    this.showToast('Recommendation sent! 🚀');
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
    await this.props.updateMovie(movie._id, {
      ...editForm,
      year: parseInt(editForm.year),
      rating: editForm.rating ? parseInt(editForm.rating) : movie.rating
    });
    this.setState({ editing: false });
    this.showToast('Changes saved!');
  }

  handleMarkWatched = async (watchData) => {
    const movie = this.getMovie();
    if (movie.isExternalRec) {
      // It's not in our library yet, so we use addMovie thunk
      const movieToSave = {
        title: movie.title,
        year: movie.year,
        genre: movie.genre,
        director: movie.director,
        poster: movie.poster,
        imdbID: movie.imdbID,
        mediaType: movie.mediaType || 'movie',
        status: 'watched',
        ...watchData
      };
      await this.props.addMovie(movieToSave);
      // After adding, we should probably stay on the page but it might change ID
      // The thunk handles refreshing the library.
    } else {
      await this.props.markAsWatched(movie._id, watchData);
    }
    this.setState({ showMarkWatched: false });
    this.showToast('Marked as watched! 🎬');
  }

  handleDelete = async () => {
    if (!window.confirm('Remove this movie from your list?')) return;
    const movie = this.getMovie();
    await this.props.deleteMovie(movie._id);
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
    const { editing, editForm, showMarkWatched, toast, externalMovie, localLoading } = this.state;
    const movie = this.getMovie();

    if ((loading || localLoading) && !movie) {
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
      <div className="detail-page container-fluid" style={{ minHeight: '100vh', padding: '40px 0' }}>
        {/* Full Bleed Backdrop */}
        {movie.poster && (
          <div className="detail-hero-backdrop">
            <div className="hero-bg-placeholder" style={{ position: 'absolute', inset: 0, background: 'var(--bg)' }} />
            <img
              src={movie.poster}
              className="detail-backdrop-img"
              alt=""
              onError={(e) => { e.target.style.opacity = '0'; }}
            />
            {/* Gradient overlay to blend backdrop into page */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, var(--bg) 90%)' }}></div>
          </div>
        )}

        <div className="detail-container-premium">
          <button className="back-btn reveal" onClick={() => navigate(-1)} style={{ marginBottom: '24px' }}>
            ← Back to Dashboard
          </button>

          {!editing ? (
            <div className="detail-layout-premium">
              {/* Sidebar with Poster and Actions */}
              <div className="detail-sidebar-premium reveal">
                <div className="detail-poster-premium">
                  <div className="detail-poster-placeholder">🎬</div>
                  {movie.poster && (
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      onError={(e) => { e.target.style.opacity = '0'; }}
                    />
                  )}
                </div>

                <div className="detail-actions-premium">
                  {(movie.isExternalRec || movie.status === 'watchlist') && (
                    <button className="btn btn-primary" onClick={() => this.setState({ showMarkWatched: true })}>
                      ✓ Mark as Watched
                    </button>
                  )}
                  {movie.isExternalRec && (
                    <button className="btn btn-secondary glass-panel" onClick={() => this.setState({ showAddModal: true })}>
                      + Add to Watchlist
                    </button>
                  )}
                  <button className="btn btn-secondary glass-panel" onClick={() => this.setState({ showRecommend: true })}>
                    ✉ Recommend to Friend
                  </button>
                  {!movie.isExternalRec && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="btn btn-secondary glass-panel" style={{ flex: 1 }} onClick={this.startEditing}>
                        ✎ Edit
                      </button>
                      <button className="btn btn-danger" style={{ flex: 1, background: 'rgba(238, 82, 83, 0.1)', borderColor: 'rgba(238, 82, 83, 0.2)' }} onClick={this.handleDelete}>
                        ✕ Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Information Panel */}
              <div className="detail-main-premium">
                <div className="detail-header-premium reveal">
                  <div className="detail-tags-premium">
                    <span className="detail-tag">{movie.mediaType === 'series' ? 'TV Show' : 'Movie'}</span>
                    <span className="detail-tag-outline">{movie.year}</span>
                    <span className="detail-tag-outline">{movie.genre}</span>
                    <button
                      onClick={this.handleToggleTopPick}
                      className={`top-pick-btn ${movie.isTopPick ? 'active' : ''}`}
                      title="Toggle Top Pick"
                    >
                      {movie.isTopPick ? '⭐ Top Pick' : '☆ Add to Top Picks'}
                    </button>
                  </div>
                  <h1 className="detail-title-premium">{movie.title}</h1>
                  {movie.director && <p className="detail-director-premium">Directed by <span>{movie.director}</span></p>}
                </div>

                <div className="detail-glass-card reveal">
                  <div className="detail-grid-premium">
                    <div className="detail-stat">
                      <div className="stat-label">Your Rating</div>
                      <div className="stat-value">
                        {movie.status === 'watched' && movie.rating ? (
                          <div className="rating-huge">
                            {movie.rating}<span>/10</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Unrated</span>
                        )}
                      </div>
                    </div>

                    <div className="detail-stat-group">
                      <div className="detail-stat-small">
                        <div className="stat-label">Status</div>
                        <div className="stat-value" style={{ color: movie.status === 'watched' ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {movie.status === 'watched' ? '✓ Completed' : '👁 On Watchlist'}
                        </div>
                      </div>
                      <div className="detail-stat-small">
                        <div className="stat-label">Added To Library</div>
                        <div className="stat-value" style={{ fontSize: '1.1rem' }}>{movie.addedOn || 'N/A'}</div>
                      </div>
                      {movie.watchedOn && (
                        <div className="detail-stat-small">
                          <div className="stat-label">Watched On</div>
                          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{movie.watchedOn}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {movie.review && (
                  <div className="detail-glass-card reveal">
                    <div className="stat-label" style={{ marginBottom: '12px' }}>Your Personal Review</div>
                    <p className="detail-review-premium">
                      "{movie.review}"
                    </p>
                  </div>
                )}

                <div className="reveal" style={{ marginTop: '24px' }}>
                  {this.renderOTTSection()}
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
                  <div className="edit-field-minimal">
                      <label>STATUS</label>
                      <select 
                        value={editForm.status}
                        onChange={(e) => this.setState({ editForm: { ...editForm, status: e.target.value } })}
                      >
                        <option value="watchlist">WATCHLIST</option>
                        <option value="watched">WATCHED</option>
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

          {this.state.showRecommend && (
            <RecommendModal
              movie={movie}
              onRecommend={this.handleRecommend}
              onClose={() => this.setState({ showRecommend: false })}
            />
          )}

          {this.state.showAddModal && (
          <AddMovieModal 
            initialData={{
                title: movie.title,
                mediaType: movie.mediaType,
                poster: movie.poster,
                imdbID: movie.imdbID
            }}
            onSubmit={async (data) => {
                await this.props.addMovie(data);
                this.setState({ showAddModal: false });
                this.showToast('Added to library!', 'success');
            }} 
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
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  movies: state.movies.items,
  loading: state.movies.loading
});

const mapDispatchToProps = { fetchMovies, updateMovie, deleteMovie, markAsWatched, addMovie };

export default connect(mapStateToProps, mapDispatchToProps)(MovieDetailWrapper);
