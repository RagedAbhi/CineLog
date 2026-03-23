import { Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStreamingAvailability } from '../services/tmdbService';
import React from 'react'; // Added for React.createRef()
import gsap from 'gsap'; // Added for GSAP animations

// Wrapper to provide navigate to class component
function MovieCardWrapper(props) {
  const navigate = useNavigate();
  return <MovieCard {...props} navigate={navigate} />;
}

class MovieCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      streamingProviders: [] // Changed from null to empty array
    };
    this.cardRef = React.createRef(); // Added ref
  }

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
        delay: (this.props.index % 10) * 0.05, // Staggered delay
        ease: "power2.out"
      }
    );

    if (movie.title) {
      const providers = await fetchStreamingAvailability(movie.title, movie.mediaType || 'movie', movie.year, movie.imdbID);
      if (providers && providers.length > 0) {
        this.setState({ streamingProviders: providers });
      }
    }
  }

  // renderStars method removed as per instruction snippet

  handlePlatformClick = (e, link) => {
    e.stopPropagation(); // Don't navigate to detail page
    window.open(link, '_blank');
  }; // Added semicolon

  render() {
    const { movie, navigate } = this.props;
    const { streamingProviders } = this.state;

    return (
      <div
        className="movie-card bio-luminescent" // Added bio-luminescent class
        ref={this.cardRef} // Added ref
        onClick={() => {
          if (!movie._id) return;
          const url = movie.isExternal 
            ? `/movies/${movie._id}?external=true&mediaType=${movie.mediaType || 'movie'}` 
            : `/movies/${movie._id}`;
          navigate(url);
        }}
        style={{ cursor: movie._id ? 'pointer' : 'default' }}
      >

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
            {movie.rating && (
              <div className="movie-card-rating">
                <span>★</span>
                <span>{movie.rating}/10</span>
              </div>
            )}

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
          </div>
        </div>
      </div>
    );
  }
}

export default MovieCardWrapper;
