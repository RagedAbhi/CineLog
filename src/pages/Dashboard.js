import React, { Component, createRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchMovies, addMovie, fetchRecommendations } from '../store/thunks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
      selectedMedia: null,
      isEditingOrder: false,
      sectionOrder: ['recent_movies', 'recent_shows', 'watchlist']
    };
    this.heroRef = createRef();
    this.rotationTimer = null;
    this.rowRefs = {};
  }

  componentDidMount() {
    if (this.props.movies.length === 0) this.props.fetchMovies();
    this.props.fetchRecommendations();
    this.initAnimations();
    this.startHeroRotation();
    this.loadSectionOrder();
  }

  loadSectionOrder = () => {
    const saved = localStorage.getItem('dashboard_section_order');
    if (saved) {
      try {
        let order = JSON.parse(saved);
        this.setState({ sectionOrder: order });
      } catch (e) {
        console.error("Failed to load section order", e);
      }
    }
  }

  saveSectionOrder = () => {
    localStorage.setItem('dashboard_section_order', JSON.stringify(this.state.sectionOrder));
    this.setState({ isEditingOrder: false });
    this.showToast("Dashboard layout saved!");
  }

  moveSection = (index, direction) => {
    const newOrder = [...this.state.sectionOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    this.setState({ sectionOrder: newOrder });
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

  // fetchRecommendations moved to Redux thunk

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

  handleHeroNav = (direction) => {
    const featuredList = this.getFeaturedList();
    if (featuredList.length <= 1) return;

    let nextIndex;
    if (direction === 'next') {
        nextIndex = (this.state.activeHeroIndex + 1) % featuredList.length;
    } else {
        nextIndex = (this.state.activeHeroIndex - 1 + featuredList.length) % featuredList.length;
    }

    // Reset timer on manual click
    this.startHeroRotation();
    
    // Transition Out
    gsap.to([".hero-content", ".hero-poster-side", ".hero-bg-blur"], {
      opacity: 0,
      y: 10,
      duration: 0.5,
      ease: "power2.in",
      onComplete: () => {
        this.setState({ activeHeroIndex: nextIndex }, () => {
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
  
  scrollRow = (sectionId, direction) => {
    const row = this.rowRefs[sectionId];
    if (!row) return;

    const scrollAmount = row.clientWidth * 0.8;
    row.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
    });
  }



  renderRow(title, items, path, id, index) {
    const { isEditingOrder, sectionOrder } = this.state;
    if ((!items || items.length === 0) && !isEditingOrder) return null;

    return (
      <div className={`media-row-container ${isEditingOrder ? 'editing' : 'reveal'}`} key={id}>
        {isEditingOrder && (
          <div className="section-edit-controls">
            <button 
              className="btn-edit-move" 
              onClick={() => this.moveSection(index, -1)}
              disabled={index === 0}
            >
              ↑
            </button>
            <button 
              className="btn-edit-move" 
              onClick={() => this.moveSection(index, 1)}
              disabled={index === sectionOrder.length - 1}
            >
              ↓
            </button>
            <div className="section-label-edit">{title}</div>
          </div>
        )}
        <div className="row-header">
          <h3>{title}</h3>
          {path && !isEditingOrder && <button className="btn-clear" onClick={() => this.props.navigate(path)}>View All</button>}
        </div>
        
        <div className="media-row-wrapper" style={{ position: 'relative' }}>
          {!isEditingOrder && items && items.length > 5 && (
            <>
              <button 
                className="carousel-nav-btn prev" 
                onClick={() => this.scrollRow(id, 'left')}
                title="Scroll Left"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                className="carousel-nav-btn next" 
                onClick={() => this.scrollRow(id, 'right')}
                title="Scroll Right"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
          
          <div className="media-row" ref={el => this.rowRefs[id] = el}>
            {items && items.length > 0 ? (
              items.map((movie, index) => (
                <MovieCard key={movie._id || index} movie={movie} index={index} isDashboard={true} />
              ))
            ) : (
               <div className="empty-row-placeholder">No items to show here.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { loading, navigate, movies, recommendations } = this.props;
    const { showAddModal, toast } = this.state;
    const featured = this.getFeaturedMovie();

    if (loading && movies.length === 0) {
      return <div className="loading-spinner"><div className="spinner" /><span>Loading your cinema...</span></div>;
    }

    const recentlyWatchedMovies = movies
      .filter(m => m.status === 'watched' && m.watchedOn && (m.mediaType === 'movie' || !m.mediaType))
      .sort((a, b) => new Date(b.watchedOn) - new Date(a.watchedOn))
      .filter((m, i, arr) => {
        const titleKey = `${m.title?.toLowerCase().trim()}|${m.mediaType || 'movie'}|${m.year || ''}`;
        return arr.findIndex(x => (x.imdbID && x.imdbID === m.imdbID) || (`${x.title?.toLowerCase().trim()}|${x.mediaType || 'movie'}|${x.year || ''}` === titleKey)) === i;
      })
      .slice(0, 10);

    const recentlyWatchedShows = movies
      .filter(m => m.status === 'watched' && m.watchedOn && m.mediaType === 'series')
      .sort((a, b) => new Date(b.watchedOn) - new Date(a.watchedOn))
      .filter((m, i, arr) => {
        const titleKey = `${m.title?.toLowerCase().trim()}|${m.mediaType || 'movie'}|${m.year || ''}`;
        return arr.findIndex(x => (x.imdbID && x.imdbID === m.imdbID) || (`${x.title?.toLowerCase().trim()}|${x.mediaType || 'movie'}|${x.year || ''}` === titleKey)) === i;
      })
      .slice(0, 10);

    const watchlistItems = movies
      .filter(m => m.status === 'watchlist')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .filter((m, i, arr) => {
        const titleKey = `${m.title?.toLowerCase().trim()}|${m.mediaType || 'movie'}|${m.year || ''}`;
        const key = m.imdbID || titleKey;
        return arr.findIndex(x => (x.imdbID && x.imdbID === m.imdbID) || (`${x.title?.toLowerCase().trim()}|${x.mediaType || 'movie'}|${x.year || ''}` === titleKey)) === i;
      })
      .slice(0, 15);

    return (
      <div className="dashboard-page">
        <Helmet>
          <title>Dashboard | Cuerates — Your Movie Journal</title>
          <meta name="description" content="Explore your recently watched movies, trending TV shows, and personalized recommendations on Cuerates." />
          <meta property="og:title" content="Cuerates Dashboard" />
          <meta property="og:description" content="Your personal cinema vault and social movie journal." />
          <meta property="og:type" content="website" />
        </Helmet>
        {/* Hero Background has been removed to allow global cinematic canvas to shine through */}

        <div className="dashboard-actions-float">
          <button
            className="btn btn-primary floating-add-btn bio-luminescent"
            onClick={() => this.setState({ showAddModal: true })}
          >
            +
          </button>
        </div>

        {/* Hero Section */}
        {featured && (
          <div className="hero-section" ref={this.heroRef}>
            <div className="hero-content">
              <span className="hero-tag">Featured {featured.mediaType === 'series' ? 'Series' : 'Movie'}</span>
              <h1 className="hero-title">{featured.title}</h1>
              <p className="hero-description">{featured.plot || `${featured.genre} · ${featured.director !== 'N/A' ? `Directed by ${featured.director}` : 'Start watching your latest addition.'}`}</p>
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

            {this.getFeaturedList().length > 1 && (
              <>
                <button className="hero-nav-btn-side prev glass-panel" onClick={() => this.handleHeroNav('prev')}><ChevronLeft size={32} /></button>
                <button className="hero-nav-btn-side next glass-panel" onClick={() => this.handleHeroNav('next')}><ChevronRight size={32} /></button>
              </>
            )}
          </div>
        )}

        {/* Dynamic Rows Layout */}
        <div style={{ padding: '0 4%', marginTop: '-40px', position: 'relative', zIndex: 10 }}>
          {this.state.sectionOrder.map((sectionId, index) => {
            switch (sectionId) {

              case 'recent_movies':
                return this.renderRow('Recently Watched Movies', recentlyWatchedMovies, '/watched', 'recent_movies', index);
              case 'recent_shows':
                return this.renderRow('Recently Watched TV Shows', recentlyWatchedShows, '/watched', 'recent_shows', index);
              case 'watchlist':
                return this.renderRow('My Watchlist', watchlistItems, '/watchlist', 'watchlist', index);


              default:
                return null;
            }
          })}
        </div>

        {!this.state.isEditingOrder && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '60px 0 40px' }}>
            <button
              className="btn btn-secondary edit-layout-btn glass-panel"
              onClick={() => this.setState({ isEditingOrder: true })}
              style={{ padding: '12px 32px', borderRadius: '30px', fontSize: '15px' }}
            >
              ⚙️ Edit Home Layout
            </button>
          </div>
        )}

        {this.state.isEditingOrder && (
          <div className="edit-mode-footer-bar glass-panel bio-luminescent">
            <span>Rearrange your home sections using the arrows.</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => this.setState({ isEditingOrder: false, sectionOrder: JSON.parse(localStorage.getItem('dashboard_section_order') || '["recent_movies", "recent_shows", "watchlist", "expertise_stats"]') })}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={this.saveSectionOrder}>
                Save Changes
              </button>
            </div>
          </div>
        )}

        {showAddModal && <AddMovieModal onSubmit={this.handleAddMovie} onClose={() => this.setState({ showAddModal: false })} />}
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

const mapStateToProps = (state) => ({ 
    movies: state.movies.items, 
    loading: state.movies.loading,
    recommendations: state.auth.recommendations 
});
const mapDispatchToProps = { fetchMovies, addMovie, fetchRecommendations };
export default connect(mapStateToProps, mapDispatchToProps)(DashboardWrapper);
