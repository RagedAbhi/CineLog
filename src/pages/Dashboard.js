import { Component, createRef } from 'react';
import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchMovies, addMovie } from '../store/thunks';
import MovieCard from '../components/MovieCard';
import AddMovieModal from '../components/AddMovieModal';
import RecommendModal from '../components/RecommendModal';
import Toast from '../components/Toast';
import axios from 'axios';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function DashboardWrapper(props) {
  const navigate = useNavigate();
  return <Dashboard {...props} navigate={navigate} />;
}

class Dashboard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showAddModal: false,
      toast: null,
      recommendations: [],
      activeHeroIndex: 0,
      showRecommendModal: false,
      selectedMedia: null
    };
    this.heroRef = createRef();
    this.rotationTimer = null;
    this.rowsRef = [];
  }

  componentDidMount() {
    if (this.props.movies.length === 0) this.props.fetchMovies();
    this.fetchRecommendations();
    this.initAnimations();
    this.startHeroRotation();
  }

  componentWillUnmount() {
    if (this.rotationTimer) clearInterval(this.rotationTimer);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.movies !== this.props.movies || prevProps.loading !== this.props.loading) {
      this.initAnimations();
    }
  }

  initAnimations = () => {
    // Kill existing ScrollTriggers to avoid duplicates
    ScrollTrigger.getAll().forEach(t => t.kill());

    // Smooth entry for hero content
    gsap.fromTo(".hero-content > *",
      { opacity: 0, x: -30 },
      { opacity: 1, x: 0, duration: 1, stagger: 0.2, ease: "power3.out" }
    );

    // Parallax effect on Hero Blurred Background
    if (document.querySelector(".hero-bg-blur")) {
      gsap.to(".hero-bg-blur", {
        y: "15%",
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-section",
          start: "top top",
          end: "bottom top",
          scrub: true
        }
      });
    }

    // Animate Side Poster
    if (document.querySelector(".hero-poster-side")) {
      gsap.fromTo(".hero-poster-side",
        { opacity: 0, scale: 0.9, x: 50 },
        { opacity: 1, scale: 1, x: 0, duration: 1.2, delay: 0.2, ease: "power3.out" }
      );
    }

    // Reveal animations for media rows
    const rows = gsap.utils.toArray(".reveal");
    rows.forEach((row) => {
      gsap.to(row, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: row,
          start: "top 92%",
          toggleActions: "play none none none"
        }
      });
    });
  }

  fetchRecommendations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/recommendations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      this.setState({ recommendations: res.data }, () => {
        this.initAnimations(); // Re-init after recommendations load
      });
    } catch (err) { console.error(err); }
  }

  showToast = (message, type = 'success') => this.setState({ toast: { message, type } });

  handleAddMovie = async (movieData) => {
    await this.props.addMovie(movieData);
    this.setState({ showAddModal: false });
    this.showToast(`${movieData.mediaType === 'series' ? 'TV Show' : 'Movie'} added!`);
  }

  startHeroRotation = () => {
    if (this.rotationTimer) clearInterval(this.rotationTimer);
    this.rotationTimer = setInterval(() => {
      this.rotateHero();
    }, 8000); // Rotate every 8 seconds
  }

  handleHeroDotClick = (index) => {
    if (index === this.state.activeHeroIndex) return;
    
    // Reset timer on manual click
    this.startHeroRotation();
    
    const featuredList = this.getFeaturedList();
    
    // Transition Out
    gsap.to([".hero-content", ".hero-poster-side", ".hero-bg-blur"], {
      opacity: 0,
      y: 10,
      duration: 0.5,
      ease: "power2.in",
      onComplete: () => {
        this.setState({ activeHeroIndex: index }, () => {
          // Transition In
          gsap.fromTo([".hero-content", ".hero-poster-side", ".hero-bg-blur"],
            { opacity: 0, y: -10 },
            { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: "power3.out" }
          );
        });
      }
    });
  }

  rotateHero = () => {
    const featuredList = this.getFeaturedList();
    if (featuredList.length <= 1) return;

    // Transition Out
    gsap.to([".hero-content", ".hero-poster-side", ".hero-bg-blur"], {
      opacity: 0,
      y: 10,
      duration: 0.6,
      ease: "sine.in",
      onComplete: () => {
        this.setState(prevState => ({
          activeHeroIndex: (prevState.activeHeroIndex + 1) % featuredList.length
        }), () => {
          // Transition In
          gsap.fromTo([".hero-content", ".hero-poster-side", ".hero-bg-blur"],
            { opacity: 0, y: -10 },
            { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: "expo.out" }
          );
        });
      }
    });
  }

  getFeaturedList() {
    const { movies } = this.props;
    const hasValidPoster = (m) => m.poster && m.poster !== 'N/A' && m.poster !== '';
    
    // Get high priority watchlist items first
    const highPri = movies.filter(m => m.status === 'watchlist' && m.priority === 'high' && hasValidPoster(m));
    if (highPri.length > 0) return highPri;
    
    // Fallback to all movies with valid posters
    const allWithPosters = movies.filter(hasValidPoster);
    return allWithPosters;
  }

  getFeaturedMovie() {
    const list = this.getFeaturedList();
    if (list.length === 0) return this.props.movies[0];
    return list[this.state.activeHeroIndex % list.length];
  }

  renderRow(title, items, path) {
    if (!items || items.length === 0) return null;

    return (
      <div className="media-row-container reveal" key={title}>
        <div className="row-header">
          <h3>{title}</h3>
          {path && <button className="btn-clear" onClick={() => this.props.navigate(path)}>View All</button>}
        </div>
        <div className="media-row">
          {items.map((movie, index) => (
            <MovieCard key={movie._id || index} movie={movie} index={index} />
          ))}
        </div>
      </div>
    );
  }

  render() {
    const { loading, navigate, movies } = this.props;
    const { showAddModal, toast, recommendations } = this.state;
    const featured = this.getFeaturedMovie();

    if (loading && movies.length === 0) {
      return <div className="loading-spinner"><div className="spinner" /><span>Loading your cinema...</span></div>;
    }

    const recentlyWatched = movies
      .filter(m => m.status === 'watched' && m.watchedOn)
      .sort((a, b) => new Date(b.watchedOn) - new Date(a.watchedOn))
      .slice(0, 10);

    const upNext = movies
      .filter(m => m.status === 'watchlist')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    const highRated = movies
      .filter(m => m.rating >= 8)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10);

    // Fallback for Discover Recommendations
    const discoveryItems = highRated.length > 0 ? highRated : [...movies].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);

    return (
      <div className="dashboard-page">
        {/* Full-Page Background (Fixed) */}
        <div className="hero-bg">
          <div
            className="hero-bg-blur"
            style={{ 
                backgroundImage: featured?.poster ? `url("${featured.poster}")` : 'none',
            }}
          />
        </div>

        {/* Floating Add Button for convenience */}
        <button
          className="btn btn-primary floating-add-btn bio-luminescent"
          onClick={() => this.setState({ showAddModal: true })}
          style={{ position: 'fixed', bottom: '40px', right: '40px', zIndex: 100, borderRadius: '50%', width: '60px', height: '60px', fontSize: '24px', padding: 0, justifyContent: 'center' }}
        >
          +
        </button>

        {/* Hero Section */}
        {featured && (
          <div className="hero-section" ref={this.heroRef}>
            <div className="hero-content">
              <span className="hero-tag">Featured {featured.mediaType === 'series' ? 'Series' : 'Movie'}</span>
              <h1 className="hero-title">{featured.title}</h1>
              <p className="hero-description">{featured.plot || featured.genre || 'Start watching your latest addition.'}</p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button className="btn btn-primary" onClick={() => navigate(`/movies/${featured._id}`)}>
                  View Details
                </button>
                <button 
                  className="btn btn-secondary glass-panel" 
                  onClick={() => this.setState({ showRecommendModal: true, selectedMedia: featured })}
                >
                  Recommend to Friend
                </button>
              </div>
            </div>

            <div className="hero-poster-side" onClick={() => navigate(`/movies/${featured._id}`)} style={{ cursor: 'pointer', position: 'relative' }}>
              <div 
                className="detail-poster-placeholder" 
                style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  textAlign: 'center', 
                  padding: '20px', 
                  background: '#0d1b31', 
                  borderRadius: 'inherit',
                  opacity: (featured.poster && featured.poster !== 'N/A') ? 0 : 1,
                  transition: 'opacity 0.3s ease'
                }}
              >
                <span style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</span>
                <div style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-display)', letterSpacing: '1px', textTransform: 'uppercase' }}>{featured.title}</div>
              </div>
              {featured.poster && featured.poster !== 'N/A' && (
                <img
                  src={featured.poster}
                  alt={featured.title}
                  style={{ position: 'relative', zIndex: 1, opacity: 1 }}
                  onLoad={(e) => {
                    e.target.style.opacity = '1';
                    const placeholder = e.target.parentElement.querySelector('.detail-poster-placeholder');
                    if (placeholder) placeholder.style.opacity = '0';
                  }}
                  onError={(e) => { 
                    e.target.style.opacity = '0'; 
                    const placeholder = e.target.parentElement.querySelector('.detail-poster-placeholder');
                    if (placeholder) placeholder.style.opacity = '1';
                  }}
                />
              )}
            </div>

            {/* Hero Pagination Dots */}
            {this.getFeaturedList().length > 1 && (
              <div className="hero-pagination">
                {this.getFeaturedList().map((_, i) => (
                  <button
                    key={i}
                    className={`hero-dot ${i === this.state.activeHeroIndex ? 'active' : ''}`}
                    onClick={() => this.handleHeroDotClick(i)}
                    title={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rows Layout */}
        <div style={{ padding: '0 4%', marginTop: '-40px', position: 'relative', zIndex: 10 }}>
          {/* 1. Friend Suggestions (Always Visible) */}
          <div className="media-row-container reveal">
            <div className="row-header">
              <h3>Friend Suggestions</h3>
              <button className="btn-clear" onClick={() => navigate('/friends')}>Social</button>
            </div>
            <div className="media-row">
              {recommendations.length > 0 ? (
                recommendations.map(rec => {
                  const existingInLibrary = movies.find(m => 
                    (rec.imdbID && m.imdbID === rec.imdbID) || 
                    (m.title.toLowerCase() === rec.mediaTitle.toLowerCase())
                  );
                  
                  return (
                    <MovieCard
                      key={rec._id.toString()}
                      movie={{
                        _id: existingInLibrary ? existingInLibrary._id.toString() : rec._id.toString(),
                        title: rec.mediaTitle,
                        poster: rec.poster,
                        genre: `From ${rec.sender.name}`,
                        mediaType: rec.mediaType,
                        imdbID: rec.imdbID,
                        isRecommendation: !existingInLibrary
                      }}
                    />
                  );
                })
              ) : (
                <div className="glass-panel" style={{ padding: '40px', borderRadius: 'var(--radius)', width: '100%', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)' }}>
                  Connect with friends to see their recommendations here!
                </div>
              )}
            </div>
          </div>


          {/* 3. Your Personal Lists */}
          {recentlyWatched.length > 0 && this.renderRow('Recently Watched', recentlyWatched, '/watched')}
          {upNext.length > 0 && this.renderRow('Jump Back In', upNext, '/watchlist')}
        </div>

        {showAddModal && (
          <AddMovieModal onSubmit={this.handleAddMovie} onClose={() => this.setState({ showAddModal: false })} />
        )}
        {this.state.showRecommendModal && this.state.selectedMedia && (
          <RecommendModal
            movie={this.state.selectedMedia}
            onClose={() => this.setState({ showRecommendModal: false, selectedMedia: null })}
            onRecommend={() => {
                this.setState({ showRecommendModal: false, selectedMedia: null });
                this.showToast("Recommendation sent!");
            }}
          />
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => this.setState({ toast: null })} />}
      </div>
    );
  }
}

const mapStateToProps = (state) => ({ movies: state.movies.items, loading: state.movies.loading });
const mapDispatchToProps = { fetchMovies, addMovie };
export default connect(mapStateToProps, mapDispatchToProps)(DashboardWrapper);
