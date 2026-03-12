import { Component } from 'react';
import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchMovies, addMovie } from '../store/thunks';
import AddMovieModal from '../components/AddMovieModal';
import Toast from '../components/Toast';

function DashboardWrapper(props) {
  const navigate = useNavigate();
  return <Dashboard {...props} navigate={navigate} />;
}

class Dashboard extends Component {
  constructor(props) {
    super(props);
    this.state = { showAddModal: false, toast: null };
  }

  componentDidMount() {
    if (this.props.movies.length === 0) this.props.fetchMovies();
  }

  showToast = (message, type = 'success') => this.setState({ toast: { message, type } });

  handleAddMovie = async (movieData) => {
    await this.props.addMovie(movieData);
    this.setState({ showAddModal: false });
    this.showToast(`${movieData.mediaType === 'series' ? 'TV Show' : 'Movie'} added!`);
  }

  getStats() {
    const { movies } = this.props;
    const totalMovies = movies.filter(m => !m.mediaType || m.mediaType === 'movie').length;
    const totalSeries = movies.filter(m => m.mediaType === 'series').length;
    const watched = movies.filter(m => m.status === 'watched').length;
    const watchlist = movies.filter(m => m.status === 'watchlist').length;
    return { totalMovies, totalSeries, watched, watchlist };
  }

  getRecentlyWatched() {
    return this.props.movies
      .filter(m => m.status === 'watched' && m.watchedOn)
      .sort((a, b) => new Date(b.watchedOn) - new Date(a.watchedOn))
      .slice(0, 5);
  }

  getHighPriorityWatchlist() {
    return this.props.movies
      .filter(m => m.status === 'watchlist')
      .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))
      .slice(0, 5);
  }

  render() {
    const { loading, navigate } = this.props;
    const { showAddModal, toast } = this.state;
    const stats = this.getStats();
    const recentlyWatched = this.getRecentlyWatched();
    const upNext = this.getHighPriorityWatchlist();

    if (loading && this.props.movies.length === 0) {
      return <div className="loading-spinner"><div className="spinner" /><span>Loading your cinema...</span></div>;
    }

    const statCards = [
      { label: 'Movies', value: stats.totalMovies, sub: 'in your collection', icon: '🎬', path: '/movies-list', accent: true },
      { label: 'TV Shows', value: stats.totalSeries, sub: 'series tracked', icon: '📺', path: '/tvshows' },
      { label: 'Watched', value: stats.watched, sub: 'titles completed', icon: '✦', path: '/watched' },
      { label: 'Watchlist', value: stats.watchlist, sub: 'to watch next', icon: '◎', path: '/watchlist' },
    ];

    return (
      <div>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Dashboard</h2>
            <p>Your personal cinema at a glance</p>
          </div>
          <button className="btn btn-primary" onClick={() => this.setState({ showAddModal: true })}>
            + Add Title
          </button>
        </div>

        {/* Interactive Stat Cards */}
        <div className="stats-grid">
          {statCards.map(card => (
            <div
              key={card.label}
              className={`stat-card clickable ${card.accent ? 'accent' : ''}`}
              onClick={() => navigate(card.path)}
              title={`Go to ${card.label}`}
            >
              <div className="stat-label">{card.icon} {card.label}</div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-sub">{card.sub}</div>
              <div className="stat-arrow">→</div>
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* Recently Watched */}
          <div>
            <div className="section-header">
              <h3>Recently Watched</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/watched')}>See all</button>
            </div>
            {recentlyWatched.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎬</div>
                <h3>Nothing watched yet</h3>
                <p>Start watching and logging!</p>
              </div>
            ) : (
              <div className="recent-list">
                {recentlyWatched.map(movie => (
                  <div key={movie.id} className="recent-item" onClick={() => navigate(`/movies/${movie.id}`)}>
                    {movie.poster
                      ? <img src={movie.poster} alt={movie.title} onError={(e) => e.target.style.display = 'none'} />
                      : <div style={{ width: 36, height: 54, background: 'var(--bg-elevated)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{movie.mediaType === 'series' ? '📺' : '🎬'}</div>
                    }
                    <div className="recent-item-info">
                      <div className="recent-item-title">{movie.title}</div>
                      <div className="recent-item-meta">{movie.genre} · {movie.watchedOn}</div>
                    </div>
                    {movie.rating && <div className="recent-item-rating">★ {movie.rating}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Up Next */}
          <div>
            <div className="section-header">
              <h3>Up Next</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/watchlist')}>See all</button>
            </div>
            {upNext.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◎</div>
                <h3>Watchlist is empty</h3>
                <p>Add titles you want to watch!</p>
              </div>
            ) : (
              <div className="recent-list">
                {upNext.map(movie => (
                  <div key={movie.id} className="recent-item" onClick={() => navigate(`/movies/${movie.id}`)}>
                    {movie.poster
                      ? <img src={movie.poster} alt={movie.title} onError={(e) => e.target.style.display = 'none'} />
                      : <div style={{ width: 36, height: 54, background: 'var(--bg-elevated)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{movie.mediaType === 'series' ? '📺' : '🎬'}</div>
                    }
                    <div className="recent-item-info">
                      <div className="recent-item-title">{movie.title}</div>
                      <div className="recent-item-meta">{movie.genre} · {movie.year}</div>
                    </div>
                    <span className={`priority-badge priority-${movie.priority}`}>{movie.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showAddModal && (
          <AddMovieModal onSubmit={this.handleAddMovie} onClose={() => this.setState({ showAddModal: false })} />
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => this.setState({ toast: null })} />}
      </div>
    );
  }
}

const mapStateToProps = (state) => ({ movies: state.movies.items, loading: state.movies.loading });
const mapDispatchToProps = { fetchMovies, addMovie };
export default connect(mapStateToProps, mapDispatchToProps)(DashboardWrapper);
