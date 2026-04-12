import React, { Component } from 'react';
import { Helmet } from 'react-helmet-async';
import { Star, Clock, Calendar, Film, Trash2, Edit3, Share2, ArrowLeft, MoreVertical, PlayCircle, ExternalLink, MessageCircle, Heart, CheckCircle, Info } from 'lucide-react';
import { connect } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { fetchMovies, updateMovie, deleteMovie, markAsWatched, addMovie } from '../store/thunks';
import MarkWatchedModal from '../components/MarkWatchedModal';
import AddMovieModal from '../components/AddMovieModal';
import WatchTogetherModal from '../components/WatchTogetherModal';
import { fetchStreamingAvailability, fetchTrailerID } from '../services/tmdbService';
import { getMovieDetailsExternal } from '../services/movieService';
import { showToast, showRecommendModal, showConfirmModal, showTrailerModal, setTeleporting } from '../store/actions';
import axios from 'axios';
import gsap from 'gsap';
import config from '../config';
import * as engagementService from '../services/engagementService';
import '../styles/engagement.css';

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
      localLoading: false,
      showWatchTogether: false,
      watchTogetherNetflixUrl: null,
      engagement: null,
      watchedByFriends: [],
      showWatchersModal: false,
      commentText: '',
      submittingComment: false
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
    if (movie && (!this.props.isExternal || movie.status)) {
      this.fetchStreamingInfo();
      this.initAnimations();
      this.fetchEngagementData(movie.imdbID);
    } else if (this.props.isExternal) {
        this.fetchExternalMovie();
    } else {
        this.fetchMovieDirectly();
    }
  }

  fetchEngagementData = async (imdbID) => {
    if (!imdbID) return;
    try {
      const [engagement, watchedData] = await Promise.all([
        engagementService.getEngagement(imdbID),
        engagementService.getWatchedByFriends(imdbID)
      ]);
      this.setState({ engagement, watchedByFriends: watchedData.friends || [] });
    } catch (e) {
      // non-critical
    }
  }

  handleLikeToggle = async () => {
    const movie = this.getMovie();
    if (!movie?.imdbID) return;
    try {
      const result = await engagementService.toggleLike(movie.imdbID);
      this.setState(prev => ({
        engagement: prev.engagement
          ? { ...prev.engagement, likeCount: result.likeCount, userHasLiked: result.liked }
          : { likeCount: result.likeCount, commentCount: 0, addedToListCount: 0, userHasLiked: result.liked, comments: [] }
      }));
    } catch (e) {
      this.props.showToast('Failed to update like', 'error');
    }
  }

  handleAddComment = async () => {
    const movie = this.getMovie();
    const { commentText } = this.state;
    if (!commentText.trim() || !movie?.imdbID) return;
    this.setState({ submittingComment: true });
    try {
      const newComment = await engagementService.addComment(movie.imdbID, commentText.trim());
      this.setState(prev => ({
        commentText: '',
        submittingComment: false,
        engagement: prev.engagement
          ? {
              ...prev.engagement,
              commentCount: (prev.engagement.commentCount || 0) + 1,
              comments: [newComment, ...(prev.engagement.comments || [])]
            }
          : null
      }));
    } catch (e) {
      this.setState({ submittingComment: false });
      this.props.showToast('Failed to post comment', 'error');
    }
  }

  handleDeleteComment = async (commentId) => {
    const movie = this.getMovie();
    if (!movie?.imdbID) return;
    try {
      await engagementService.deleteComment(movie.imdbID, commentId);
      this.setState(prev => ({
        engagement: prev.engagement
          ? {
              ...prev.engagement,
              commentCount: Math.max(0, (prev.engagement.commentCount || 1) - 1),
              comments: prev.engagement.comments.filter(c => c._id !== commentId)
            }
          : null
      }));
    } catch (e) {
      this.props.showToast('Failed to delete comment', 'error');
    }
  }

  handleToggleCommentHeart = async (commentId) => {
    const movie = this.getMovie();
    if (!movie?.imdbID) return;
    try {
      const result = await engagementService.toggleCommentHeart(movie.imdbID, commentId);
      this.setState(prev => ({
        engagement: prev.engagement
          ? {
              ...prev.engagement,
              comments: prev.engagement.comments.map(c =>
                c._id === commentId
                  ? { ...c, heartCount: result.heartCount, userHasHearted: result.hearted }
                  : c
              )
            }
          : null
      }));
    } catch (e) {
      // silently fail
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
            this.fetchEngagementData(this.props.movieId);
        });
    } catch (err) {
        console.error('External fetch failed, falling back to recommendation record:', err);
        this.fetchRecommendationFallback();
    }
  }

  fetchMovieDirectly = async () => {
    this.setState({ localLoading: true });
    try {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${config.API_URL}/api/media/${this.props.movieId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data) {
                this.setState({ externalMovie: { ...res.data, isExternalRec: false }, localLoading: false }, async () => {
                    this.fetchStreamingInfo();
                    this.initAnimations();
                    this.fetchEngagementData(res.data.imdbID);
                    
                    // Trigger lazy repair if data is missing
                    const movie = res.data;
                    if (!movie.plot || movie.plot.length < 10 || !movie.cast || movie.cast === 'Unknown') {
                        try {
                            const fresh = await getMovieDetailsExternal(movie.imdbID || movie._id, movie.mediaType);
                            if (fresh) this.syncMetadataIfNeeded(fresh);
                        } catch (e) { console.warn('Lazy repair fetch failed:', e); }
                    }
                });
                return;
            }
        } catch (mediaErr) {
            this.fetchRecommendationFallback();
        }
    } catch (err) {
        this.setState({ localLoading: false });
    }
  }

  async componentDidUpdate(prevProps) {
    if (prevProps.movies.length === 0 && this.props.movies.length > 0) {
      this.loadInitialData();
    }
    if (prevProps.movieId !== this.props.movieId) {
      this.loadInitialData();
    }
  }

  fetchRecommendationFallback = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${config.API_URL}/api/recommendations/${this.props.movieId}`, {
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
    if (!movie || !movie._id || !freshDetails) return;

    // Condition 1: Recommendation needs healing
    if (movie.isExternalRec && (!movie.genre || movie.genre === 'Unknown' || movie.genre === '')) {
      if (freshDetails.genre && freshDetails.genre !== 'Unknown') {
        try {
          const token = localStorage.getItem('token');
          await axios.patch(`${config.API_URL}/api/recommendations/${movie._id}/metadata`, 
            { genre: freshDetails.genre },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (err) {
          console.error('[MovieDetail] Failed to sync recommendation metadata:', err);
        }
      }
    }

    // Condition 2: Regular library item needs healing (Missing Plot or Cast)
    const isCorrupted = !movie.isExternalRec && (!movie.plot || movie.plot.length < 10 || !movie.cast || movie.cast === 'Unknown');
    if (isCorrupted && freshDetails.plot) {
        console.log('[MovieDetail] Healing corrupted library item metadata...');
        try {
            await this.props.updateMovie(movie._id, {
                plot: movie.plot && movie.plot.length >= 10 ? movie.plot : freshDetails.plot,
                cast: movie.cast && movie.cast !== 'Unknown' ? movie.cast : freshDetails.cast,
                director: movie.director && movie.director !== 'Unknown' ? movie.director : freshDetails.director,
                genre: movie.genre && movie.genre !== 'Unknown' ? movie.genre : freshDetails.genre
            });
        } catch (err) {
            console.error('[MovieDetail] Failed to auto-heal library item:', err);
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
      } else if (res && Array.isArray(res)) {
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
              <p>Please add a valid <strong>TMDB API Key</strong> to your <code>.env</code> file to see where to watch.</p>
            </div>
          </div>
        </div>
      );
    }

    if (!streamingProviders || streamingProviders.length === 0) return null;

    const netflixProvider = streamingProviders.find(p =>
      p.name.toLowerCase().includes('netflix')
    );

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

        {netflixProvider && (
          <button
            className="wt-trigger-btn"
            onClick={() => this.setState({
              showWatchTogether: true,
              watchTogetherNetflixUrl: netflixProvider.link
            })}
          >
            <span className="wt-trigger-n">N</span>
            Watch Together on Netflix
          </button>
        )}
      </div>
    );
  }

  getMovie() {
    const { movies, movieId } = this.props;
    const { externalMovie } = this.state;
    
    if (!movies || !movieId) return externalMovie;

    const localMovie = movies.find(m => 
        (m._id && m._id.toString() === movieId.toString()) ||
        (m.imdbID && m.imdbID === movieId)
    );

    // SMARTER MERGE: If local movie exists but is "thin" (missing plot), 
    // and we have a rich external movie object in state, prefer the rich one.
    if (externalMovie && (!localMovie || (!localMovie.plot && externalMovie.plot))) {
      return externalMovie;
    }

    return localMovie || externalMovie;
  }

  handleToggleTopPick = async () => {
    const movie = this.getMovie();
    try {
      const token = localStorage.getItem('token');
      const response = await axios.patch(`${config.API_URL}/api/users/profile/top-picks`, {
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

  handlePlayTrailer = async () => {
    const movie = this.getMovie();
    try {
      this.props.showToast('Fetching trailer...', 'info');
      const videoId = await fetchTrailerID(movie);
      if (videoId) {
        this.props.showTrailerModal(videoId);
      } else {
        this.props.showToast('No trailer found on YouTube', 'error');
      }
    } catch (err) {
      this.props.showToast('Failed to load trailer', 'error');
    }
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
    try {
      if (movie.isExternalRec) {
        // Not in library yet — add via addMovie thunk
        const movieToSave = {
          title: movie.title,
          year: movie.year,
          genre: movie.genre || 'Unknown',
          director: movie.director || 'Unknown',
          poster: movie.poster,
          imdbID: movie.imdbID,
          mediaType: movie.mediaType || 'movie',
          plot: movie.plot || '',
          cast: movie.cast || '',
          status: 'watched',
          ...watchData
        };
        await this.props.addMovie(movieToSave);
      } else {
        await this.props.markAsWatched(movie._id, watchData);
      }
      this.setState({ showMarkWatched: false });
      this.props.showToast('Marked as watched! 🎬');
    } catch (err) {
      // Error toast already shown by the thunk
      this.setState({ showMarkWatched: false });
    }
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
                plot: movie.plot || '',
                cast: movie.cast || '',
                status: 'watchlist'
            };
            try {
                await this.props.addMovie(movieToSave);
                this.props.showToast('Added to watchlist!', 'success');
            } catch (err) {
                // Error toast already shown by the thunk
            }
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

  renderWatchedByFriends() {
    const { watchedByFriends, showWatchersModal } = this.state;
    if (!watchedByFriends || watchedByFriends.length === 0) return null;

    const visible = watchedByFriends.slice(0, 3);
    const extra = watchedByFriends.length - 3;

    return (
      <div className="watched-by-friends-section reveal">
        <div className="stat-label" style={{ marginBottom: '12px' }}>Watched by</div>
        <div className="watched-by-row">
          {visible.map(f => (
            <div key={f._id} className="watcher-avatar" title={f.name || f.username}>
              {f.profilePicture
                ? <img src={f.profilePicture} alt={f.name} />
                : <span>{(f.name || f.username || '?').charAt(0).toUpperCase()}</span>
              }
            </div>
          ))}
          {extra > 0 && (
            <button className="watcher-more-btn" onClick={() => this.setState({ showWatchersModal: true })}>
              +{extra}
            </button>
          )}
          <span className="watched-by-names">
            {visible.map(f => f.name || f.username).join(', ')}
            {extra > 0 ? ` and ${extra} more` : ''}
          </span>
        </div>

        {showWatchersModal && (
          <div className="engagement-modal-overlay" onClick={() => this.setState({ showWatchersModal: false })}>
            <div className="engagement-modal" onClick={e => e.stopPropagation()}>
              <div className="engagement-modal-header">
                <span>Friends who watched this</span>
                <button onClick={() => this.setState({ showWatchersModal: false })}>✕</button>
              </div>
              <div className="watchers-full-list">
                {watchedByFriends.map(f => (
                  <div key={f._id} className="watcher-list-item">
                    <div className="watcher-avatar">
                      {f.profilePicture
                        ? <img src={f.profilePicture} alt={f.name} />
                        : <span>{(f.name || f.username || '?').charAt(0).toUpperCase()}</span>
                      }
                    </div>
                    <div>
                      <div className="watcher-name">{f.name}</div>
                      <div className="watcher-handle">@{f.username}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  renderTopEngagementStats() {
    const { engagement } = this.state;
    const movie = this.getMovie();
    if (!movie?.imdbID) return null;

    const likeCount = engagement?.likeCount ?? 0;
    const commentCount = engagement?.commentCount ?? 0;
    const addedToListCount = engagement?.addedToListCount ?? 0;
    const userHasLiked = engagement?.userHasLiked ?? false;

    return (
      <div className="engagement-top-row reveal">
        <button
          className={`engagement-like-btn ${userHasLiked ? 'liked' : ''}`}
          onClick={this.handleLikeToggle}
        >
          <Heart size={20} fill={userHasLiked ? 'currentColor' : 'none'} />
          <span>{likeCount}</span>
        </button>
        <div className="engagement-stat-item">
          <MessageCircle size={18} />
          <span>{commentCount}</span>
        </div>
        <div className="engagement-stat-item" title="Added to list">
          <CheckCircle size={20} />
          <span>{addedToListCount} {addedToListCount === 1 ? 'added' : 'added'} to list</span>
        </div>
      </div>
    );
  }

  renderEngagementSection() {
    const { engagement, commentText, submittingComment } = this.state;
    const movie = this.getMovie();
    if (!movie?.imdbID) return null;

    const likeCount = engagement?.likeCount ?? 0;
    const commentCount = engagement?.commentCount ?? 0;
    const addedToListCount = engagement?.addedToListCount ?? 0;
    const userHasLiked = engagement?.userHasLiked ?? false;
    const comments = engagement?.comments ?? [];

    return (
      <div className="engagement-section reveal">
        {/* Comment input */}
        <div className="engagement-comment-input-row">
          <input
            className="engagement-comment-input"
            type="text"
            placeholder="Add a comment..."
            value={commentText}
            maxLength={500}
            onChange={e => this.setState({ commentText: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && !submittingComment && this.handleAddComment()}
          />
          <button
            className="engagement-comment-submit"
            onClick={this.handleAddComment}
            disabled={submittingComment || !commentText.trim()}
          >
            {submittingComment ? '...' : 'Post'}
          </button>
        </div>

        {/* Comments list */}
        {comments.length > 0 && (
          <div className="engagement-comments-list">
            {comments.map(comment => (
              <div key={comment._id} className="engagement-comment-item">
                <div className="comment-avatar">
                  {comment.profilePicture
                    ? <img src={comment.profilePicture} alt={comment.name} />
                    : <span>{(comment.name || comment.username || '?').charAt(0).toUpperCase()}</span>
                  }
                </div>
                <div className="comment-body">
                  <div className="comment-header">
                    <span className="comment-author">{comment.name || comment.username}</span>
                    <span className="comment-time">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="comment-text">{comment.text}</p>
                </div>
                <div className="comment-actions">
                  <button
                    className={`comment-heart-btn ${comment.userHasHearted ? 'hearted' : ''}`}
                    onClick={() => this.handleToggleCommentHeart(comment._id)}
                    title="Like comment"
                  >
                    <Heart size={13} fill={comment.userHasHearted ? 'currentColor' : 'none'} />
                    {comment.heartCount > 0 && <span>{comment.heartCount}</span>}
                  </button>
                  {comment.userId?.toString() === this.props.currentUserId && (
                    <button
                      className="comment-delete-btn"
                      onClick={() => this.handleDeleteComment(comment._id)}
                      title="Delete comment"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {comments.length === 0 && engagement && (
          <p className="engagement-empty">Be the first to comment.</p>
        )}
      </div>
    );
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
        <Helmet>
          <title>{`${movie.title} (${movie.year}) | Cuerates`}</title>
          <meta name="description" content={movie.plot || `View details and your personal review for ${movie.title} on Cuerates.`} />
          <meta property="og:title" content={`${movie.title} (${movie.year}) - Cuerates`} />
          <meta property="og:description" content={movie.plot || `Your movie journal for ${movie.title}.`} />
          <meta property="og:image" content={movie.poster} />
          <meta property="og:type" content="video.movie" />
          <meta name="twitter:card" content="summary_large_image" />
        </Helmet>

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
                    <button className="btn btn-secondary" onClick={this.handleAddToWatchlist}>
                      + Add to Watchlist
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={this.handleRecommendClick}>
                    ✉ Recommend to Friend
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={this.handlePlayTrailer}
                  >
                    ▶ Watch Trailer
                  </button>
                  {!movie.isExternalRec && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={this.startEditing}>
                        ✎ Edit
                      </button>
                      <button className="btn btn-danger" style={{ flex: 1 }} onClick={this.handleDelete}>
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
                  {movie.director && (
                    <p className="detail-director-premium">
                      Directed by <span 
                        style={{ cursor: 'pointer', color: 'var(--accent)', textDecoration: 'underline' }}
                        onClick={() => {
                            this.props.setTeleporting(true);
                            navigate(`/search?search=${encodeURIComponent(movie.director)}&type=person&redirect=true`);
                        }}
                      >
                        {movie.director}
                      </span>
                    </p>
                  )}
                  {this.renderTopEngagementStats()}
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
                                    this.props.setTeleporting(true);
                                    this.props.navigate(`/search?search=${encodeURIComponent(actor)}&type=person&redirect=true`);
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

                <div className="detail-glass-card reveal" style={{ marginTop: '24px' }}>
                  {this.renderWatchedByFriends()}
                  {this.renderEngagementSection()}
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
                  <button className="btn btn-accent" onClick={this.handleEditSave}>Save Changes</button>
                  <button className="btn btn-secondary" onClick={() => this.setState({ editing: false })}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {this.state.showWatchTogether && (
            <WatchTogetherModal
              movie={this.getMovie()}
              netflixUrl={this.state.watchTogetherNetflixUrl}
              onClose={() => this.setState({ showWatchTogether: false, watchTogetherNetflixUrl: null })}
            />
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
  loading: state.movies.loading,
  currentUserId: state.auth.user?._id || state.auth.user?.id
});

const mapDispatchToProps = { fetchMovies, updateMovie, deleteMovie, markAsWatched, addMovie, showToast, showRecommendModal, showConfirmModal, showTrailerModal, setTeleporting };

export default connect(mapStateToProps, mapDispatchToProps)(MovieDetailWrapper);
