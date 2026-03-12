import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

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

const App = () => {
  const [globalSearch, setGlobalSearch] = useState('');
  const { isAuthenticated } = useSelector(state => state.auth);

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
      <div className="app-layout">
        <Topbar
          searchQuery={globalSearch}
          onSearchChange={q => setGlobalSearch(q)}
        />
        <div className="app-body">
          <main className="main-content" style={{ marginLeft: 0 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/movies-list" element={<MoviesPage />} />
              <Route path="/tvshows" element={<TVShowsPage />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/watched" element={<Watched />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/movies/:id" element={<MovieDetail />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="/auth" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
