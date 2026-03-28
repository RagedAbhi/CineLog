import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchMovies } from '../store/thunks';
import MovieCard from '../components/MovieCard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, Trophy, Clock, Film, 
  TrendingUp, Tv, Search, Star 
} from 'lucide-react';
import '../styles/AnalyticsRedesign.css';

const CHART_COLORS = ['#00f2ff', '#00ffcc', '#ff4d4d', '#70a1ff', '#eccc68', '#ff6b6b', '#a29bfe'];

// Sub-components for better organization
const StatCard = ({ title, value, subtitle, icon: Icon, delay = 0, isActive = false, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    onClick={onClick}
    className={`redesign-stat-card ${isActive ? 'active' : ''}`}
  >
    <div className="stat-card-glow" />
    <div className="stat-card-inner">
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        <Icon className={`stat-card-icon ${isActive ? 'active' : 'inactive'}`} />
      </div>
      <div className="stat-card-value-container">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-subtitle">{subtitle}</div>
      </div>
    </div>
    {isActive && (
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        className="stat-card-indicator"
      />
    )}
  </motion.div>
);

const Analytics = () => {
  const dispatch = useDispatch();
  const { items: movies, loading } = useSelector(state => state.movies);
  const [activeTab, setActiveTab] = useState('rating');
  const [mediaType, setMediaType] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState(null);

  useEffect(() => {
    if (movies.length === 0) {
      dispatch(fetchMovies());
    }
  }, [dispatch, movies.length]);

  // Data processing logic
  const filteredMovies = useMemo(() => {
    return movies.filter(m => {
      const typeMatch = mediaType === 'all' || m.mediaType === mediaType;
      return typeMatch;
    });
  }, [movies, mediaType]);

  const watchedMovies = useMemo(() => filteredMovies.filter(m => m.status === 'watched'), [filteredMovies]);
  const watchlistMovies = useMemo(() => filteredMovies.filter(m => m.status === 'watchlist'), [filteredMovies]);

  const stats = useMemo(() => {
    const withRatings = watchedMovies.filter(m => m.rating);
    const avgRating = withRatings.length
      ? (withRatings.reduce((sum, m) => sum + m.rating, 0) / withRatings.length).toFixed(1)
      : '—';

    // Genre count
    const genreCount = {};
    watchedMovies.forEach(m => {
      genreCount[m.genre] = (genreCount[m.genre] || 0) + 1;
    });
    const sortedGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);
    const topGenre = sortedGenres[0]?.[0] || '—';

    const masterpieces = withRatings.filter(m => m.rating >= 9).length;
    const watchlistCount = watchlistMovies.length;

    return { avgRating, topGenre, masterpieces, watchlistCount, watchedCount: watchedMovies.length, sortedGenres };
  }, [watchedMovies, watchlistMovies]);

  useEffect(() => {
    if (stats.topGenre !== '—' && !selectedGenre) {
      setSelectedGenre(stats.topGenre);
    }
  }, [stats.topGenre, selectedGenre]);

  const ratingData = useMemo(() => {
    const dist = {};
    for (let i = 1; i <= 10; i++) dist[i] = 0;
    watchedMovies.filter(m => m.rating).forEach(m => { dist[Math.round(m.rating)]++; });
    return Object.entries(dist).map(([rating, count]) => ({ rating: `${rating}★`, count }));
  }, [watchedMovies]);

  const genrePieData = useMemo(() => {
    return stats.sortedGenres.map(([genre, count]) => ({ name: genre, value: count }));
  }, [stats.sortedGenres]);

  const genreBreakdown = useMemo(() => {
    const total = watchedMovies.length;
    return stats.sortedGenres.slice(0, 6).map(([genre, count]) => ({
      genre,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }));
  }, [stats.sortedGenres, watchedMovies.length]);

  if (loading && movies.length === 0) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <span>Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="container-fluid analytics-redesign-container">
      <div className="analytics-header">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="analytics-title"
        >
          Analytics Dashboard
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="analytics-subtitle"
        >
          Explore your cinematic journey through data and insights
        </motion.p>
      </div>

      {/* Interactive Stats Cards */}
      <div className="stats-grid-redesign">
        <StatCard
          title="Avg Rating"
          value={stats.avgRating}
          subtitle={`Across ${stats.watchedCount} views`}
          icon={BarChart3}
          delay={0.1}
          isActive={activeTab === 'rating'}
          onClick={() => setActiveTab('rating')}
        />
        <StatCard
          title="Top Genre"
          value={stats.topGenre}
          subtitle="Explore your favorites"
          icon={Film}
          delay={0.2}
          isActive={activeTab === 'genre'}
          onClick={() => setActiveTab('genre')}
        />
        <StatCard
          title="Your Masterpieces"
          value={stats.masterpieces}
          subtitle="Best movies & series"
          icon={Trophy}
          delay={0.3}
          isActive={activeTab === 'topPicks'}
          onClick={() => setActiveTab('topPicks')}
        />
        <StatCard
          title="Watchlist"
          value={stats.watchlistCount}
          subtitle="Movies to watch"
          icon={Clock}
          delay={0.4}
          isActive={activeTab === 'watchlist'}
          onClick={() => setActiveTab('watchlist')}
        />
      </div>

      {/* Media Type Filter */}
      <div className="flex gap-2 mb-8 justify-center">
        {['all', 'movie', 'series'].map(type => (
          <button
            key={type}
            onClick={() => setMediaType(type)}
            className={`filter-btn-redesign ${mediaType === type ? 'active' : 'inactive'}`}
          >
            {type === 'all' ? 'All Media' : type === 'movie' ? 'Movies' : 'TV Shows'}
          </button>
        ))}
      </div>

      {/* Dynamic Content Area */}
      <AnimatePresence mode="wait">
        {activeTab === 'rating' && (
          <motion.div
            key="rating"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel-redesign">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-xl text-white">Rating Distribution</h2>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="rating" stroke="#ffffff60" />
                    <YAxis stroke="#ffffff60" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#112240', 
                        border: '1px solid #1d2d50',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Bar dataKey="count" fill="var(--accent)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-panel-redesign">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-xl text-white">Genre Breakdown</h2>
                </div>
                <div className="space-y-4">
                  {genreBreakdown.map((item, index) => (
                    <div key={item.genre} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/80">{item.genre}</span>
                        <span className="text-white/60">{item.percentage}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.percentage}%` }}
                          transition={{ duration: 1, delay: index * 0.1 }}
                          className="progress-bar-fill"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'genre' && (
          <motion.div
            key="genre"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="glass-panel-redesign">
              <h2 className="text-xl text-white mb-4">Explore by Genre</h2>
              <div className="flex flex-wrap gap-2">
                {stats.sortedGenres.map(([genre]) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`genre-badge-redesign ${selectedGenre === genre ? 'active' : ''}`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel-redesign">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl text-white">{selectedGenre} Collection</h2>
                <span className="text-white/60 text-sm">
                  {watchedMovies.filter(m => m.genre === selectedGenre).length} items
                </span>
              </div>
              <div className="results-grid-redesign">
                {watchedMovies.filter(m => m.genre === selectedGenre).map((movie, index) => (
                  <motion.div
                    key={movie._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="redesign-item-card"
                  >
                    <div className="redesign-item-poster">
                      <img src={movie.poster} alt={movie.title} />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h3 className="text-white text-lg line-clamp-1">{movie.title}</h3>
                        <p className="text-sm text-white/50">{movie.year}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm text-white">{movie.rating}</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {movie.mediaType === 'series' ? 'TV Series' : 'Movie'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'topPicks' && (
          <motion.div
            key="topPicks"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="analytics-content-area"
          >
            <div className="top-picks-grid">
              <div className="glass-panel-redesign">
                <div className="section-header-redesign">
                  <div className="icon-box-redesign">
                    <Film className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="section-title-redesign">Masterpiece Movies</h2>
                    <p className="section-subtitle-redesign">Your highest rated films</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {watchedMovies
                    .filter(m => m.mediaType !== 'series')
                    .sort((a, b) => b.rating - a.rating)
                    .slice(0, 5)
                    .map((movie, index) => (
                      <motion.div 
                        key={movie._id} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="top-pick-row"
                      >
                        <div className={`rank-badge ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}`}>
                          {index < 3 ? <Trophy className="w-6 h-6" /> : <span>{index + 1}</span>}
                        </div>
                        <div className="top-pick-poster">
                          <img src={movie.poster} alt={movie.title} />
                        </div>
                        <div className="top-pick-info">
                          <h3 className="top-pick-title">{movie.title}</h3>
                          <div className="top-pick-meta">
                            <span>{movie.year}</span>
                            <span>•</span>
                            <span>{movie.genre}</span>
                          </div>
                        </div>
                        <div className="rating-badge-small">
                          <Star className="w-4 h-4 fill-yellow-400" />
                          <span>{movie.rating}</span>
                        </div>
                      </motion.div>
                    ))}
                </div>
              </div>

              <div className="glass-panel-redesign">
                <div className="section-header-redesign">
                  <div className="icon-box-redesign">
                    <Tv className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="section-title-redesign">Masterpiece Series</h2>
                    <p className="section-subtitle-redesign">Your highest rated shows</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {watchedMovies
                    .filter(m => m.mediaType === 'series')
                    .sort((a, b) => b.rating - a.rating)
                    .slice(0, 5)
                    .map((movie, index) => (
                      <motion.div 
                        key={movie._id} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="top-pick-row"
                      >
                        <div className={`rank-badge ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}`}>
                          {index < 3 ? <Trophy className="w-6 h-6" /> : <span>{index + 1}</span>}
                        </div>
                        <div className="top-pick-poster">
                          <img src={movie.poster} alt={movie.title} />
                        </div>
                        <div className="top-pick-info">
                          <h3 className="top-pick-title">{movie.title}</h3>
                          <div className="top-pick-meta">
                            <span>{movie.year}</span>
                            <span>•</span>
                            <span>{movie.genre}</span>
                          </div>
                        </div>
                        <div className="rating-badge-small">
                          <Star className="w-4 h-4 fill-yellow-400" />
                          <span>{movie.rating}</span>
                        </div>
                      </motion.div>
                    ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'watchlist' && (
          <motion.div
            key="watchlist"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="glass-panel-redesign">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl text-white">Watchlist Insights</h2>
                <p className="text-sm text-white/50">{watchlistMovies.length} items waiting</p>
              </div>
              <div className="watchlist-grid-redesign">
                {watchlistMovies.slice(0, 10).map((movie) => (
                  <MovieCard key={movie._id} movie={movie} />
                ))}
              </div>
              {watchlistMovies.length > 10 && (
                <div className="mt-8 text-center">
                  <p className="text-white/30 italic">...and {watchlistMovies.length - 10} more in your collection</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Analytics;
