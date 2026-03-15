import { Component, createRef } from 'react';
import { connect } from 'react-redux';
import { fetchMovies } from '../store/thunks';
import MovieCard from '../components/MovieCard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid
} from 'recharts';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const CHART_COLORS = ['#00f2ff', '#00ffcc', '#ff4d4d', '#70a1ff', '#eccc68', '#ff6b6b', '#a29bfe'];

class Analytics extends Component {
  constructor(props) {
    super(props);
    this.state = {
      activeTab: 'rating', // rating, genre, masterpiece, watchlist
      mediaType: 'all',    // all, movie, series
      localLoading: false
    };
    this.headerRef = createRef();
    this.cardsRef = createRef();
    this.contentRef = createRef();
  }

  componentDidMount() {
    if (this.props.movies.length === 0) {
      this.props.fetchMovies();
    }
    this.initAnimations();
    this.animateContentTransition(); // Animate initial tab
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.activeTab !== this.state.activeTab || prevState.mediaType !== this.state.mediaType) {
        this.animateContentTransition();
    }
  }

  initAnimations = () => {
    // Reveal header
    gsap.fromTo(this.headerRef.current, 
      { opacity: 0, y: -30 }, 
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }
    );

    // Stagger cards
    const cards = this.cardsRef.current.children;
    gsap.fromTo(cards, 
      { opacity: 0, scale: 0.9, y: 30 },
      { opacity: 1, scale: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'back.out(1.7)', delay: 0.2 }
    );

    // Parallax effect on cards hover is handled via CSS, 
    // but we can add a subtle scroll trigger for the whole grid
    gsap.to(this.cardsRef.current, {
      scrollTrigger: {
        trigger: this.cardsRef.current,
        start: "top bottom",
        end: "bottom top",
        scrub: 1
      },
      y: -20
    });
  }

  animateContentTransition = () => {
    const el = this.contentRef.current;
    if (!el) return;

    // Animate the container
    gsap.fromTo(el,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );

    // Specifically reveal elements with .reveal class
    const reveals = el.querySelectorAll('.reveal');
    if (reveals.length > 0) {
        gsap.fromTo(reveals,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out', delay: 0.1 }
        );
    }
  }

  getFilteredMovies(status = 'watched') {
    let list = this.props.movies.filter(m => m.status === status);
    if (this.state.mediaType !== 'all') {
      list = list.filter(m => m.mediaType === this.state.mediaType);
    }
    return list;
  }

  getGenreData() {
    const watched = this.getFilteredMovies('watched');
    const genreCount = {};
    watched.forEach(m => {
      genreCount[m.genre] = (genreCount[m.genre] || 0) + 1;
    });
    return Object.entries(genreCount)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);
  }

  getRatingData() {
    const watched = this.getFilteredMovies('watched');
    const dist = {};
    for (let i = 1; i <= 10; i++) dist[i] = 0;
    watched.filter(m => m.rating).forEach(m => { dist[m.rating]++; });
    return Object.entries(dist).map(([rating, count]) => ({ rating: `${rating}★`, count }));
  }

  getMonthlyData() {
    const watched = this.getFilteredMovies('watched').filter(m => m.watchedOn);
    const monthly = {};
    watched.forEach(m => {
      const date = new Date(m.watchedOn);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + 1;
    });
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, count]) => ({
        month: month.split('-')[1] + '/' + month.split('-')[0].slice(2),
        count
      }));
  }

  getSummaryStats() {
    const watched = this.getFilteredMovies('watched');
    const withRatings = watched.filter(m => m.rating);
    const avgRating = withRatings.length
      ? (withRatings.reduce((sum, m) => sum + m.rating, 0) / withRatings.length).toFixed(1)
      : '—';

    const genreData = this.getGenreData();
    const topGenre = genreData[0]?.genre || '—';
    const masterpieces = withRatings.filter(m => m.rating >= 9).length;
    const watchlist = this.getFilteredMovies('watchlist').length;

    return { avgRating, topGenre, masterpieces, watchlist, watchedCount: watched.length };
  }

  renderTabs() {
    const { mediaType } = this.state;
    return (
      <div className="analytics-media-tabs">
        {['all', 'movie', 'series'].map(type => (
          <button 
            key={type}
            className={`media-tab ${mediaType === type ? 'active' : ''}`}
            onClick={() => this.setState({ mediaType: type })}
          >
            {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
          </button>
        ))}
      </div>
    );
  }

  renderRatingContent() {
    const genreData = this.getGenreData();
    const ratingData = this.getRatingData();
    const monthlyData = this.getMonthlyData();
    
    return (
      <div className="analytics-content-grid">
        <div className="charts-grid-analytics">
          <div className="chart-card-premium glass-panel reveal">
            <h3>Rating Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ratingData}>
                <XAxis dataKey="rating" tick={{ fill: '#8892b0', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#112240', border: '1px solid #1d2d50', borderRadius: '12px' }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="chart-card-premium glass-panel reveal">
            <h3>Watching Velocity</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#233554" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#8892b0', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#112240', border: '1px solid #1d2d50', borderRadius: '12px' }} />
                <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={3} dot={{ fill: 'var(--accent)', r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  renderGenreContent() {
    const genreData = this.getGenreData();
    const stats = this.getSummaryStats();
    const itemsInTopGenre = this.getFilteredMovies('watched').filter(m => m.genre === stats.topGenre);

    return (
      <div className="analytics-sub-section">
        <div className="genre-analysis-header">
            <h3>Dominant Taste: <span className="highlight-text">{stats.topGenre}</span></h3>
            <div className="genre-chart-mini">
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie data={genreData} dataKey="count" nameKey="genre" innerRadius={60} outerRadius={80} paddingAngle={5}>
                            {genreData.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
        
        <div className="movie-grid-premium">
            {itemsInTopGenre.map(movie => <MovieCard key={movie._id} movie={movie} />)}
        </div>
      </div>
    );
  }

  renderMasterpieceContent() {
    const masterpieces = this.getFilteredMovies('watched').filter(m => m.rating >= 9);
    return (
      <div className="analytics-sub-section">
        <div className="section-intro">
            <h3>The Hall of Fame</h3>
            <p>Your highest rated cinematic experiences ({masterpieces.length} titles)</p>
        </div>
        <div className="movie-grid-premium">
            {masterpieces.length > 0 ? (
                masterpieces.map(movie => <MovieCard key={movie._id} movie={movie} />)
            ) : (
                <div className="empty-state-mini">No 9+ ratings yet. Keep watching!</div>
            )}
        </div>
      </div>
    );
  }

  renderWatchlistContent() {
    const watchlist = this.getFilteredMovies('watchlist');
    return (
      <div className="analytics-sub-section">
        <div className="section-intro">
            <h3>Upcoming Adventures</h3>
            <p>{watchlist.length} items waiting to be experienced</p>
        </div>
        <div className="movie-grid-premium">
            {watchlist.map(movie => <MovieCard key={movie._id} movie={movie} />)}
        </div>
      </div>
    );
  }

  render() {
    const { loading } = this.props;
    const { activeTab } = this.state;
    const stats = this.getSummaryStats();

    if (loading && this.props.movies.length === 0) {
      return (
        <div className="loading-spinner">
          <div className="spinner" />
          <span>Loading analytics...</span>
        </div>
      );
    }

    return (
      <div className="container-fluid analytics-page-premium">
        <div className="analytics-glow" />
        <div className="page-header-premium" ref={this.headerRef}>
          <div className="badge-premium">INSIGHTS</div>
          <h2>CineAnalytics <span className="logo-dot">.</span></h2>
          <p>A deep dive into your cinematic journey</p>
        </div>

        {/* Clickable Stat Cards */}
        <div className="stats-grid-interactive" ref={this.cardsRef}>
          <div 
            className={`stat-card-premium ${activeTab === 'rating' ? 'active accent' : ''}`}
            onClick={() => this.setState({ activeTab: 'rating' })}
          >
            <div className="stat-icon">⭐</div>
            <div className="stat-label">Avg Rating</div>
            <div className="stat-value">{stats.avgRating}</div>
            <div className="stat-sub">Across {stats.watchedCount} views</div>
            <div className="active-indicator" />
          </div>

          <div 
            className={`stat-card-premium ${activeTab === 'genre' ? 'active' : ''}`}
            onClick={() => this.setState({ activeTab: 'genre' })}
          >
            <div className="stat-icon">🎭</div>
            <div className="stat-label">Top Genre</div>
            <div className="stat-value">{stats.topGenre}</div>
            <div className="stat-sub">Most explored</div>
            <div className="active-indicator" />
          </div>

          <div 
            className={`stat-card-premium ${activeTab === 'masterpiece' ? 'active' : ''}`}
            onClick={() => this.setState({ activeTab: 'masterpiece' })}
          >
            <div className="stat-icon">🏆</div>
            <div className="stat-label">Masterpieces</div>
            <div className="stat-value">{stats.masterpieces}</div>
            <div className="stat-sub">Rated 9+</div>
            <div className="active-indicator" />
          </div>

          <div 
            className={`stat-card-premium ${activeTab === 'watchlist' ? 'active' : ''}`}
            onClick={() => this.setState({ activeTab: 'watchlist' })}
          >
            <div className="stat-icon">⏳</div>
            <div className="stat-label">Watchlist</div>
            <div className="stat-value">{stats.watchlist}</div>
            <div className="stat-sub">To be watched</div>
            <div className="active-indicator" />
          </div>
        </div>

        <div className="analytics-main-container">
            <div className="analytics-controls">
                {this.renderTabs()}
            </div>

            <div className="analytics-dynamic-content" ref={this.contentRef}>
                {activeTab === 'rating' && this.renderRatingContent()}
                {activeTab === 'genre' && this.renderGenreContent()}
                {activeTab === 'masterpiece' && this.renderMasterpieceContent()}
                {activeTab === 'watchlist' && this.renderWatchlistContent()}
            </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  movies: state.movies.items,
  loading: state.movies.loading
});

export default connect(mapStateToProps, { fetchMovies })(Analytics);
