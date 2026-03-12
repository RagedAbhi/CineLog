import { createStore, applyMiddleware } from 'redux';
import rootReducer from './reducers';

// Simple thunk middleware (without toolkit)
const thunkMiddleware = store => next => action => {
  if (typeof action === 'function') {
    return action(store.dispatch, store.getState);
  }
  return next(action);
};

// Logger middleware for development
const loggerMiddleware = store => next => action => {
  if (process.env.NODE_ENV === 'development') {
    console.group(`%c Action: ${action.type}`, 'color: #4CAF50; font-weight: bold');
    console.log('Prev State:', store.getState());
    console.log('Action:', action);
    const result = next(action);
    console.log('Next State:', store.getState());
    console.groupEnd();
    return result;
  }
  return next(action);
};

const store = createStore(
  rootReducer,
  applyMiddleware(thunkMiddleware, loggerMiddleware)
);

export default store;
