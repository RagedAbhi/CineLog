import { Component } from 'react';
import { connect } from 'react-redux';
import { fetchMovies, addMovie, deleteMovie } from '../store/thunks';
import { setFilter, setSearch, clearFilters } from '../store/actions';
import MovieCard from '../components/MovieCard';
import AddMovieModal from '../components/AddMovieModal';
import CineSelect from '../components/CineSelect';
import Toast from '../components/Toast';

const GENRES = ['all', 'Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller', 'Horror', 'Romance', 'Animation', 'Documentary', 'Fantasy', 'Crime', 'Mystery', 'Adventure', 'Biography'];

class TVShowsPage extends Component {
    constructor(props) {
        super(props);
        this.state = { showAddModal: false, toast: null, statusFilter: 'all' };
    }

    componentDidMount() {
        if (this.props.movies.length === 0) this.props.fetchMovies();
        this.props.clearFilters();
    }

    handleAddShow = async (movieData) => {
        await this.props.addMovie(movieData);
        this.setState({ showAddModal: false, toast: { message: 'TV Show added!', type: 'success' } });
    }

    getFiltered() {
        const { movies, filters } = this.props;
        const { statusFilter } = this.state;
        let list = movies.filter(m => m.mediaType === 'series');

        if (statusFilter !== 'all') {
            list = list.filter(m => m.status === statusFilter);
        }

        if (filters.search) {
            const q = filters.search.toLowerCase();
            list = list.filter(m => m.title.toLowerCase().includes(q) || (m.director && m.director.toLowerCase().includes(q)));
        }
        if (filters.genre !== 'all') list = list.filter(m => m.genre === filters.genre);
        return list;
    }

    render() {
        const { loading, filters } = this.props;
        const { showAddModal, toast, statusFilter } = this.state;
        const filtered = this.getFiltered();

        return (
            <div className="container-fluid">
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2>TV Shows</h2>
                        <p>{filtered.length} show{filtered.length !== 1 ? 's' : ''} shown</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => this.setState({ showAddModal: true })}>+ Add TV Show</button>
                </div>

                <div className="filters-bar">
                    <input className="search-input" placeholder="Search TV shows…" value={filters.search} onChange={(e) => this.props.setSearch(e.target.value)} />

                    <div className="filter-toggle-group">
                        <button 
                            className={`filter-toggle-btn ${statusFilter === 'all' ? 'active' : ''}`}
                            onClick={() => this.setState({ statusFilter: 'all' })}
                        >
                            All
                        </button>
                        <button 
                            className={`filter-toggle-btn ${statusFilter === 'watchlist' ? 'active' : ''}`}
                            onClick={() => this.setState({ statusFilter: 'watchlist' })}
                        >
                            Watchlist
                        </button>
                        <button 
                            className={`filter-toggle-btn ${statusFilter === 'watched' ? 'active' : ''}`}
                            onClick={() => this.setState({ statusFilter: 'watched' })}
                        >
                            Watched
                        </button>
                    </div>

                    <div style={{ width: '180px' }}>
                        <CineSelect
                            options={GENRES.map(g => ({ value: g, label: g === 'all' ? 'All Genres' : g }))}
                            value={filters.genre}
                            onChange={(val) => this.props.setFilter('genre', val)}
                            placeholder="Genre"
                        />
                    </div>
                    {(filters.search || filters.genre !== 'all') && (
                        <button className="btn-clear" onClick={this.props.clearFilters}>Clear filters</button>
                    )}
                </div>

                {loading && this.props.movies.length === 0 ? (
                    <div className="loading-spinner"><div className="spinner" /><span>Loading shows...</span></div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📺</div>
                        <h3>No TV shows found</h3>
                        <p>Add some TV shows to get started!</p>
                    </div>
                ) : (
                    <div className="movie-grid">
                        {filtered.map(show => <MovieCard key={show._id} movie={show} />)}
                    </div>
                )}

                {showAddModal && <AddMovieModal onSubmit={this.handleAddShow} onClose={() => this.setState({ showAddModal: false })} defaultType="series" />}
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => this.setState({ toast: null })} />}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ movies: state.movies.items, loading: state.movies.loading, filters: state.filters });
const mapDispatchToProps = { fetchMovies, addMovie, deleteMovie, setFilter, setSearch, clearFilters };
export default connect(mapStateToProps, mapDispatchToProps)(TVShowsPage);
