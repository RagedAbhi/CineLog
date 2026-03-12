import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// ============================================================
// GET all movies
// ============================================================
export const getAllMovies = async () => {
  const response = await api.get('/movies');
  return response.data;
};

// ============================================================
// GET single movie by ID
// ============================================================
export const getMovieById = async (id) => {
  const response = await api.get(`/movies/${id}`);
  return response.data;
};

// ============================================================
// POST create new movie
// ============================================================
export const createMovie = async (movieData) => {
  const response = await api.post('/movies', {
    ...movieData,
    addedOn: new Date().toISOString().split('T')[0]
  });
  return response.data;
};

// ============================================================
// PATCH update existing movie
// ============================================================
export const updateMovie = async (id, updatedData) => {
  const response = await api.patch(`/movies/${id}`, updatedData);
  return response.data;
};

// ============================================================
// DELETE a movie
// ============================================================
export const deleteMovie = async (id) => {
  await api.delete(`/movies/${id}`);
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
