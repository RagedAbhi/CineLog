// ============================================================
// ACTION TYPES
// ============================================================
export const FETCH_MOVIES_REQUEST = 'FETCH_MOVIES_REQUEST';
export const FETCH_MOVIES_SUCCESS = 'FETCH_MOVIES_SUCCESS';
export const FETCH_MOVIES_FAILURE = 'FETCH_MOVIES_FAILURE';

export const ADD_MOVIE_REQUEST = 'ADD_MOVIE_REQUEST';
export const ADD_MOVIE_SUCCESS = 'ADD_MOVIE_SUCCESS';
export const ADD_MOVIE_FAILURE = 'ADD_MOVIE_FAILURE';

export const UPDATE_MOVIE_REQUEST = 'UPDATE_MOVIE_REQUEST';
export const UPDATE_MOVIE_SUCCESS = 'UPDATE_MOVIE_SUCCESS';
export const UPDATE_MOVIE_FAILURE = 'UPDATE_MOVIE_FAILURE';

export const DELETE_MOVIE_REQUEST = 'DELETE_MOVIE_REQUEST';
export const DELETE_MOVIE_SUCCESS = 'DELETE_MOVIE_SUCCESS';
export const DELETE_MOVIE_FAILURE = 'DELETE_MOVIE_FAILURE';

export const SET_FILTER = 'SET_FILTER';
export const SET_SEARCH = 'SET_SEARCH';
export const CLEAR_FILTERS = 'CLEAR_FILTERS';

export const AUTH_REQUEST = 'AUTH_REQUEST';
export const AUTH_SUCCESS = 'AUTH_SUCCESS';
export const AUTH_FAILURE = 'AUTH_FAILURE';
export const LOGOUT = 'LOGOUT';

// ============================================================
// ACTION CREATORS
// ============================================================
export const fetchMoviesRequest = () => ({ type: FETCH_MOVIES_REQUEST });
export const fetchMoviesSuccess = (movies) => ({ type: FETCH_MOVIES_SUCCESS, payload: movies });
export const fetchMoviesFailure = (error) => ({ type: FETCH_MOVIES_FAILURE, payload: error });

export const addMovieRequest = () => ({ type: ADD_MOVIE_REQUEST });
export const addMovieSuccess = (movie) => ({ type: ADD_MOVIE_SUCCESS, payload: movie });
export const addMovieFailure = (error) => ({ type: ADD_MOVIE_FAILURE, payload: error });

export const updateMovieRequest = () => ({ type: UPDATE_MOVIE_REQUEST });
export const updateMovieSuccess = (movie) => ({ type: UPDATE_MOVIE_SUCCESS, payload: movie });
export const updateMovieFailure = (error) => ({ type: UPDATE_MOVIE_FAILURE, payload: error });

export const deleteMovieRequest = () => ({ type: DELETE_MOVIE_REQUEST });
export const deleteMovieSuccess = (id) => ({ type: DELETE_MOVIE_SUCCESS, payload: id });
export const deleteMovieFailure = (error) => ({ type: DELETE_MOVIE_FAILURE, payload: error });

export const setFilter = (filterType, value) => ({ type: SET_FILTER, payload: { filterType, value } });
export const setSearch = (query) => ({ type: SET_SEARCH, payload: query });
export const clearFilters = () => ({ type: CLEAR_FILTERS });

export const authRequest = () => ({ type: AUTH_REQUEST });
export const authSuccess = (data) => ({ type: AUTH_SUCCESS, payload: data });
export const authFailure = (error) => ({ type: AUTH_FAILURE, payload: error });
export const logout = () => ({ type: LOGOUT });
