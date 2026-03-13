import { Component } from 'react';
import { connect } from 'react-redux';
import { fetchMovies } from '../store/thunks';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid
} from 'recharts';

const CHART_COLORS = ['#e8c547', '#47e88a', '#e84747', '#4788e8', '#e847c8', '#47c8e8', '#c8e847'];

class Analytics extends Component {
  componentDidMount() {
    if (this.props.movies.length === 0) {
      this.props.fetchMovies();
    }
  }

  getWatchedMovies() {
    return this.props.movies.filter(m => m.status === 'watched');
  }

  // Genre distribution
  getGenreData() {
    const watched = this.getWatchedMovies();
    const genreCount = {};
    watched.forEach(m => {
      genreCount[m.genre] = (genreCount[m.genre] || 0) + 1;
    });
    return Object.entries(genreCount)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);
  }

  // Rating distribution
  getRatingData() {
    const watched = this.getWatchedMovies();
    const dist = {};
    for (let i = 1; i <= 10; i++) dist[i] = 0;
    watched.filter(m => m.rating).forEach(m => { dist[m.rating]++; });
    return Object.entries(dist).map(([rating, count]) => ({ rating: `${rating}★`, count }));
  }

  // Monthly watching activity
  getMonthlyData() {
    const watched = this.getWatchedMovies().filter(m => m.watchedOn);
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

  // Top films
  getTopFilms() {
    return this.getWatchedMovies()
      .filter(m => m.rating)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);
  }

  // Summary stats
  getSummaryStats() {
    const watched = this.getWatchedMovies();
    const withRatings = watched.filter(m => m.rating);
    const avgRating = withRatings.length
      ? (withRatings.reduce((sum, m) => sum + m.rating, 0) / withRatings.length).toFixed(1)
      : '—';

    const genreData = this.getGenreData();
    const topGenre = genreData[0]?.genre || '—';
    const masterpieces = withRatings.filter(m => m.rating >= 9).length;
    const watchlist = this.props.movies.filter(m => m.status === 'watchlist').length;

    return { avgRating, topGenre, masterpieces, watchlist };
  }

  customTooltipStyle = {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 13
  }

  render() {
    const { loading } = this.props;

    if (loading && this.props.movies.length === 0) {
      return (
        <div className="loading-spinner">
          <div className="spinner" />
          <span>Loading analytics...</span>
        </div>
      );
    }

    const watched = this.getWatchedMovies();
    if (watched.length === 0) {
      return (
        <div>
          <div className="page-header"><h2>Analytics</h2></div>
          <div className="empty-state">
            <div className="empty-icon">◉</div>
            <h3>No data yet</h3>
            <p>Watch and log some films to see your taste analytics</p>
          </div>
        </div>
      );
    }

    const stats = this.getSummaryStats();
    const genreData = this.getGenreData();
    const ratingData = this.getRatingData();
    const monthlyData = this.getMonthlyData();
    const topFilms = this.getTopFilms();

    return (
      <div className="container-fluid">
        <div className="page-header">
          <h2>Analytics</h2>
          <p>Your taste in cinema, visualized</p>
        </div>

        {/* Summary */}
        <div className="stats-grid" style={{ marginBottom: 32 }}>
          <div className="stat-card accent">
            <div className="stat-label">Avg Rating</div>
            <div className="stat-value">{stats.avgRating}</div>
            <div className="stat-sub">across {watched.length} films</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Top Genre</div>
            <div className="stat-value" style={{ fontSize: 28 }}>{stats.topGenre}</div>
            <div className="stat-sub">most watched</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Masterpieces</div>
            <div className="stat-value">{stats.masterpieces}</div>
            <div className="stat-sub">rated 9 or above</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Still to Watch</div>
            <div className="stat-value">{stats.watchlist}</div>
            <div className="stat-sub">in watchlist</div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="charts-grid">
          {/* Genre Bar Chart */}
          <div className="chart-card">
            <h3>Films by Genre</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={genreData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="genre" tick={{ fill: '#8888aa', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={this.customTooltipStyle}
                  cursor={{ fill: 'rgba(232,197,71,0.05)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {genreData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Rating Distribution */}
          <div className="chart-card">
            <h3>Rating Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ratingData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="rating" tick={{ fill: '#8888aa', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={this.customTooltipStyle}
                  cursor={{ fill: 'rgba(232,197,71,0.05)' }}
                />
                <Bar dataKey="count" fill="#e8c547" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="charts-grid">
          {/* Monthly Activity */}
          {monthlyData.length > 1 && (
            <div className="chart-card">
              <h3>Monthly Activity</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#2a2a3a" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: '#8888aa', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={this.customTooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#e8c547"
                    strokeWidth={2}
                    dot={{ fill: '#e8c547', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Genre Pie */}
          <div className="chart-card">
            <h3>Genre Breakdown</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={genreData}
                  dataKey="count"
                  nameKey="genre"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                >
                  {genreData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={this.customTooltipStyle} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Films */}
        <div className="chart-card" style={{ marginTop: 0 }}>
          <h3 style={{ marginBottom: 20 }}>Your Top Films</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topFilms.map((movie, index) => (
              <div key={movie.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '12px 16px',
                background: 'var(--bg-elevated)',
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: index === 0 ? 'var(--accent-dim)' : 'var(--bg)',
                  color: index === 0 ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: 18, flexShrink: 0
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{movie.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {movie.genre} · {movie.year} · {movie.director}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--accent)' }}>
                  {movie.rating}
                </div>
              </div>
            ))}
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
