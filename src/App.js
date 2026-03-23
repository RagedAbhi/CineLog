import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Lenis from 'lenis';

import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import MoviesPage from './pages/MoviesPage';
import TVShowsPage from './pages/TVShowsPage';
import Watchlist from './pages/Watchlist';
import Watched from './pages/Watched';
import MovieDetail from './pages/MovieDetail';
import Analytics from './pages/Analytics';
import AuthPage from './pages/AuthPage';
import Profile from './pages/Profile';
import FriendsPage from './pages/FriendsPage';

import './styles/global.css';

import { motion, AnimatePresence } from 'framer-motion';

const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
  >
    {children}
  </motion.div>
);

const App = () => {
  const [globalSearch, setGlobalSearch] = useState('');
  const location = useLocation();
  const { isAuthenticated } = useSelector(state => state.auth);

  const isHomePage = location.pathname === '/';
  const isDetailPage = location.pathname.startsWith('/movies/');
  const shouldHideBlobs = isHomePage || isDetailPage;

  useEffect(() => {
    if (!isAuthenticated) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout lenis-scroll">
      {/* Liquid Background Refinement (Hidden on Home) */}
      {!shouldHideBlobs && (
        <div className="liquid-bg-wrapper">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>
      )}

      {/* SVG Gooey Filter */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}> {/* pointerEvents added */}
        <filter id="gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="gooey" />
          <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
        </filter>
      </svg>

      <Topbar
        searchQuery={globalSearch}
        onSearchChange={q => setGlobalSearch(q)}
      />
      <div className="app-body">
        <main className="main-content">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auth" element={<Navigate to="/" replace />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="/movies-list" element={<MoviesPage />} />
              <Route path="/movies/:id" element={<MovieDetail />} />
              <Route path="/tvshows" element={<TVShowsPage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/watched" element={<Watched />} />
              <Route path="/watchlist" element={<Watchlist />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

const AppWrapper = () => (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

export default AppWrapper;
