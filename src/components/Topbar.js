import { Component } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../store/thunks';

function TopbarWrapper(props) {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const onLogout = () => {
        dispatch(logout());
        navigate('/auth');
    };
    return <Topbar {...props} navigate={navigate} onLogout={onLogout} />;
}

class Topbar extends Component {
    constructor(props) {
        super(props);
        this.state = {
            searchOpen: false,
            searchQuery: '',
            scrolled: false
        };
        this.searchRef = null;
    }

    componentDidMount() {
        window.addEventListener('scroll', this.handleScroll);
    }

    componentWillUnmount() {
        window.removeEventListener('scroll', this.handleScroll);
    }

    handleScroll = () => {
        const isScrolled = window.scrollY > 50;
        if (isScrolled !== this.state.scrolled) {
            this.setState({ scrolled: isScrolled });
        }
    }

    toggleSearch = () => {
        this.setState(s => ({ searchOpen: !s.searchOpen, searchQuery: '' }), () => {
            if (this.state.searchOpen && this.searchRef) this.searchRef.focus();
        });
    }

    handleSearchKeyDown = (e) => {
        if (e.key === 'Escape') this.setState({ searchOpen: false, searchQuery: '' });
    }

    render() {
        const { onSearchChange, searchQuery: externalQuery, onLogout } = this.props;
        const { searchOpen, scrolled } = this.state;

        return (
            <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
                {/* Logo */}
                <NavLink to="/" className="topbar-logo">CINELOG</NavLink>

                {/* Center Nav */}
                <nav className="topnav">
                    <NavLink to="/" end className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}>
                        Home
                    </NavLink>
                    <NavLink to="/movies-list" className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}>
                        Movies
                    </NavLink>
                    <NavLink to="/tvshows" className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}>
                        TV Shows
                    </NavLink>
                    <NavLink to="/friends" className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}>
                        Friends
                    </NavLink>
                    <NavLink to="/analytics" className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}>
                        Analytics
                    </NavLink>
                </nav>

                {/* Right: Search + Profile + Logout */}
                <div className="topbar-right">
                    <div className={`search-bar-wrapper ${searchOpen ? 'open' : ''}`}>
                        {searchOpen && (
                            <input
                                ref={r => this.searchRef = r}
                                className="topbar-search-input"
                                placeholder="Search movies & shows…"
                                value={externalQuery || ''}
                                onChange={e => onSearchChange && onSearchChange(e.target.value)}
                                onKeyDown={this.handleSearchKeyDown}
                            />
                        )}
                        <button className="topbar-icon-btn" onClick={this.toggleSearch} title="Search">
                            {searchOpen ? '✕' : '🔍'}
                        </button>
                    </div>

                    <NavLink to="/profile" className="topbar-icon-btn" title="Profile" style={{ fontSize: '20px' }}>
                        👤
                    </NavLink>

                    <button className="topbar-icon-btn" onClick={onLogout} title="Logout" style={{ marginLeft: '8px' }}>
                        🚪
                    </button>
                </div>
            </header>
        );
    }
}

export default TopbarWrapper;
