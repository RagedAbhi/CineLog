import * as movieService from '../services/movieService';
import * as authService from '../services/authService';
import {
  fetchMoviesRequest, fetchMoviesSuccess, fetchMoviesFailure,
  addMovieRequest, addMovieSuccess, addMovieFailure,
  updateMovieRequest, updateMovieSuccess, updateMovieFailure,
  deleteMovieRequest, deleteMovieSuccess, deleteMovieFailure,
  authRequest, authSuccess, authFailure, logout as logoutAction
} from './actions';

// ============================================================
// THUNK: Fetch all movies
// ============================================================
export const fetchMovies = () => async (dispatch) => {
  dispatch(fetchMoviesRequest());
  try {
    const movies = await movieService.getAllMovies();
    dispatch(fetchMoviesSuccess(movies));
  } catch (error) {
    dispatch(fetchMoviesFailure(error.message));
  }
};

// ============================================================
// THUNK: Add a new movie
// ============================================================
export const addMovie = (movieData) => async (dispatch) => {
  dispatch(addMovieRequest());
  try {
    const newMovie = await movieService.createMovie(movieData);
    dispatch(addMovieSuccess(newMovie));
    return newMovie;
  } catch (error) {
    dispatch(addMovieFailure(error.message));
  }
};

// ============================================================
// THUNK: Update a movie (edit review, rating, move to watched)
// ============================================================
export const updateMovie = (id, updatedData) => async (dispatch) => {
  dispatch(updateMovieRequest());
  try {
    const updated = await movieService.updateMovie(id, updatedData);
    dispatch(updateMovieSuccess(updated));
    return updated;
  } catch (error) {
    dispatch(updateMovieFailure(error.message));
  }
};

// ============================================================
// THUNK: Move movie from watchlist to watched
// ============================================================
export const markAsWatched = (id, watchData) => async (dispatch) => {
  dispatch(updateMovieRequest());
  try {
    const updated = await movieService.updateMovie(id, {
      ...watchData,
      status: 'watched',
      watchedOn: new Date().toISOString().split('T')[0]
    });
    dispatch(updateMovieSuccess(updated));
    return updated;
  } catch (error) {
    dispatch(updateMovieFailure(error.message));
  }
};

// ============================================================
// THUNK: Delete a movie
// ============================================================
export const deleteMovie = (id) => async (dispatch) => {
  dispatch(deleteMovieRequest());
  try {
    await movieService.deleteMovie(id);
    dispatch(deleteMovieSuccess(id));
  } catch (error) {
    dispatch(deleteMovieFailure(error.message));
  }
};

// ============================================================
// AUTH THUNKS
// ============================================================
export const login = (credentials) => async (dispatch) => {
  dispatch(authRequest());
  try {
    const data = await authService.login(credentials);
    dispatch(authSuccess(data));
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch(authFailure(message));
    throw new Error(message);
  }
};

export const signup = (userData) => async (dispatch) => {
  dispatch(authRequest());
  try {
    const data = await authService.signup(userData);
    dispatch(authSuccess(data));
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch(authFailure(message));
    throw new Error(message);
  }
};

export const logout = () => (dispatch) => {
  authService.logout();
  dispatch(logoutAction());
};
