import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/thunks';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { User, List, LogOut, LayoutDashboard, Film, Tv, Users, BarChart3 } from 'lucide-react';

import GlobalSearch from './GlobalSearch';

const Topbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user } = useSelector(state => state.auth);
    const { scrollY } = useScroll();

    const [scrolled, setScrolled] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = scrollY.getPrevious();
        if (latest > previous && latest > 150) {
            setHidden(true);
        } else {
            setHidden(false);
        }
    });

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const onLogout = () => {
        dispatch(logout());
        navigate('/auth');
    };

    const navItems = [
        { path: '/', label: 'Home', icon: LayoutDashboard, end: true },
        { path: '/movies-list', label: 'Movies', icon: Film },
        { path: '/tvshows', label: 'Shows', icon: Tv },
        { path: '/friends', label: 'Social', icon: Users },
        { path: '/analytics', label: 'Stats', icon: BarChart3 },
    ];

    const isMovieDetail = location.pathname.startsWith('/movies/') && location.pathname !== '/movies-list';

    if (isMovieDetail) return null;

    return (
        <motion.header 
            className={`topbar-premium ${scrolled ? 'scrolled' : ''}`}
            variants={{
                visible: { y: 0 },
                hidden: { y: '-100%' },
            }}
            animate={hidden ? 'hidden' : 'visible'}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
        >
            <div className="topbar-inner">
                {/* Left: Logo */}
                <NavLink to="/" className="topbar-logo-premium">
                    CINELOG<span className="logo-dot">.</span>
                </NavLink>

                {/* Center-Left: Search */}
                <div className="topbar-search-container">
                    <GlobalSearch />
                </div>

                {/* Center: Nav */}
                <nav className="topnav-premium">
                    {navItems.map((item) => (
                        <NavLink 
                            key={item.path} 
                            to={item.path} 
                            end={item.end}
                            className={({ isActive }) => `nav-item-premium ${isActive ? 'active' : ''}`}
                        >
                            <item.icon className="nav-icon" size={18} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Right: Actions */}
                <div className="topbar-actions-premium" ref={dropdownRef}>
                    <div 
                        className={`profile-trigger ${dropdownOpen ? 'active' : ''}`}
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                        <div className="avatar-wrapper">
                            <span className="avatar-icon">👤</span>
                        </div>
                        <span className="user-name-compact">{user?.name || user?.username || 'Profile'}</span>
                    </div>

                    <AnimatePresence>
                        {dropdownOpen && (
                            <motion.div 
                                className="profile-dropdown-menu"
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                                <div className="dropdown-header">
                                    <p className="user-email-small">{user?.email}</p>
                                </div>
                                <div className="dropdown-divider" />
                                
                                <NavLink to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                                    <User size={16} />
                                    <span>My Profile</span>
                                </NavLink>
                                
                                <NavLink to="/watchlist" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                                    <List size={16} />
                                    <span>Watchlist</span>
                                </NavLink>
                                
                                <div className="dropdown-divider" />
                                
                                <button className="dropdown-item logout" onClick={onLogout}>
                                    <LogOut size={16} />
                                    <span>Log out</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.header>
    );
};

export default Topbar;
