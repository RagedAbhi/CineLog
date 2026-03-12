import { Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStreamingAvailability } from '../services/tmdbService';

// Wrapper to provide navigate to class component
function MovieCardWrapper(props) {
  const navigate = useNavigate();
  return <MovieCard {...props} navigate={navigate} />;
}

class MovieCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      streamingProviders: null
    };
  }

  async componentDidMount() {
    const { movie } = this.props;
    if (movie.title) {
      const providers = await fetchStreamingAvailability(movie.title, movie.mediaType || 'movie', movie.year);
      if (providers && providers.length > 0) {
        this.setState({ streamingProviders: providers });
      }
    }
  }

  renderStars(rating) {
    if (!rating) return null;
    const filled = Math.round(rating / 2);
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i}>{i < filled ? '★' : '☆'}</span>
    ));
  }

  handlePlatformClick = (e, link) => {
    e.stopPropagation(); // Don't navigate to detail page
    window.open(link, '_blank');
  }

  render() {
    const { movie, navigate } = this.props;
    const { streamingProviders } = this.state;

    return (
      <div
        className="movie-card"
        onClick={() => navigate(`/movies/${movie.id}`)}
      >
        {movie.priority && (
          <span className={`priority-badge priority-${movie.priority}`}>
            {movie.priority}
          </span>
        )}

        <div className="movie-card-poster-container">
          {movie.poster ? (
            <img
              src={movie.poster}
              alt={movie.title}
              className="movie-card-poster"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="movie-card-poster-placeholder">🎬</div>
          )}

          {streamingProviders && (
            <div className="ott-overlay">
              <div className="ott-label">Watch on:</div>
              <div className="ott-platforms">
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
        </div>

        <div className="movie-card-body">
          <div className="movie-card-title">{movie.title}</div>
          <div className="movie-card-meta">
            {movie.genre} · {movie.year}
          </div>
          {movie.rating && (
            <div className="movie-card-rating">
              <span>★</span>
              <span>{movie.rating}/10</span>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default MovieCardWrapper;
