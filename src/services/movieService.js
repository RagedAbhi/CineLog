import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/media';

// Helper to get Auth header
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    headers: { Authorization: `Bearer ${token}` }
  };
};

// ============================================================
// INTERNAL API (MONGODB / BACKEND)
// ============================================================

export const getAllMovies = async () => {
  const response = await axios.get(BASE_URL, getAuthHeader());
  return response.data;
};

export const createMovie = async (movieData) => {
  const response = await axios.post(BASE_URL, movieData, getAuthHeader());
  return response.data;
};

export const updateMovie = async (id, updatedData) => {
  const response = await axios.patch(`${BASE_URL}/${id}`, updatedData, getAuthHeader());
  return response.data;
};

export const deleteMovie = async (id) => {
  await axios.delete(`${BASE_URL}/${id}`, getAuthHeader());
  return id;
};

// ============================================================
// SEARCH movie/series list from OMDB API
// ============================================================
export const searchMoviesExternal = async (title, mediaType = 'movie') => {
  const OMDB_API_KEY = process.env.REACT_APP_OMDB_API_KEY;

  if (!OMDB_API_KEY || OMDB_API_KEY === 'your_free_key_here') {
    throw new Error('NO_API_KEY');
  }

  const omdbType = mediaType === 'series' ? 'series' : 'movie';
  const response = await axios.get(
    `https://www.omdbapi.com/?s=${encodeURIComponent(title)}&type=${omdbType}&apikey=${OMDB_API_KEY}`
  );

  if (response.data.Response === 'False') {
    throw new Error(response.data.Error || 'Not found');
  }

  return response.data.Search.map(item => ({
    title: item.Title,
    year: item.Year?.match(/\d{4}/)?.[0] || item.Year,
    imdbID: item.imdbID,
    poster: item.Poster !== 'N/A' ? item.Poster : '',
    mediaType
  }));
};

// ============================================================
// GET full details for a specific movie/series from OMDB
// ============================================================
export const getMovieDetailsExternal = async (imdbID, mediaType = 'movie') => {
  const OMDB_API_KEY = process.env.REACT_APP_OMDB_API_KEY;

  if (!OMDB_API_KEY || OMDB_API_KEY === 'your_free_key_here') {
    throw new Error('NO_API_KEY');
  }

  const response = await axios.get(
    `https://www.omdbapi.com/?i=${imdbID}&plot=full&apikey=${OMDB_API_KEY}`
  );

  if (response.data.Response === 'False') {
    throw new Error(response.data.Error || 'Not found');
  }

  return {
    title: response.data.Title,
    year: response.data.Year?.match(/\d{4}/)?.[0] || response.data.Year,
    genre: response.data.Genre?.split(', ')[0] || 'Unknown',
    director: response.data.Director !== 'N/A' ? response.data.Director : '',
    poster: response.data.Poster !== 'N/A' ? response.data.Poster : '',
    plot: response.data.Plot,
    mediaType
  };
};
