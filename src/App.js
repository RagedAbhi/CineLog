import { Component } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './store/store';

import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import MoviesPage from './pages/MoviesPage';
import TVShowsPage from './pages/TVShowsPage';
import Watchlist from './pages/Watchlist';
import Watched from './pages/Watched';
import MovieDetail from './pages/MovieDetail';
import Analytics from './pages/Analytics';

import './styles/global.css';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { globalSearch: '' };
  }

  render() {
    const { globalSearch } = this.state;
    return (
      <Provider store={store}>
        <BrowserRouter>
          <div className="app-layout">
            <Topbar
              searchQuery={globalSearch}
              onSearchChange={q => this.setState({ globalSearch: q })}
            />
            <div className="app-body">
              <main className="main-content" style={{ marginLeft: 0 }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/movies-list" element={<MoviesPage />} />
                  <Route path="/tvshows" element={<TVShowsPage />} />
                  <Route path="/watchlist" element={<Watchlist />} />
                  <Route path="/watched" element={<Watched />} />
                  <Route path="/movies/:id" element={<MovieDetail />} />
                  <Route path="/analytics" element={<Analytics />} />
                </Routes>
              </main>
            </div>
          </div>
        </BrowserRouter>
      </Provider>
    );
  }
}

export default App;
