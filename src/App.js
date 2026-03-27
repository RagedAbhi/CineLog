import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Lenis from 'lenis';
import blobBg from './assets/blob.jpeg';

import Topbar from './components/Topbar';
import Toast from './components/Toast';
import RecommendModal from './components/RecommendModal';
import ConfirmModal from './components/ConfirmModal';
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
import Messenger from './pages/Messenger.js';
import { useDispatch } from 'react-redux';
import { hideRecommendModal, showToast, hideConfirmModal } from './store/actions';
import { fetchCurrentUser, fetchRecommendations, fetchRecentChats } from './store/thunks';

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
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector(state => state.auth);
  const { recommend, confirm } = useSelector(state => state.ui);

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

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCurrentUser());
      dispatch(fetchRecommendations());
      dispatch(fetchRecentChats());

      // Heartbeat pulse every 30 seconds
      const sendHeartbeat = async () => {
        try {
          const token = localStorage.getItem('token');
          if (token) {
            await fetch('http://localhost:5000/api/users/heartbeat', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
          }
        } catch (err) {
          console.error('Heartbeat failed:', err);
        }
      };

      sendHeartbeat(); // Initial beat
      const heartbeatInterval = setInterval(sendHeartbeat, 30000);
      
      // Poll for recent chats every 10 seconds for notifications
      const chatInterval = setInterval(() => {
        dispatch(fetchRecentChats());
      }, 10000);

      return () => {
        clearInterval(heartbeatInterval);
        clearInterval(chatInterval);
      };
    }
  }, [isAuthenticated, dispatch]);

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
      <Toast />
      
      <ConfirmModal 
        visible={confirm.visible}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onClose={() => dispatch(hideConfirmModal())}
      />
      
      {recommend?.visible && recommend.movie && (
        <RecommendModal 
          movie={recommend.movie}
          onClose={() => dispatch(hideRecommendModal())}
          onRecommend={() => {
            dispatch(hideRecommendModal());
            dispatch(showToast('Recommendation sent! 🚀', 'success'));
          }}
        />
      )}

      {/* Image Based Background */}
      <div className="liquid-bg-wrapper">
        <div className="image-blob-bg" style={{ backgroundImage: `url(${blobBg})` }}></div>
      </div>


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
              <Route path="/chat/:friendId" element={<Messenger />} />
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
