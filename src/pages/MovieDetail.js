import React, { Component } from 'react';
import { Star, Clock, Calendar, Film, Trash2, Edit3, Share2, ArrowLeft, MoreVertical, PlayCircle, ExternalLink, MessageCircle, Heart, CheckCircle, Info } from 'lucide-react';
import { connect } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { fetchMovies, updateMovie, deleteMovie, markAsWatched, addMovie } from '../store/thunks';
import MarkWatchedModal from '../components/MarkWatchedModal';
import AddMovieModal from '../components/AddMovieModal';
import { fetchStreamingAvailability } from '../services/tmdbService';
import { getMovieDetailsExternal } from '../services/movieService';
import { showToast, showRecommendModal, showConfirmModal } from '../store/actions';
import axios from 'axios';
import gsap from 'gsap';

function MovieDetailWrapper(props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isExternal = new URLSearchParams(location.search).get('external') === 'true';
  const autoRecommend = new URLSearchParams(location.search).get('recommend') === 'true';
  const mediaType = new URLSearchParams(location.search).get('type');
  return <MovieDetail {...props} navigate={navigate} movieId={id} isExternal={isExternal} autoRecommend={autoRecommend} mediaType={mediaType} />;
}

class MovieDetail extends Component {
  constructor(props) {
    super(props);
    this.state = {
      editing: false,
      showMarkWatched: false,
      showConfirmModal: false,
      hoverRating: 0,
      editForm: {},
      externalMovie: null,
      localLoading: false
    };
  }

  async componentDidMount() {
    if (this.props.movies.length === 0) {
      await this.props.fetchMovies();
    }
    
    this.loadInitialData();

    if (this.props.autoRecommend) {
        this.handleRecommendClick();
    }
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
        const details = await getMovieDetailsExternal(this.props.movieId, this.props.mediaType);
        this.setState({ 
            externalMovie: { ...details, isExternalRec: true, imdbID: this.props.movieId }, 
            localLoading: false 
        }, () => {
            this.fetchStreamingInfo();
            this.initAnimations();
            this.syncMetadataIfNeeded(details);
        });
    } catch (err) {
        console.error('External fetch failed, falling back to recommendation record:', err);
        this.fetchRecommendationFallback();
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
      this.setState({ localLoading: false });
    }
  }

  syncMetadataIfNeeded = async (freshDetails) => {
    const movie = this.getMovie();
    // If we're looking at a recommendation and the stored rec has no genre (or "Unknown"), fix it.
    if (movie && movie.isExternalRec && movie._id && (!movie.genre || movie.genre === 'Unknown' || movie.genre === '')) {
      if (freshDetails && freshDetails.genre && freshDetails.genre !== 'Unknown') {
        console.log(`[MovieDetail] Healing recommendation ${movie._id} with genre: ${freshDetails.genre}`);
        try {
          const token = localStorage.getItem('token');
          await axios.patch(`http://localhost:5000/api/recommendations/${movie._id}/metadata`, 
            { genre: freshDetails.genre },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (err) {
          console.error('[MovieDetail] Failed to sync recommendation metadata:', err);
        }
      }
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
      const res = await fetchStreamingAvailability(movie.title, movie.mediaType || 'movie', movie.year, movie.imdbID);
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
        (m._id && m._id.toString() === this.props.movieId.toString()) ||
        (m.imdbID && m.imdbID === this.props.movieId)
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

      this.props.showToast(movie.isTopPick ? 'Removed from Top Picks' : 'Added to Top Picks!');
      
      // Update local state immediately if it's the externalMovie being displayed
      if (this.state.externalMovie && this.state.externalMovie._id === movie._id) {
          this.setState({
              externalMovie: { ...this.state.externalMovie, isTopPick: !movie.isTopPick }
          });
      }

      this.props.fetchMovies(); 
    } catch (error) {
      console.error('Error toggling top pick:', error);
      this.props.showToast('Failed to toggle Top Pick', 'error');
    }
  }

  handleRecommendClick = () => {
    const movie = this.getMovie();
    this.props.showRecommendModal(movie);
  }

  startEditing = () => {
    const movie = this.getMovie();
    this.setState({
      editing: true,
      editForm: {
        title: movie.title,
        year: movie.year,
        genre: movie.genre || '',
        director: movie.director || '',
        poster: movie.poster || '',
        status: movie.status,
        rating: movie.rating || 0,
        review: movie.review || '',
        isTopPick: movie.isTopPick || false
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
      rating: editForm.rating || movie.rating,
      isTopPick: editForm.isTopPick
    });
    this.setState({ editing: false });
    this.props.showToast('Changes saved!');
  }

  handleMarkWatched = async (watchData) => {
    const movie = this.getMovie();
    if (movie.isExternalRec) {
      // It's not in our library yet, so we use addMovie thunk
      const movieToSave = {
        title: movie.title,
        year: movie.year,
        genre: movie.genre || 'Unknown',
        director: movie.director || 'Unknown',
        poster: movie.poster,
        imdbID: movie.imdbID,
        mediaType: movie.mediaType || 'movie',
        status: 'watched',
        ...watchData
      };
      await this.props.addMovie(movieToSave);
    } else {
      await this.props.markAsWatched(movie._id, watchData);
    }
    this.setState({ showMarkWatched: false });
    this.props.showToast('Marked as watched! 🎬');
  }

  handleAddToWatchlist = () => {
    const movie = this.getMovie();
    this.props.showConfirmModal({
        title: 'Add to Watchlist',
        message: `Add "${movie.title}" to your watchlist?`,
        confirmText: 'Yes',
        cancelText: 'No',
        isDangerous: false,
        onConfirm: async () => {
            const movieToSave = {
                title: movie.title,
                year: movie.year,
                genre: movie.genre || 'Unknown',
                director: movie.director || 'Unknown',
                poster: movie.poster,
                imdbID: movie.imdbID,
                mediaType: movie.mediaType || 'movie',
                status: 'watchlist'
            };
            await this.props.addMovie(movieToSave);
            this.props.showToast('Added to watchlist!', 'success');
        }
    });
  }

  handleDelete = async () => {
    const movie = this.getMovie();
    this.props.showConfirmModal({
      title: 'Remove from Library',
      message: `Are you sure you want to remove "${movie.title}" from your library?`,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      isDangerous: true,
      onConfirm: async () => {
        await this.props.deleteMovie(movie._id);
        this.props.showToast('Removed from library', 'info');
        this.props.navigate(-1);
      }
    });
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
                    <button className="btn btn-secondary glass-panel" onClick={this.handleAddToWatchlist}>
                      + Add to Watchlist
                    </button>
                  )}
                  <button className="btn btn-secondary glass-panel" onClick={this.handleRecommendClick}>
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
                      title={movie.isTopPick ? "Remove from Top Picks" : "Add to Top Picks"}
                    >
                      {movie.isTopPick ? '⭐ Remove from Top Picks' : '☆ Add to Top Picks'}
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
                        <div className="stat-value" style={{ color: movie.status === 'watched' ? 'var(--accent)' : (movie.status === 'watchlist' ? 'var(--text-primary)' : 'var(--text-muted)') }}>
                          {movie.status === 'watched' ? '✓ Completed' : (movie.status === 'watchlist' ? '👁 On Watchlist' : '❓ Unknown')}
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

                {(movie.plot || movie.cast) && (
                  <div className="detail-glass-card reveal">
                    {movie.plot && (
                      <div style={{ marginBottom: movie.cast ? '24px' : '0' }}>
                        <div className="stat-label" style={{ marginBottom: '12px' }}>Storyline</div>
                        <p className="detail-description-full" style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '1.1rem' }}>
                          {movie.plot}
                        </p>
                      </div>
                    )}
                    {movie.cast && (
                      <div>
                        <div className="stat-label" style={{ marginBottom: '12px' }}>Cast</div>
                        <p className="detail-cast-list" style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                          {movie.cast.split(', ').map((actor, i, arr) => (
                            <React.Fragment key={actor}>
                              <span 
                                className="clickable-cast-member" 
                                onClick={() => {
                                    this.props.navigate(`/?search=${encodeURIComponent(actor)}`);
                                }}
                                style={{ cursor: 'pointer', color: 'var(--accent)', transition: 'all 0.2s' }}
                              >
                                {actor}
                              </span>
                              {i < arr.length - 1 ? ', ' : ''}
                            </React.Fragment>
                          ))}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="reveal" style={{ marginTop: '24px' }}>
                  {this.renderOTTSection()}
                </div>
              </div>
            </div>
          ) : (
            /* Edit Form */
            <div className="edit-form-premium" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
              <div className="page-header-premium" style={{ marginBottom: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
                  Journal Archive
                </div>
                <h2 style={{ fontSize: '36px', margin: 0, fontWeight: '800' }}>{movie.title}</h2>
                <div style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Update your personal rating and thoughts</div>
              </div>
              
              <div className="glass-panel-premium" style={{ padding: '48px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.08)' }}>
                {/* Recommendation / Top Pick Toggle */}
                <div className="form-group-premium" style={{ marginBottom: '40px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer', padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.3s ease', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={editForm.isTopPick}
                        onChange={(e) => this.setState({ editForm: { ...editForm, isTopPick: e.target.checked } })}
                        style={{ width: '24px', height: '24px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>Add to your Masterpieces ⭐</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Marks this as one of your highest recommendations on your profile.</div>
                    </div>
                  </label>
                </div>

                {/* Star Rating Section */}
                <div className="form-group-premium" style={{ marginBottom: '40px' }}>
                  <label className="form-label-premium" style={{ fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', display: 'block' }}>Update Your Rating</label>
                  <div className="star-rating-container" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                      <div
                        key={num}
                        className={`star-item ${num <= (this.state.hoverRating || editForm.rating) ? 'filled' : ''} ${num <= this.state.hoverRating ? 'hovered' : ''}`}
                        onMouseEnter={() => this.setState({ hoverRating: num })}
                        onMouseLeave={() => this.setState({ hoverRating: 0 })}
                        onClick={() => this.setState({ editForm: { ...editForm, rating: num } })}
                        style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
                      >
                        <Star 
                          size={36} 
                          fill={num <= (this.state.hoverRating || editForm.rating) ? "#FFC107" : "transparent"} 
                          strokeWidth={1.5}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: '#FFC107' }}>{editForm.rating}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '15px', fontWeight: '500' }}>/ 10 Rating</span>
                    <span style={{ fontSize: '13px', background: 'rgba(255,193,7,0.1)', color: '#FFC107', padding: '4px 12px', borderRadius: '100px', marginLeft: '8px' }}>
                      {editForm.rating <= 3 ? 'Weak' : (editForm.rating <= 6 ? 'Decent' : (editForm.rating <= 8 ? 'Great' : 'Masterpiece'))}
                    </span>
                  </div>
                </div>

                {/* Review Section */}
                <div className="form-group-premium" style={{ marginBottom: '48px' }}>
                  <label className="form-label-premium" style={{ fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', display: 'block' }}>Personal Thoughts & Review</label>
                  <textarea 
                    className="form-input-premium" 
                    name="review" 
                    value={editForm.review} 
                    onChange={this.handleEditChange} 
                    placeholder="Shared your updated thoughts on this movie..."
                    style={{ minHeight: '200px', width: '100%', padding: '24px', borderRadius: '20px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', lineHeight: '1.6', outline: 'none', transition: 'border-color 0.3s ease' }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '20px' }}>
                  <button className="btn btn-primary" style={{ padding: '16px 48px', borderRadius: '100px', fontSize: '16px', fontWeight: '700', background: 'var(--accent)', color: '#000' }} onClick={this.handleEditSave}>Save Changes</button>
                  <button className="btn btn-secondary" style={{ padding: '16px 48px', borderRadius: '100px', fontSize: '16px', fontWeight: '600' }} onClick={() => this.setState({ editing: false })}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {this.state.showMarkWatched && (
            <MarkWatchedModal
              movie={movie}
              onSubmit={this.handleMarkWatched}
              onClose={() => this.setState({ showMarkWatched: false })}
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
                  this.props.showToast('Added to library!', 'success');
              }} 
              onClose={() => this.setState({ showAddModal: false })} 
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

const mapDispatchToProps = { fetchMovies, updateMovie, deleteMovie, markAsWatched, addMovie, showToast, showRecommendModal, showConfirmModal };

export default connect(mapStateToProps, mapDispatchToProps)(MovieDetailWrapper);
