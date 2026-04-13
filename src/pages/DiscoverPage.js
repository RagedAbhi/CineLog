import React, { Component } from 'react';
import { connect } from 'react-redux';
import MovieCard from '../components/MovieCard';
import axios from 'axios';
import config from '../config';
import { fetchMovies } from '../store/thunks';
import { showToast } from '../store/actions';
import gsap from 'gsap';

class DiscoverPage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            recommendations: [],
            loading: true,
            error: null,
            feedGeneratedAt: null
        };
        this.headerRef = React.createRef();
        this.gridRef = React.createRef();
    }

    async componentDidMount() {
        if (this.props.movies.length === 0) {
            await this.props.fetchMovies();
        }
        this.generateFeed();
        
        // Initial entry animation for header
        gsap.fromTo(this.headerRef.current, 
            { opacity: 0, y: -20 }, 
            { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
        );
    }

    componentDidUpdate(prevProps) {
        // Regenerate if the user adds/removes items significantly changing library
        if (prevProps.movies.length !== this.props.movies.length) {
            const hasGenerated = this.state.feedGeneratedAt !== null;
            if (hasGenerated && Date.now() - this.state.feedGeneratedAt > 60000 * 5) {
                // If feed is older than 5 minutes, silently refresh
                this.generateFeed(true);
            }
        }
    }

    generateFeed = async (silent = false) => {
        if (!silent) this.setState({ loading: true, error: null });
        
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${config.API_URL}/api/search/discover`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const recs = res.data;
            this.setState({ 
                recommendations: recs, 
                loading: false,
                feedGeneratedAt: Date.now()
            }, () => {
                // Grid staggered animation mapping
                if (!silent && this.gridRef.current) {
                    gsap.fromTo(this.gridRef.current.children, 
                        { opacity: 0, y: 30 },
                        { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: "back.out(1.2)" }
                    );
                }
            });
        } catch (error) {
            console.error("Discovery engine failed:", error);
            this.setState({ loading: false, error: "Failed to generate your personalized feed." });
            this.props.showToast("Personalization engine encountered an error", "error");
        }
    }

    render() {
        const { recommendations, loading, error } = this.state;
        const { movies } = this.props;

        const hasLibrary = movies && movies.length > 0;

        return (
            <div className="collection-page discover-page">
                <div className="page-header" ref={this.headerRef} style={{ marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                            <h2>Trending Now</h2>
                            <p className="page-subtitle" style={{ color: '#999', fontSize: '0.95rem' }}>
                                The most popular global movies and shows this week.
                            </p>
                        </div>
                        <button 
                            className="primary-btn" 
                            onClick={() => this.generateFeed(false)} 
                            disabled={loading}
                            style={{ 
                                padding: '8px 16px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                background: 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spin' : ''}><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                            Refresh
                        </button>
                    </div>
                </div>

                {loading && (
                    <div className="loading-state" style={{ height: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <div className="spinner" style={{ width: '50px', height: '50px', border: '3px solid rgba(255,165,0,0.1)', borderTopColor: '#f39c12', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <h3 style={{ marginTop: '20px', color: '#fff', letterSpacing: '0.5px' }}>Scanning the Globe...</h3>
                        <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '8px' }}>Fetching the hottest movies and TV shows.</p>
                    </div>
                )}

                {!loading && error && (
                    <div className="empty-state">
                        <div className="empty-icon">⚠️</div>
                        <h3>Algorithm Offline</h3>
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && recommendations.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">🎉</div>
                        <h3>You've watched everything!</h3>
                        <p>Our engine couldn't find any trending items you haven't already seen or added.</p>
                    </div>
                )}

                {!loading && !error && recommendations.length > 0 && (
                    <div className="movie-grid discover-grid" ref={this.gridRef}>
                        {recommendations.map(movie => (
                            <MovieCard 
                                key={movie.id} 
                                movie={{
                                    ...movie,
                                    isExternal: true,
                                    imdbID: movie.imdbID || String(movie.id)
                                }} 
                            />
                        ))}
                    </div>
                )}
                <style>{`
                    .discover-grid {
                        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)) !important;
                        gap: 16px !important;
                    }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    movies: state.movies.items || state.movies
});

const mapDispatchToProps = {
    fetchMovies,
    showToast
};

export default connect(mapStateToProps, mapDispatchToProps)(DiscoverPage);
