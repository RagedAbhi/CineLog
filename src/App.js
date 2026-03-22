import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
  const { isAuthenticated } = useSelector(state => state.auth);

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
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-layout lenis-scroll">
        <Topbar
          searchQuery={globalSearch}
          onSearchChange={q => setGlobalSearch(q)}
        />
        <div className="app-body" style={{ paddingTop: 0 }}>
          <main className="main-content">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
                <Route path="/movies-list" element={<PageWrapper><MoviesPage /></PageWrapper>} />
                <Route path="/tvshows" element={<PageWrapper><TVShowsPage /></PageWrapper>} />
                <Route path="/watchlist" element={<PageWrapper><Watchlist /></PageWrapper>} />
                <Route path="/watched" element={<PageWrapper><Watched /></PageWrapper>} />
                <Route path="/friends" element={<PageWrapper><FriendsPage /></PageWrapper>} />
                <Route path="/movies/:id" element={<PageWrapper><MovieDetail /></PageWrapper>} />
                <Route path="/analytics" element={<PageWrapper><Analytics /></PageWrapper>} />
                <Route path="/profile" element={<PageWrapper><Profile /></PageWrapper>} />
                <Route path="/profile/:id" element={<PageWrapper><Profile /></PageWrapper>} />
                <Route path="/auth" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
