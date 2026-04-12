import axios from 'axios';

import config from '../config';

const BASE_URL = `${config.API_URL}/api/media`;

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
export const searchMoviesExternal = async (title, mediaType = '') => {
  const OMDB_API_KEY = process.env.REACT_APP_OMDB_API_KEY;

  if (!OMDB_API_KEY || OMDB_API_KEY === 'your_free_key_here') {
    throw new Error('NO_API_KEY');
  }

  const typeParam = mediaType ? `&type=${mediaType}` : '';
  const response = await axios.get(
    `https://www.omdbapi.com/?s=${encodeURIComponent(title)}${typeParam}&apikey=${OMDB_API_KEY}`
  );

  if (response.data.Response === 'False') {
    throw new Error(response.data.Error || 'Not found');
  }

  return response.data.Search.map(item => ({
    title: item.Title,
    year: item.Year?.match(/\d{4}/)?.[0] || item.Year,
    imdbID: item.imdbID,
    poster: item.Poster !== 'N/A' ? item.Poster : '',
    mediaType: item.Type === 'series' ? 'series' : 'movie'
  }));
};

// ============================================================
// GET full details for a specific movie/series from OMDB
// ============================================================
export const getMovieDetailsExternal = async (id, mediaType = '') => {
  const TMDB_API_KEY = process.env.REACT_APP_TMDB_API_KEY;
  const OMDB_API_KEY = process.env.REACT_APP_OMDB_API_KEY;

  // Detect if ID is TMDB (numeric) or IMDb (starts with tt)
  const isImdb = typeof id === 'string' && id.startsWith('tt');
  const tmdbType = (mediaType === 'series' || mediaType === 'tv') ? 'tv' : 'movie';

  try {
    let data;
    if (isImdb && OMDB_API_KEY) {
        // Fallback or legacy OMDB support
        const response = await axios.get(`https://www.omdbapi.com/?i=${id}&plot=full&apikey=${OMDB_API_KEY}`);
        data = {
            title: response.data.Title,
            year: response.data.Year?.match(/\d{4}/)?.[0] || response.data.Year,
            genre: response.data.Genre,
            director: response.data.Director,
            poster: response.data.Poster !== 'N/A' ? response.data.Poster : '',
            plot: response.data.Plot,
            cast: response.data.Actors,
            imdbID: id,
            mediaType: mediaType || (response.data.Type === 'series' ? 'series' : 'movie')
        };
    } else if (TMDB_API_KEY) {
        // Preferred: TMDB for rich metadata
        // 1. If it's an IMDb ID, find the TMDB ID first
        let tmdbId = id;
        if (isImdb) {
            const findRes = await axios.get(`https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
            const result = (tmdbType === 'tv' ? findRes.data.tv_results : findRes.data.movie_results)?.[0];
            if (result) tmdbId = result.id;
        }

        // 2. Get full details including credits (for cast)
        let detailRes;
        try {
            const detailUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
            detailRes = await axios.get(detailUrl);
        } catch (err) {
            // If the initial type was wrong (common with numeric IDs in recs), retry with the other type
            if (err.response?.status === 404) {
                const retryType = tmdbType === 'tv' ? 'movie' : 'tv';
                const retryUrl = `https://api.themoviedb.org/3/${retryType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
                detailRes = await axios.get(retryUrl);
                tmdbType = retryType; // Correct the type for mapping
            } else {
                throw err;
            }
        }

        const item = detailRes.data;

        data = {
            title: item.title || item.name,
            year: (item.release_date || item.first_air_date || '').split('-')[0],
            genre: item.genres?.map(g => g.name).join(', ') || 'Unknown',
            director: item.credits?.crew?.find(c => c.job === 'Director' || c.job === 'Executive Producer')?.name || '',
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
            plot: item.overview,
            cast: item.credits?.cast?.slice(0, 5).map(c => c.name).join(', ') || '',
            imdbID: id,
            language: item.original_language || '',
            mediaType: tmdbType === 'tv' ? 'series' : 'movie'
        };
    }
    return data;
  } catch (err) {
    console.error('Fetch Details Error:', err);
    throw new Error('Could not fetch metadata');
  }
};

// ============================================================
// GET STREAMING PROVIDERS (FROM BACKEND PROXY)
// ============================================================
export const getWatchProviders = async (type, id, region = 'US') => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `${config.API_URL}/api/search/providers/${type}/${id}?region=${region}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (err) {
    console.warn('Could not fetch providers:', err);
    return null;
  }
};
