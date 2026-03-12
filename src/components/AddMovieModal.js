import { Component } from 'react';
import { searchMoviesExternal, getMovieDetailsExternal } from '../services/movieService';

const GENRES = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller', 'Horror', 'Romance', 'Animation', 'Documentary', 'Fantasy', 'Crime', 'Mystery', 'Adventure', 'Biography', 'History'];

class AddMovieModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mediaType: 'movie',   // 'movie' | 'series'
      // Step 1: Search
      query: '',
      searching: false,
      searchError: '',
      // Step 2a: Search Results List
      searchResults: [],
      // Step 2b: Fetched movie details (Selected)
      fetchedMovie: null,
      // Step 2c: Manual fallback
      manualMode: false,
      manualTitle: '',
      manualGenre: 'Drama',
      manualYear: '',
      manualDirector: '',
      // User preferences
      status: 'watchlist',
      priority: 'medium',
      rating: '',
      review: '',
      watchedOn: ''
    };
  }

  handleQueryChange = (e) => {
    this.setState({ query: e.target.value, searchError: '', searchResults: [], fetchedMovie: null, manualMode: false });
  }

  handleSearch = async () => {
    const { query, mediaType } = this.state;
    if (!query.trim()) return;

    this.setState({ searching: true, searchError: '', searchResults: [], fetchedMovie: null, manualMode: false });
    try {
      const results = await searchMoviesExternal(query.trim(), mediaType);
      this.setState({ searchResults: results, searching: false });
    } catch (err) {
      this.setState({
        searching: false,
        searchError: err.message === 'NO_API_KEY' ? 'NO_API_KEY' : (err.message || 'Not found')
      });
    }
  }

  handleSelectMovie = async (movie) => {
    this.setState({ searching: true, searchError: '', searchResults: [] });
    try {
      const details = await getMovieDetailsExternal(movie.imdbID, movie.mediaType);
      this.setState({ fetchedMovie: details, searching: false });
    } catch (err) {
      this.setState({
        searching: false,
        searchError: `Failed to fetch details: ${err.message}`
      });
    }
  }

  handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); this.handleSearch(); }
  }

  handleChange = (e) => {
    const { name, value } = e.target;
    this.setState({ [name]: value });
  }

  handleSubmit = (e) => {
    e.preventDefault();
    const { fetchedMovie, manualMode, manualTitle, manualGenre, manualYear, manualDirector,
      mediaType, status, priority, rating, review, watchedOn } = this.state;

    if (manualMode) {
      if (!manualTitle.trim() || !manualGenre) return;
      const movieData = {
        title: manualTitle.trim(),
        genre: manualGenre,
        director: manualDirector.trim() || null,
        year: manualYear ? parseInt(manualYear) : null,
        poster: '',
        mediaType,
        status,
        priority,
        rating: status === 'watched' && rating ? parseInt(rating) : null,
        review: status === 'watched' ? review.trim() : '',
        watchedOn: status === 'watched' ? watchedOn || new Date().toISOString().split('T')[0] : null
      };
      this.props.onSubmit(movieData);
    } else {
      if (!fetchedMovie) return;
      const movieData = {
        title: fetchedMovie.title,
        genre: fetchedMovie.genre,
        director: fetchedMovie.director,
        year: parseInt(fetchedMovie.year) || null,
        poster: fetchedMovie.poster,
        mediaType,
        status,
        priority,
        rating: status === 'watched' && rating ? parseInt(rating) : null,
        review: status === 'watched' ? review.trim() : '',
        watchedOn: status === 'watched' ? watchedOn || new Date().toISOString().split('T')[0] : null
      };
      this.props.onSubmit(movieData);
    }
  }

  setMediaType = (type) => {
    this.setState({ mediaType: type, query: '', searchResults: [], fetchedMovie: null, searchError: '', manualMode: false });
  }

  render() {
    const { onClose } = this.props;
    const { mediaType, query, searching, searchError, searchResults, fetchedMovie,
      manualMode, manualTitle, manualGenre, manualYear, manualDirector,
      status, priority, rating, review, watchedOn } = this.state;

    const label = mediaType === 'series' ? 'TV Show' : 'Movie';
    const hasResult = fetchedMovie || manualMode;

    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: '540px' }}>
          <div className="modal-header">
            <h3>Add {label}</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          {/* Media Type Toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {['movie', 'series'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => this.setMediaType(type)}
                style={{
                  flex: 1, padding: '9px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                  border: `1px solid ${mediaType === type ? 'var(--accent)' : 'var(--border)'}`,
                  background: mediaType === type ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  color: mediaType === type ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
              >
                {type === 'movie' ? '🎬 Movie' : '📺 TV Show / Series'}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Search {label}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="form-input"
                value={query}
                onChange={this.handleQueryChange}
                onKeyDown={this.handleKeyDown}
                placeholder={`Type a ${label.toLowerCase()} title…`}
                style={{ flex: 1 }}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.handleSearch}
                disabled={searching || !query.trim()}
                style={{ whiteSpace: 'nowrap' }}
              >
                {searching ? '⏳' : '🔍'} {searching ? 'Searching…' : 'Search'}
              </button>
            </div>

            {/* Error states */}
            {searchError === 'NO_API_KEY' ? (
              <div style={{
                background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.35)',
                borderRadius: '10px', padding: '14px', marginTop: '8px', fontSize: '13px', lineHeight: '1.7'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>⚙️ OMDB API Key Required</div>
                <ol style={{ paddingLeft: '18px', margin: 0, color: 'var(--text-secondary)' }}>
                  <li>Get a free key at <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noreferrer" style={{ color: '#f5c518' }}>omdbapi.com</a></li>
                  <li>Add it to <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: '3px' }}>.env</code> as <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: '3px' }}>REACT_APP_OMDB_API_KEY=yourkey</code></li>
                  <li>Restart the dev server</li>
                </ol>
              </div>
            ) : searchError ? (
              <div style={{ marginTop: '10px' }}>
                <small style={{ color: '#ff6b6b', display: 'block', marginBottom: '8px' }}>
                  ⚠ {searchError} — enter details manually instead:
                </small>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => this.setState({ manualMode: true, manualTitle: query, searchError: '' })}
                >
                  ✏️ Add manually
                </button>
              </div>
            ) : null}
          </div>

          {/* Search Results List */}
          {searchResults.length > 0 && !fetchedMovie && !manualMode && (
            <div style={{
              maxHeight: '300px', overflowY: 'auto', marginBottom: '20px',
              border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-elevated)'
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Found {searchResults.length} results:
              </div>
              {searchResults.map(res => (
                <div
                  key={res.imdbID}
                  onClick={() => this.handleSelectMovie(res)}
                  style={{
                    display: 'flex', gap: '12px', padding: '10px 14px', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  className="search-result-item"
                >
                  {res.poster ? (
                    <img src={res.poster} alt={res.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <div style={{ width: '40px', height: '60px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      {mediaType === 'series' ? '📺' : '🎬'}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{res.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{res.year}</div>
                  </div>
                  <div style={{ color: 'var(--accent)', fontSize: '12px', alignSelf: 'center' }}>Select →</div>
                </div>
              ))}
              <div
                onClick={() => this.setState({ manualMode: true, manualTitle: query, searchResults: [] })}
                style={{ padding: '12px 14px', textAlign: 'center', cursor: 'pointer', fontSize: '13px', color: 'var(--accent)' }}
              >
                + None of these? Add manually
              </div>
            </div>
          )}

          {/* Fetched Movie Preview */}
          {fetchedMovie && !manualMode && (
            <div style={{
              display: 'flex', gap: '16px', padding: '14px', borderRadius: '10px',
              background: 'rgba(232, 197, 71, 0.05)', border: '1px solid var(--accent-dim)',
              marginBottom: '20px'
            }}>
              {fetchedMovie.poster ? (
                <img src={fetchedMovie.poster} alt={fetchedMovie.title} style={{ width: '72px', height: '107px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '72px', height: '107px', borderRadius: '6px', flexShrink: 0, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                  {mediaType === 'series' ? '📺' : '🎬'}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{fetchedMovie.title}</div>
                  <button
                    type="button"
                    onClick={() => this.setState({ fetchedMovie: null, searchResults: [] })}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Change
                  </button>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {fetchedMovie.year} · {fetchedMovie.genre}
                </div>
                {fetchedMovie.director && (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    🎬 {fetchedMovie.director}
                  </div>
                )}
                {fetchedMovie.plot && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {fetchedMovie.plot}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Entry Form */}
          {manualMode && (
            <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                ✏️ Enter details manually
              </div>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" value={manualTitle} onChange={(e) => this.setState({ manualTitle: e.target.value })} placeholder={`${label} title`} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Genre *</label>
                  <select className="form-input" value={manualGenre} onChange={(e) => this.setState({ manualGenre: e.target.value })}>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input className="form-input" type="number" value={manualYear} onChange={(e) => this.setState({ manualYear: e.target.value })} placeholder="2024" min="1900" max={new Date().getFullYear() + 2} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Director / Creator</label>
                <input className="form-input" value={manualDirector} onChange={(e) => this.setState({ manualDirector: e.target.value })} placeholder="Optional" />
              </div>
            </div>
          )}

          {/* User Preferences (shown only when there's a result) */}
          {hasResult && (
            <form onSubmit={this.handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" name="status" value={status} onChange={this.handleChange}>
                    <option value="watchlist">Watchlist</option>
                    <option value="watched">Already Watched</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-input" name="priority" value={priority} onChange={this.handleChange}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {status === 'watched' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Rating (1–10)</label>
                      <input className="form-input" type="number" name="rating" value={rating} onChange={this.handleChange} min="1" max="10" placeholder="8" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Watched On</label>
                      <input className="form-input" type="date" name="watchedOn" value={watchedOn} onChange={this.handleChange} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Review</label>
                    <textarea className="form-input" name="review" value={review} onChange={this.handleChange} placeholder="Your thoughts…" rows={3} />
                  </div>
                </>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add {label}</button>
              </div>
            </form>
          )}

          {/* Cancel only (no result yet) */}
          {!hasResult && (
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default AddMovieModal;
