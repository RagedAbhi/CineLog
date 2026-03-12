import { Component } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

function TopbarWrapper(props) {
    const navigate = useNavigate();
    return <Topbar {...props} navigate={navigate} />;
}

class Topbar extends Component {
    constructor(props) {
        super(props);
        this.state = {
            searchOpen: false,
            searchQuery: ''
        };
        this.searchRef = null;
    }

    toggleSearch = () => {
        this.setState(s => ({ searchOpen: !s.searchOpen, searchQuery: '' }), () => {
            if (this.state.searchOpen && this.searchRef) this.searchRef.focus();
        });
    }

    handleSearchKeyDown = (e) => {
        if (e.key === 'Escape') this.setState({ searchOpen: false, searchQuery: '' });
        if (e.key === 'Enter' && this.state.searchQuery.trim()) {
            this.setState({ searchOpen: false, searchQuery: '' });
        }
    }

    render() {
        const { onSearchChange, searchQuery: externalQuery } = this.props;
        const { searchOpen } = this.state;

        return (
            <header className="topbar">
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
                    <NavLink to="/analytics" className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}>
                        Analytics
                    </NavLink>
                </nav>

                {/* Right: Search icon */}
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
                </div>
            </header>
        );
    }
}

export default TopbarWrapper;
