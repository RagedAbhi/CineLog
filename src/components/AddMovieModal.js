import { Component } from 'react';
import axios from 'axios';
import CineSelect from './CineSelect';
import { searchMoviesExternal, getMovieDetailsExternal as getMovieDetails } from '../services/movieService';

const GENRES = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller', 'Horror', 'Romance', 'Animation', 'Documentary', 'Fantasy', 'Crime', 'Mystery', 'Adventure', 'Biography', 'History'];

class AddMovieModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mediaType: props.initialData?.mediaType || props.defaultType || 'movie',
      // Step 1: Search
      query: props.initialData?.title || '',
      searching: false,
      searchError: '',
      // Step 2a: Search Results List
      searchResults: [],
      // Step 2b: Fetched movie details (Selected)
      fetchedMovie: props.initialData ? {
        title: props.initialData.title,
        mediaType: props.initialData.mediaType,
        poster: props.initialData.poster,
        imdbID: props.initialData.imdbID,
        genre: 'Loading...', // Will be updated by getMovieDetails if needed, or we just keep it
        year: ''
      } : null,
      // Step 2c: Manual fallback
      manualMode: false,
      manualTitle: '',
      manualGenre: 'Drama',
      manualYear: '',
      manualDirector: '',
      // User preferences
      status: 'watchlist',
      rating: '',
      review: ''
    };
  }

  async componentDidMount() {
    document.body.classList.add('modal-open');
    if (this.props.initialData && this.props.initialData.imdbID) {
        this.fetchDetails(this.props.initialData.imdbID, this.props.initialData.mediaType);
    }
  }

  componentWillUnmount() {
    document.body.classList.remove('modal-open');
  }

  fetchDetails = async (imdbID, mediaType) => {
    this.setState({ searching: true });
    try {
      const details = await getMovieDetails(imdbID, mediaType);
      this.setState({ fetchedMovie: details, searching: false });
    } catch (err) {
      this.setState({ searching: false, searchError: `Details fetch failed: ${err.message}` });
    }
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

  handleSelectMovie = (movie) => {
    this.props.onClose();
    // Navigate to detail page. If it's a new movie, the detail page handles it via 'external=true'
    // We use window.location or a passed navigate prop. Since this is a class component, 
    // it's better to use a prop or just window.location.
    // Actually, AddMovieModal is often used in Dashboard which has access to navigate.
    // I'll check if navigate is passed, if not I'll use window.location.
    const url = `/movies/${movie.imdbID}?external=true`;
    window.location.href = url; 
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
      mediaType, status, rating, review } = this.state;

    const movieData = manualMode ? {
      title: manualTitle.trim(),
      genre: manualGenre,
      year: manualYear,
      director: manualDirector,
      poster: '',
      mediaType,
      status,
      rating: status === 'watched' && rating ? parseInt(rating) : null,
      review: status === 'watched' ? review.trim() : '',
      watchedOn: status === 'watched' ? new Date().toISOString().split('T')[0] : null
    } : {
      title: fetchedMovie.title,
      genre: fetchedMovie.genre,
      year: fetchedMovie.year,
      director: fetchedMovie.director,
      poster: fetchedMovie.poster,
      imdbID: fetchedMovie.imdbID,
      mediaType: fetchedMovie.mediaType,
      status,
      rating: status === 'watched' && rating ? parseInt(rating) : null,
      review: status === 'watched' ? review.trim() : '',
      watchedOn: status === 'watched' ? new Date().toISOString().split('T')[0] : null
    };

    if (!movieData.title) return;
    this.props.onSubmit(movieData);
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
            <h3>Add to Library</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>          <div className="modal-body" data-lenis-prevent style={{ overflowX: 'visible', paddingBottom: '120px' }}>
            {/* 1. Loading State */}
            {searching && !searchResults.length && !fetchedMovie && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <div style={{ color: 'var(--text-muted)' }}>Fetching details...</div>
              </div>
            )}

            {/* 2. Search Bar (only if no result yet) */}
            {!hasResult && !searching && (
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Search Movies or Shows</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="form-input"
                    value={query}
                    onChange={this.handleQueryChange}
                    onKeyDown={this.handleKeyDown}
                    placeholder="Type a title…"
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
                    🔍 Search
                  </button>
                </div>

                {searchError === 'NO_API_KEY' ? (
                  <div style={{
                    background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.35)',
                    borderRadius: '10px', padding: '14px', marginTop: '8px', fontSize: '13px', lineHeight: '1.7'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>⚙️ OMDB API Key Required</div>
                    <ol style={{ paddingLeft: '18px', margin: 0, color: 'var(--text-secondary)' }}>
                      <li>Get a free key at <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noreferrer" style={{ color: '#f5c518' }}>omdbapi.com</a></li>
                      <li>Add key to <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 4px' }}>.env</code> as <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 4px' }}>REACT_APP_OMDB_API_KEY</code></li>
                    </ol>
                  </div>
                ) : searchError ? (
                  <div style={{ marginTop: '10px' }}>
                    <small style={{ color: '#ff6b6b', display: 'block', marginBottom: '8px' }}>⚠ {searchError}</small>
                    <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => this.setState({ manualMode: true, manualTitle: query, searchError: '' })}>
                      ✏️ Add manually
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* 3. Search Results (only if no result yet) */}
            {!hasResult && searchResults.length > 0 && (
              <div style={{
                maxHeight: '400px', overflowY: 'auto', marginBottom: '20px',
                border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-elevated)'
              }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Found {searchResults.length} results:
                </div>
                {searchResults.map(res => (
                  <div key={res.imdbID} onClick={() => this.handleSelectMovie(res)} className="search-result-item" style={{ display: 'flex', gap: '12px', padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                    <img src={res.poster || 'https://via.placeholder.com/150'} alt="poster" style={{ width: '40px', height: '60px', borderRadius: '4px', objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>{res.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{res.year} • {res.mediaType}</div>
                    </div>
                  </div>
                ))}
                <div onClick={() => this.setState({ manualMode: true, manualTitle: query, searchResults: [] })} style={{ padding: '12px 14px', textAlign: 'center', cursor: 'pointer', fontSize: '13px', color: 'var(--accent)' }}>
                  + None of these? Add manually
                </div>
              </div>
            )}

            {/* 4. The Form (Manual Entry or Preferences) */}
            {hasResult && (
              <form onSubmit={this.handleSubmit}>
                {manualMode && (
                  <div style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', marginBottom: '24px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>✏️ Manual Entry</div>
                    <div className="form-group">
                      <label className="form-label">Title *</label>
                      <input className="form-input" value={manualTitle} onChange={(e) => this.setState({ manualTitle: e.target.value })} required />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                      <CineSelect
                        label="Genre"
                        options={GENRES.map(g => ({ value: g, label: g }))}
                        value={manualGenre}
                        onChange={(val) => this.setState({ manualGenre: val })}
                      />
                    </div>
                      <div className="form-group">
                        <label className="form-label">Year</label>
                        <input className="form-input" type="number" value={manualYear} onChange={(e) => this.setState({ manualYear: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}

                {fetchedMovie && (
                   <div style={{ 
                    display: 'flex', gap: '20px', padding: '16px', background: 'var(--bg-elevated)', 
                    borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '24px' 
                  }}>
                    <img src={fetchedMovie.poster} alt="poster" style={{ width: '70px', height: '100px', borderRadius: '8px', objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>{fetchedMovie.title}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{fetchedMovie.year} • {fetchedMovie.mediaType}</div>
                      <button type="button" onClick={() => this.setState({ fetchedMovie: null, searchResults: [] })} style={{ color: 'var(--accent)', fontSize: '12px', background: 'none', border: 'none', padding: 0, marginTop: '8px', cursor: 'pointer' }}>Change</button>
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <CineSelect
                      label="Status"
                      options={[
                        { value: 'watchlist', label: 'Watchlist' },
                        { value: 'watched', label: 'Watched' }
                      ]}
                      value={status}
                      onChange={(val) => this.setState({ status: val })}
                    />
                  </div>
                  {status === 'watched' && (
                    <div className="form-group">
                      <label className="form-label">Rating (1-10)</label>
                      <input className="form-input" type="number" min="1" max="10" value={rating} onChange={(e) => this.setState({ rating: e.target.value })} />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Note / Review</label>
                  <textarea className="form-input" value={review} onChange={(e) => this.setState({ review: e.target.value })} rows={3} />
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Add to Library</button>
                </div>
              </form>
            )}

            {!hasResult && !searching && searchResults.length === 0 && (
              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={onClose}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default AddMovieModal;
