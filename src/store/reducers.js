import { combineReducers } from 'redux';
import {
  FETCH_MOVIES_REQUEST, FETCH_MOVIES_SUCCESS, FETCH_MOVIES_FAILURE,
  ADD_MOVIE_SUCCESS,
  UPDATE_MOVIE_SUCCESS,
  DELETE_MOVIE_SUCCESS,
  SET_FILTER, SET_SEARCH, CLEAR_FILTERS
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
          movie.id === action.payload.id ? action.payload : movie
        )
      };

    case DELETE_MOVIE_SUCCESS:
      return {
        ...state,
        items: state.items.filter(movie => movie.id !== action.payload)
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
  priority: 'all',
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
// ROOT REDUCER
// ============================================================
const rootReducer = combineReducers({
  movies: moviesReducer,
  filters: filterReducer
});

export default rootReducer;
