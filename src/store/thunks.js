import * as movieService from '../services/movieService';
import * as authService from '../services/authService';
import {
  fetchMoviesRequest, fetchMoviesSuccess, fetchMoviesFailure,
  addMovieRequest, addMovieSuccess, addMovieFailure,
  updateMovieRequest, updateMovieSuccess, updateMovieFailure,
  deleteMovieRequest, deleteMovieSuccess, deleteMovieFailure,
  authRequest, authSuccess, authFailure, logout as logoutAction,
  fetchRecsRequest, fetchRecsSuccess, fetchRecsFailure,
  fetchChatsSuccess, showToast
} from './actions';
import axios from 'axios';
import config from '../config';

// ============================================================
// THUNK: Fetch all movies
// ============================================================
export const fetchMovies = () => async (dispatch) => {
  dispatch(fetchMoviesRequest());
  try {
    const movies = await movieService.getAllMovies();
    dispatch(fetchMoviesSuccess(movies));
  } catch (error) {
    if (error.response?.status === 401) {
      dispatch(fetchCurrentUser()); // This will trigger logout/clear
    } else {
      dispatch(fetchMoviesFailure(error.message));
    }
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
    const errorMessage = error.response?.data?.message || error.message;
    dispatch(addMovieFailure(errorMessage));
    dispatch(showToast(errorMessage, 'error'));
    throw error; // Re-throw so components can handle it if needed
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

export const fetchCurrentUser = () => async (dispatch) => {
    try {
        const user = await authService.getMe();
        if (user) {
            dispatch(authSuccess({ user, token: localStorage.getItem('token') }));
        }
    } catch (error) {
        console.error("Failed to fetch current user, clearing session:", error);
        // Token is stale/invalid — clear it so login page shows
        authService.logout();
        dispatch(logoutAction());
    }
};

export const fetchRecommendations = () => async (dispatch) => {
    dispatch(fetchRecsRequest());
    try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${config.API_URL}/api/recommendations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        dispatch(fetchRecsSuccess(res.data));
    } catch (error) {
        if (error.response?.status === 401) {
            dispatch(fetchCurrentUser());
        } else {
            dispatch(fetchRecsFailure(error.message));
        }
    }
};

export const clearRecentActivity = () => async (dispatch) => {
    try {
        const token = localStorage.getItem('token');
        await axios.delete(`${config.API_URL}/api/recommendations/bulk/clear-all`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        dispatch(fetchRecsSuccess([]));
        dispatch(showToast('Recent activity cleared'));
    } catch (error) {
        console.error("Failed to clear recent activity:", error);
        dispatch(showToast('Failed to clear activity', 'error'));
    }
};

export const fetchRecentChats = () => async (dispatch, getState) => {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const previousUnreadCount = getState().auth.unreadMessages?.length || 0;
        
        const res = await axios.get(`${config.API_URL}/api/messages/recent`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        dispatch(fetchChatsSuccess(res.data));
        
        // After dispatching, get the new state to see if unread messages increased
        const newUnreadCount = getState().auth.unreadMessages?.length || 0;
        
        if (newUnreadCount > previousUnreadCount) {
             dispatch(showToast('You have a new message! 💬', 'info'));
        }
        
    } catch (error) {
        console.error("Failed to fetch recent chats:", error);
    }
};
