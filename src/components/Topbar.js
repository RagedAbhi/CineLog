import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/thunks';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { User, List, LogOut, LayoutDashboard, Film, Tv, Users, Puzzle, Sparkles, Gamepad2, Clapperboard, Download } from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import CueratesLogo from './CueratesLogo';
import VideoPlayerModal from './VideoPlayerModal';
import config from '../config';

const Topbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user, recommendations, unreadMessages } = useSelector(state => state.auth);
    const { scrollY } = useScroll();

    const [scrolled, setScrolled] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const dropdownRef = useRef(null);
    const [showJoinInput, setShowJoinInput] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joinRoomId, setJoinRoomId] = useState(null);
    const joinInputRef = useRef(null);

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
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
        };
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
        { path: '/discover', label: 'Discover', icon: Sparkles },
        { path: '/friends', label: 'Social', icon: Users },
    ];

    const isMovieDetail = location.pathname.startsWith('/movies/') && location.pathname !== '/movies-list';

    if (isMovieDetail) return null;

    return (
        <>
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
                <div className="topbar-left">
                    <NavLink to="/" className="hover:opacity-80 transition-opacity">
                        <CueratesLogo layout="horizontal" size={40} />
                    </NavLink>
                </div>

                {/* Center: Search */}
                {!isMobile && (
                    <div className="topbar-center">
                        <GlobalSearch />
                    </div>
                )}

                {/* Right: Nav & Profile */}
                <div className="topbar-right">
                    {!isMobile && (
                        <nav className="topnav-premium">
                            {navItems.map((item) => {
                                const recs = recommendations || user?.recommendations || [];
                                const unreadRecs = recs.filter(r => {
                                    const receiverId = (r.receiver?._id || r.receiver)?.toString();
                                    const currentUserId = (user?._id || user?.id)?.toString();
                                    return receiverId === currentUserId && !r.read;
                                }).length;
                                
                                const unreadMsgCount = unreadMessages?.length || 0;
                                const totalUnreadSocial = unreadRecs + unreadMsgCount;

                                return (
                                    <NavLink 
                                        key={item.path} 
                                        to={item.path} 
                                        end={item.end}
                                        className={({ isActive }) => `nav-item-premium ${isActive ? 'active' : ''}`}
                                    >
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <item.icon className="nav-icon" size={18} />
                                            {item.label === 'Social' && totalUnreadSocial > 0 && (
                                                <span className="dot-notification-nav">{totalUnreadSocial}</span>
                                            )}
                                        </div>
                                        <span>{item.label}</span>
                                    </NavLink>
                                );
                            })}
                        </nav>
                    )}

                    <div className="topbar-actions-premium" ref={dropdownRef}>

                        {/* Join Stream */}
                        {!isMobile && (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => { setShowJoinInput(!showJoinInput); setTimeout(() => joinInputRef.current?.focus(), 100); }}
                                    title="Join a Stream Together session"
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.1)', color: '#a855f7', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s' }}
                                >
                                    <Clapperboard size={14} />
                                    Join Stream
                                </button>
                                {showJoinInput && (
                                    <div style={{ position: 'absolute', top: '110%', right: 0, background: 'rgba(11,9,28,0.97)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 12, padding: 12, zIndex: 40000, minWidth: 220, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                                        <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enter Room Code</p>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <input
                                                ref={joinInputRef}
                                                value={joinCode}
                                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                                onKeyDown={e => { if (e.key === 'Enter' && joinCode.trim()) { setJoinRoomId(joinCode.trim()); setShowJoinInput(false); setJoinCode(''); } }}
                                                placeholder="e.g. AB12CD"
                                                maxLength={8}
                                                style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: '0.82rem', fontFamily: 'monospace', letterSpacing: 2, outline: 'none' }}
                                            />
                                            <button
                                                onClick={() => { if (joinCode.trim()) { setJoinRoomId(joinCode.trim()); setShowJoinInput(false); setJoinCode(''); } }}
                                                style={{ background: '#a855f7', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
                                            >Join</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div 
                            className={`profile-trigger ${dropdownOpen ? 'active' : ''}`}
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                            <div className="avatar-wrapper" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {user?.profilePicture ? (
                                    <img src={user.profilePicture} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <span className="avatar-icon">👤</span>
                                )}
                            </div>
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

                                    <NavLink to="/addons" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                                        <Puzzle size={16} />
                                        <span>Addons</span>
                                    </NavLink>

                                    {!config.IS_ELECTRON && (
                                        <a
                                            href={config.DESKTOP_APP_URL}
                                            className="dropdown-item"
                                            onClick={() => setDropdownOpen(false)}
                                        >
                                            <Download size={16} />
                                            <span>Desktop App</span>
                                        </a>
                                    )}
                                    
                                    <button className="dropdown-item logout" onClick={onLogout}>
                                        <LogOut size={16} />
                                        <span>Log out</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </motion.header>

        {/* Guest stream join modal */}
        {joinRoomId && (
            <VideoPlayerModal
                url={null}
                stream={null}
                title="Stream Together"
                roomId={joinRoomId}
                onClose={() => setJoinRoomId(null)}
            />
        )}

        {/* Mobile Bottom Navigation (Moved outside header to handle fixed positioning better) */}
        <AnimatePresence>
            {isMobile && (
                <motion.nav 
                    className="mobile-nav-premium"
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                >
                    {navItems.map((item) => {
                        const recs = recommendations || user?.recommendations || [];
                        const unreadRecs = recs.filter(r => {
                            const receiverId = (r.receiver?._id || r.receiver)?.toString();
                            const currentUserId = (user?._id || user?.id)?.toString();
                            return receiverId === currentUserId && !r.read;
                        }).length;

                        const unreadMsgCount = unreadMessages?.length || 0;
                        const totalUnreadSocial = unreadRecs + unreadMsgCount;

                        return (
                            <NavLink 
                                key={item.path} 
                                to={item.path} 
                                end={item.end}
                                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                            >
                                <div style={{ position: 'relative' }}>
                                    <item.icon size={22} />
                                    {item.label === 'Social' && totalUnreadSocial > 0 && (
                                        <span className="dot-notification-mobile">{totalUnreadSocial}</span>
                                    )}
                                </div>
                                <span>{item.label}</span>
                            </NavLink>
                        );
                    })}
                </motion.nav>
            )}
        </AnimatePresence>
        </>
    );
};

export default Topbar;
