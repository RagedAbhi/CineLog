import { combineReducers } from 'redux';
import {
  FETCH_MOVIES_REQUEST, FETCH_MOVIES_SUCCESS, FETCH_MOVIES_FAILURE,
  ADD_MOVIE_SUCCESS,
  UPDATE_MOVIE_SUCCESS,
  DELETE_MOVIE_SUCCESS,
  SET_FILTER, SET_SEARCH, CLEAR_FILTERS,
  AUTH_REQUEST, AUTH_SUCCESS, AUTH_FAILURE, LOGOUT,
  FETCH_RECS_REQUEST, FETCH_RECS_SUCCESS, FETCH_RECS_FAILURE,
  FETCH_CHATS_SUCCESS, MARK_CHAT_READ
} from './actions';

// ============================================================
// MOVIES REDUCER
// ============================================================
const initialMoviesState = {
  items: [],
  loading: false,
  error: null
};

const moviesReducer = (state = initialMoviesState, action) => {
  switch (action.type) {
    case FETCH_MOVIES_REQUEST:
      return { ...state, loading: true, error: null };

    case FETCH_MOVIES_SUCCESS:
      return { ...state, loading: false, items: action.payload };

    case FETCH_MOVIES_FAILURE:
      return { ...state, loading: false, error: action.payload };

    case ADD_MOVIE_SUCCESS:
      return { ...state, items: [...state.items, action.payload] };

    case UPDATE_MOVIE_SUCCESS:
      return {
        ...state,
        items: state.items.map(movie =>
          movie._id === action.payload._id ? action.payload : movie
        )
      };

    case DELETE_MOVIE_SUCCESS:
      return {
        ...state,
        items: state.items.filter(movie => movie._id !== action.payload)
      };

    default:
      return state;
  }
};

// ============================================================
// FILTER REDUCER
// ============================================================
const initialFilterState = {
  genre: 'all',
  rating: 'all',
  mediaType: 'all',
  search: ''
};

const filterReducer = (state = initialFilterState, action) => {
  switch (action.type) {
    case SET_FILTER:
      return { ...state, [action.payload.filterType]: action.payload.value };

    case SET_SEARCH:
      return { ...state, search: action.payload };

    case CLEAR_FILTERS:
      return initialFilterState;

    default:
      return state;
  }
};

// ============================================================
// AUTH REDUCER
// ============================================================
const initialAuthState = {
  token: localStorage.getItem('token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
  error: null,
  recommendations: [],
  unreadMessages: []
};

const authReducer = (state = initialAuthState, action) => {
  switch (action.type) {
    case AUTH_REQUEST:
      return { ...state, loading: true, error: null };

    case AUTH_SUCCESS:
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        token: action.payload.token,
        user: action.payload.user
      };

    case AUTH_FAILURE:
      return { ...state, loading: false, error: action.payload };

    case LOGOUT:
      localStorage.removeItem('token');
      return {
        ...state,
        token: null,
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
        recommendations: []
      };
    
    case FETCH_RECS_REQUEST:
      return { ...state, loading: true };
    
    case FETCH_RECS_SUCCESS:
      return { ...state, loading: false, recommendations: action.payload };
    
    case FETCH_RECS_FAILURE:
      return { ...state, loading: false, error: action.payload };

    case FETCH_CHATS_SUCCESS:
      return { 
        ...state, 
        unreadMessages: action.payload.filter(m => !m.read && m.receiver === state.user?._id)
      };

    case MARK_CHAT_READ:
      return {
        ...state,
        unreadMessages: state.unreadMessages.filter(m => m.sender !== action.payload)
      };

    default:
      return state;
  }
};

const initialUIState = {
  toast: { message: null, type: null, visible: false },
  recommend: { movie: null, visible: false },
  confirm: { visible: false, title: '', message: '', onConfirm: null }
};

const uiReducer = (state = initialUIState, action) => {
  switch (action.type) {
    case 'SHOW_TOAST':
      return { ...state, toast: { ...action.payload, visible: true } };
    case 'HIDE_TOAST':
      return { ...state, toast: { ...state.toast, visible: false } };
    case 'SHOW_RECOMMEND_MODAL':
      return { ...state, recommend: { visible: true, movie: action.payload } };
    case 'HIDE_RECOMMEND_MODAL':
      return { ...state, recommend: { visible: false, movie: null } };
    case 'SHOW_CONFIRM_MODAL':
      return { ...state, confirm: { ...action.payload, visible: true } };
    case 'HIDE_CONFIRM_MODAL':
      return { ...state, confirm: { ...state.confirm, visible: false, onConfirm: null } };
    default:
      return state;
  }
};

// ============================================================
// ROOT REDUCER
// ============================================================
const rootReducer = combineReducers({
  movies: moviesReducer,
  filters: filterReducer,
  auth: authReducer,
  ui: uiReducer
});

export default rootReducer;
