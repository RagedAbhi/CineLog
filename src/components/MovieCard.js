import React, { Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStreamingAvailability, fetchTrailerID } from '../services/tmdbService';
import { getCounts } from '../services/engagementService';
import gsap from 'gsap';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Check, Send, Trash2, Play, Heart, MessageCircle, BookmarkPlus } from 'lucide-react';
import { addMovie, deleteMovie, markAsWatched } from '../store/thunks';
import { showRecommendModal, showToast, showConfirmModal, showTrailerModal } from '../store/actions';

// Wrapper to provide navigate and redux to class component
function MovieCardWrapper(props) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userMovies = useSelector(state => state.movies.items);
  return <MovieCard {...props} navigate={navigate} dispatch={dispatch} userMovies={userMovies} />;
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

  render() {
    const { movie, navigate, userMovies } = this.props;
    const { streamingProviders, engagementCounts } = this.state;

    const userCopy = userMovies.find(m => (m.imdbID === movie.imdbID && movie.imdbID) || m._id === movie._id);
    const inWatchlist = userCopy?.status === 'watchlist';
    const isWatched = userCopy?.status === 'watched';

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
                ? (movie.imdbID || movie._id)
                : (movie._id || movie.imdbID);
            if (idToUse) {
                const url = (movie.isExternal || !movie._id || movie.isRecommendation)
                    ? `/movies/${idToUse}?external=true&type=${movie.mediaType || 'movie'}` 
                    : `/movies/${idToUse}`;
                navigate(url);
            }
        }}
        style={{ cursor: (movie._id || movie.imdbID) ? 'pointer' : 'default' }}
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
                <span className="card-eng-stat" title="Likes">
                  <Heart size={12} fill={engagementCounts.likeCount > 0 ? 'currentColor' : 'none'} />
                  {engagementCounts.likeCount}
                </span>
                <span className="card-eng-stat" title="Comments">
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
