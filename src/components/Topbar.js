import { Component } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../store/thunks';

import GlobalSearch from './GlobalSearch';

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
            scrolled: false
        };
    }

    componentDidMount() {
        window.addEventListener('scroll', this.handleScroll);
    }

    componentWillUnmount() {
        window.removeEventListener('scroll', this.handleScroll);
    }

    handleScroll = () => {
        const isScrolled = window.scrollY > 20;
        if (isScrolled !== this.state.scrolled) {
            this.setState({ scrolled: isScrolled });
        }
    }

    render() {
        const { onLogout } = this.props;
        const { scrolled } = this.state;

        return (
            <header className={`topbar-minimal ${scrolled ? 'scrolled' : ''}`}>
                <div className="topbar-inner">
                    {/* Left: Logo */}
                    <NavLink to="/" className="topbar-logo-minimal">
                        CINELOG <span className="logo-dot">.</span>
                    </NavLink>

                    <GlobalSearch />

                    {/* Center: Nav */}
                    <nav className="topnav-minimal">
                        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            Home
                        </NavLink>
                        <NavLink to="/movies-list" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            Movies
                        </NavLink>
                        <NavLink to="/tvshows" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            Shows
                        </NavLink>
                        <NavLink to="/friends" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            Social
                        </NavLink>
                        <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            Stats
                        </NavLink>
                    </nav>

                    {/* Right: Actions */}
                    <div className="topbar-actions">
                        <NavLink to="/profile" className="action-btn" title="Profile">
                            <span className="icon-simple">👤</span>
                        </NavLink>
                        <button className="action-btn logout" onClick={onLogout} title="Logout">
                            <span className="icon-simple">🚪</span>
                        </button>
                    </div>
                </div>
            </header>
        );
    }
}

export default TopbarWrapper;
