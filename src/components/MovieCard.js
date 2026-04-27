import React, { Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStreamingAvailability, fetchTrailerID } from '../services/tmdbService';
import { getCounts, toggleLike } from '../services/engagementService';
import gsap from 'gsap';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Check, Send, Trash2, Play, Heart, MessageCircle, BookmarkPlus, Star } from 'lucide-react';
import { addMovie, deleteMovie, markAsWatched, fetchMovies } from '../store/thunks';
import { showRecommendModal, showToast, showConfirmModal, showTrailerModal } from '../store/actions';

// Wrapper to provide navigate and redux to class component
function MovieCardWrapper(props) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userMovies = useSelector(state => state.movies.items);
  return <MovieCard {...props} navigate={navigate} dispatch={dispatch} userMovies={userMovies} isDashboard={props.isDashboard} />;
}

class MovieCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      streamingProviders: [],
      engagementCounts: null,
      engagementFetched: false
    };
    this.cardRef = React.createRef();
  }

  handleMouseEnter = async () => {
    const { movie } = this.props;
    if (this.state.engagementFetched || !movie.imdbID) return;
    this.setState({ engagementFetched: true });
    try {
      const counts = await getCounts(movie.imdbID);
      this.setState({ engagementCounts: counts });
    } catch (e) {
      // silently fail — counts are non-critical
    }
  };

  async componentDidMount() {
    const { movie } = this.props;

    // Entry Animation
    gsap.fromTo(this.cardRef.current,
      { opacity: 0, scale: 0.9, y: 20 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.6,
        delay: (this.props.index % 10) * 0.05,
        ease: "power2.out"
      }
    );

    if (movie.title) {
      const providers = await fetchStreamingAvailability(movie.title, movie.mediaType || 'movie', movie.year, movie.imdbID);
      if (providers && Array.isArray(providers) && providers.length > 0) {
        this.setState({ streamingProviders: providers });
      }
    }
  }

  handlePlatformClick = (e, link) => {
    e.stopPropagation();
    window.open(link, '_blank');
  };

  handleWatchlistToggle = async (e) => {
    e.stopPropagation();
    const { movie, dispatch, userMovies } = this.props;
    const existing = userMovies.find(m => (m.imdbID === movie.imdbID && movie.imdbID) || m._id === movie._id);

    if (existing && existing.status === 'watchlist') {
        dispatch(showConfirmModal({
            title: 'Remove from Watchlist',
            message: `Remove "${movie.title}" from your watchlist?`,
            confirmText: 'Yes',
            cancelText: 'No',
            isDangerous: true,
            onConfirm: () => {
                dispatch(deleteMovie(existing._id));
                dispatch(showToast('Removed from watchlist', 'info'));
            }
        }));
    } else {
      try {
        await dispatch(addMovie({
          title: movie.title,
          year: movie.year,
          poster: movie.poster,
          imdbID: movie.imdbID,
          mediaType: movie.mediaType || 'movie',
          genre: movie.genre || 'Unknown',
          status: 'watchlist'
        }));
        // Only show success if addMovie didn't throw
        if (!existing) dispatch(showToast('Added to watchlist', 'success'));
        else dispatch(showToast('Moved to watchlist', 'success'));
      } catch (err) {
        // Error toast already dispatched by the thunk — do nothing here
      }
    }
  };

  handleMarkWatched = async (e) => {
    e.stopPropagation();
    const { movie, dispatch, userMovies } = this.props;
    const existing = userMovies.find(m => (m.imdbID === movie.imdbID && movie.imdbID) || m._id === movie._id);

    if (existing && existing.status === 'watched') {
        dispatch(showConfirmModal({
            title: 'Remove from Watched',
            message: `Remove "${movie.title}" from your watched list?`,
            confirmText: 'Yes',
            cancelText: 'No',
            isDangerous: true,
            onConfirm: () => {
                dispatch(deleteMovie(existing._id));
                dispatch(showToast('Removed from watched list', 'info'));
            }
        }));
    } else {
      try {
        await dispatch(addMovie({
          title: movie.title,
          year: movie.year,
          poster: movie.poster,
          imdbID: movie.imdbID,
          mediaType: movie.mediaType || 'movie',
          genre: movie.genre || 'Unknown',
          status: 'watched',
          watchedOn: new Date().toISOString().split('T')[0]
        }));
        // Only show success if addMovie didn't throw
        if (!existing) dispatch(showToast('Added to Watched list! 🍿', 'success'));
        else dispatch(showToast('Marked as watched! 🍿', 'success'));
      } catch (err) {
        // Error toast already dispatched by the thunk — do nothing here
      }
    }
  };

  handleToggleTopPick = async (e) => {
    e.stopPropagation();
    const { movie, dispatch, userMovies } = this.props;
    const userCopy = userMovies.find(m => (m.imdbID === movie.imdbID && movie.imdbID) || m._id === movie._id);
    if (!userCopy?._id) return; // can only top-pick library items

    try {
      const token = localStorage.getItem('token');
      const axios = (await import('axios')).default;
      await axios.patch(
        `${(await import('../config')).default.API_URL}/api/users/profile/top-picks`,
        { mediaId: userCopy._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      dispatch(showToast(userCopy.isTopPick ? 'Removed from Top Picks' : 'Added to Top Picks! ⭐', 'success'));
      dispatch(fetchMovies()); // sync state
    } catch {
      dispatch(showToast('Failed to update Top Pick', 'error'));
    }
  };

  handleRecommend = (e) => {
    e.stopPropagation();
    const { movie, dispatch } = this.props;
    dispatch(showRecommendModal(movie));
  };

  handlePlayTrailer = async (e) => {
    e.stopPropagation();
    const { movie, dispatch } = this.props;
    
    // TMDB ID usually comes in as 'id' or '_id' 
    const tmdbId = movie.id || movie._id;
    if (!tmdbId && !movie.imdbID) {
      dispatch(showToast('Trailer unavailable for this title', 'error'));
      return;
    }

    try {
      dispatch(showToast('Fetching trailer...', 'info'));
      const videoId = await fetchTrailerID(movie);
      if (videoId) {
        dispatch(showTrailerModal(videoId));
      } else {
        dispatch(showToast('No trailer found on YouTube', 'error'));
      }
    } catch (err) {
      dispatch(showToast('Failed to load trailer', 'error'));
    }
  };

  handleLikeClick = async (e) => {
    e.stopPropagation();
    const { movie, dispatch } = this.props;
    if (!movie.imdbID) return;

    const counts = this.state.engagementCounts || { likeCount: 0, commentCount: 0, addedToListCount: 0 };
    // Fallback logic for userHasLiked if it wasn't returned by GET counts
    const currentlyLiked = counts.userHasLiked === true || (counts.userHasLiked === undefined && counts.likeCount > 0);
    
    // Optimistic toggle
    this.setState({
      engagementCounts: {
        ...counts,
        likeCount: currentlyLiked ? Math.max(0, counts.likeCount - 1) : counts.likeCount + 1,
        userHasLiked: !currentlyLiked
      }
    });

    try {
      const result = await toggleLike(movie.imdbID);
      this.setState({
        engagementCounts: {
          ...this.state.engagementCounts,
          likeCount: result.likeCount,
          userHasLiked: result.liked
        }
      });
    } catch (err) {
      this.setState({ engagementCounts: counts });
      if (err.response?.status !== 401) {
          dispatch(showToast('Failed to update like', 'error'));
      }
    }
  };

  handleCommentClick = (e) => {
    e.stopPropagation();
    const { movie, navigate } = this.props;
    const idToUse = (movie.isRecommendation || movie.isExternal)
      ? (movie.imdbID || movie._id)
      : (movie._id || movie.imdbID);
      
    if (idToUse) {
      const url = (movie.isExternal || !movie._id || movie.isRecommendation)
        ? `/movies/${idToUse}?external=true&type=${movie.mediaType || (movie.isExternal && movie.name ? 'series' : 'movie')}` 
        : `/movies/${idToUse}`;
      navigate(url);
    }
  };

  render() {
    const { movie, navigate, userMovies } = this.props;
    const { streamingProviders, engagementCounts } = this.state;

    const userCopy = userMovies.find(m => (m.imdbID === movie.imdbID && movie.imdbID) || m._id === movie._id);
    const inWatchlist = userCopy?.status === 'watchlist';
    const isWatched = userCopy?.status === 'watched';
    const isTopPick = userCopy?.isTopPick || false;
    const isInLibrary = !!userCopy?._id;

    return (
      <div
        className="movie-card bio-luminescent"
        ref={this.cardRef}
        onMouseEnter={this.handleMouseEnter}
        onClick={() => {
            // For recommendations & external items, prefer imdbID.
            // rec._id is a Recommendation MongoDB ObjectId — NOT a valid TMDB/IMDB movie ID.
            // Passing it to TMDB causes a completely different movie to be fetched.
            const idToUse = (movie.isRecommendation || movie.isExternal)
                ? (movie.imdbID || movie.tmdbId || movie._id)
                : (movie._id || movie.imdbID || movie.tmdbId);
            if (idToUse) {
                const url = (movie.isExternal || !movie._id || movie.isRecommendation)
                    ? `/movies/${idToUse}?external=true&type=${movie.mediaType || (movie.isExternal && movie.name ? 'series' : 'movie')}` 
                    : `/movies/${idToUse}`;
                navigate(url);
            }
        }}
        style={{ cursor: (movie._id || movie.imdbID || movie.tmdbId) ? 'pointer' : 'default' }}
      >
        <div className="movie-card-quick-actions">
          <button 
            className={`card-action-btn ${inWatchlist ? 'remove' : ''}`} 
            onClick={this.handleWatchlistToggle}
            title={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
          >
            {inWatchlist ? <Trash2 size={18} /> : <Plus size={18} />}
          </button>
          
          <button 
            className={`card-action-btn watched ${isWatched ? 'active remove' : ''}`} 
            onClick={this.handleMarkWatched}
            title={isWatched ? "Remove from Watched" : "Mark as Watched"}
          >
            {isWatched ? <Trash2 size={18} /> : <Check size={18} />}
          </button>

          {isInLibrary && (
            <button 
              className={`card-action-btn top-pick ${isTopPick ? 'active' : ''}`} 
              onClick={this.handleToggleTopPick}
              title={isTopPick ? "Remove from Top Picks" : "Add to Top Picks"}
              style={{ color: isTopPick ? '#f5c518' : undefined }}
            >
              <Star size={18} fill={isTopPick ? '#f5c518' : 'none'} stroke={isTopPick ? '#f5c518' : 'currentColor'} />
            </button>
          )}

          <button 
            className="card-action-btn" 
            onClick={this.handleRecommend}
            title="Recommend to Friend"
          >
            <Send size={18} />
          </button>
        </div>

        <div className="movie-card-poster-container">
          <div className="movie-card-poster-placeholder" style={{ opacity: (movie.poster && movie.poster !== 'N/A') ? 0 : 1 }}>
            <span>🎬</span>
            <div className="fallback-title">{movie.title}</div>
          </div>
          {movie.poster && movie.poster !== 'N/A' && (
            <img
              src={movie.poster}
              alt={movie.title}
              className="movie-card-poster"
              onLoad={(e) => {
                e.target.style.opacity = '1';
                const placeholder = e.target.parentElement.querySelector('.movie-card-poster-placeholder');
                if (placeholder) placeholder.style.opacity = '0';
              }}
              onError={(e) => { 
                e.target.style.opacity = '0'; 
                const placeholder = e.target.parentElement.querySelector('.movie-card-poster-placeholder');
                if (placeholder) placeholder.style.opacity = '1';
              }}
            />
          )}

          <div className="movie-card-overlay">
            <div className="movie-card-title">{movie.title}</div>
            <div className="movie-card-meta">
              {movie.genre ? `${movie.genre} · ` : ''}{movie.year} · {movie.mediaType === 'series' ? 'TV' : 'Movie'}
            </div>
            {(movie.rating || userCopy?.userRating) && (
              <div className="movie-card-rating">
                <span>★</span>
                <span>{userCopy?.userRating || movie.rating}/10</span>
              </div>
            )}

            <button 
                className="btn-trailer-overlay"
                onClick={this.handlePlayTrailer}
            >
                <Play size={14} fill="currentColor" /> WATCH TRAILER
            </button>

            {streamingProviders && streamingProviders.length > 0 && (
              <div className="ott-platforms-inline" style={{ marginTop: '12px' }}>
                <div className="ott-label" style={{ marginBottom: '4px', textShadow: '0 1px 2px rgba(0,0,0,0.8)', color: '#fff' }}>Watch on:</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {streamingProviders.map(p => (
                    <img
                      key={p.name}
                      src={p.logo}
                      alt={p.name}
                      title={`Play on ${p.name}`}
                      className="ott-icon"
                      onClick={(e) => this.handlePlatformClick(e, p.link)}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {engagementCounts && (
              <div className="card-engagement-bar" onClick={e => e.stopPropagation()}>
                <span 
                  className="card-eng-stat" 
                  title="Likes" 
                  onClick={this.handleLikeClick} 
                  style={{ cursor: 'pointer', color: engagementCounts.userHasLiked || engagementCounts.likeCount > 0 ? 'var(--accent)' : 'rgba(255, 255, 255, 0.75)', transition: 'color 0.2s' }}
                >
                  <Heart size={12} fill={(engagementCounts.userHasLiked || (engagementCounts.userHasLiked === undefined && engagementCounts.likeCount > 0)) ? 'currentColor' : 'none'} fillOpacity={0.8} />
                  {engagementCounts.likeCount}
                </span>
                <span 
                  className="card-eng-stat" 
                  title="Comments" 
                  onClick={this.handleCommentClick} 
                  style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)'}
                >
                  <MessageCircle size={12} />
                  {engagementCounts.commentCount}
                </span>
                <span className="card-eng-stat" title="Added to list">
                  <BookmarkPlus size={12} />
                  {engagementCounts.addedToListCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default MovieCardWrapper;
