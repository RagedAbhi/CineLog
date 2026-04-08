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

export const FETCH_RECS_REQUEST = 'FETCH_RECS_REQUEST';
export const FETCH_RECS_SUCCESS = 'FETCH_RECS_SUCCESS';
export const FETCH_RECS_FAILURE = 'FETCH_RECS_FAILURE';
export const FETCH_CHATS_SUCCESS = 'FETCH_CHATS_SUCCESS';
export const MARK_CHAT_READ = 'MARK_CHAT_READ';

export const SET_FILTER = 'SET_FILTER';
export const SET_SEARCH = 'SET_SEARCH';
export const CLEAR_FILTERS = 'CLEAR_FILTERS';

export const AUTH_REQUEST = 'AUTH_REQUEST';
export const AUTH_SUCCESS = 'AUTH_SUCCESS';
export const AUTH_FAILURE = 'AUTH_FAILURE';
export const LOGOUT = 'LOGOUT';

export const SHOW_TOAST = 'SHOW_TOAST';
export const HIDE_TOAST = 'HIDE_TOAST';
export const SHOW_RECOMMEND_MODAL = 'SHOW_RECOMMEND_MODAL';
export const HIDE_RECOMMEND_MODAL = 'HIDE_RECOMMEND_MODAL';
export const SHOW_CONFIRM_MODAL = 'SHOW_CONFIRM_MODAL';
export const HIDE_CONFIRM_MODAL = 'HIDE_CONFIRM_MODAL';
export const SHOW_TRAILER_MODAL = 'SHOW_TRAILER_MODAL';
export const HIDE_TRAILER_MODAL = 'HIDE_TRAILER_MODAL';

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

export const fetchRecsRequest = () => ({ type: FETCH_RECS_REQUEST });
export const fetchRecsSuccess = (recs) => ({ type: FETCH_RECS_SUCCESS, payload: recs });
export const fetchRecsFailure = (error) => ({ type: FETCH_RECS_FAILURE, payload: error });
export const fetchChatsSuccess = (messages) => ({ type: FETCH_CHATS_SUCCESS, payload: messages });
export const markChatRead = (friendId) => ({ type: MARK_CHAT_READ, payload: friendId });

export const setFilter = (filterType, value) => ({ type: SET_FILTER, payload: { filterType, value } });
export const setSearch = (query) => ({ type: SET_SEARCH, payload: query });
export const clearFilters = () => ({ type: CLEAR_FILTERS });

export const authRequest = () => ({ type: AUTH_REQUEST });
export const authSuccess = (data) => ({ type: AUTH_SUCCESS, payload: data });
export const authFailure = (error) => ({ type: AUTH_FAILURE, payload: error });
export const logout = () => ({ type: LOGOUT });

export const showToast = (message, toastType = 'info') => (dispatch) => {
  dispatch({ type: SHOW_TOAST, payload: { message, type: toastType } });
  setTimeout(() => dispatch({ type: HIDE_TOAST }), 5000);
};

export const showRecommendModal = (movie) => ({
  type: SHOW_RECOMMEND_MODAL,
  payload: movie
});

export const hideRecommendModal = () => ({
  type: HIDE_RECOMMEND_MODAL
});

export const showConfirmModal = (config) => ({
  type: SHOW_CONFIRM_MODAL,
  payload: config // { title, message, onConfirm }
});

export const hideConfirmModal = () => ({
  type: HIDE_CONFIRM_MODAL
});

export const showTrailerModal = (youtubeId) => ({
  type: SHOW_TRAILER_MODAL,
  payload: youtubeId
});

export const hideTrailerModal = () => ({
  type: HIDE_TRAILER_MODAL
});

export const hideToast = () => ({ type: HIDE_TOAST });
