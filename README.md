# 🎬 Cuerates — Personal Movie Watchlist & Review Tracker

A fully-featured movie journaling app built with **React Class Components**, **Redux (no toolkit)**, **Axios**, **React Router v6**, and **Recharts**.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| React 18 (Class Components) | UI Components |
| Redux (vanilla, no toolkit) | Global state management |
| React-Redux | connect(), mapStateToProps |
| Axios | HTTP calls to json-server |
| json-server | Mock REST API backend |
| React Router v6 | Multi-page routing |
| Recharts | Analytics charts |

---

## Project Structure

```
cuerates/
├── db.json                    ← JSON Server database (mock backend)
├── public/
│   └── index.html
└── src/
    ├── App.js                 ← Root: Provider + BrowserRouter + Routes
    ├── index.js
    ├── store/
    │   ├── actions.js         ← Action types + action creators
    │   ├── reducers.js        ← moviesReducer + filterReducer + combineReducers
    │   ├── store.js           ← createStore + thunk middleware + logger
    │   └── thunks.js          ← Async thunk action creators (fetchMovies, addMovie, etc.)
    ├── services/
    │   └── movieService.js    ← Axios API calls (GET, POST, PATCH, DELETE)
    ├── components/
    │   ├── Sidebar.js         ← Navigation sidebar
    │   ├── MovieCard.js       ← Movie grid card
    │   ├── AddMovieModal.js   ← Add new movie form modal
    │   ├── MarkWatchedModal.js← Mark watchlist item as watched
    │   └── Toast.js           ← Auto-dismiss notification
    ├── pages/
    │   ├── Dashboard.js       ← Stats + Recent + Up Next
    │   ├── Watchlist.js       ← Filter/search watchlist grid
    │   ├── Watched.js         ← Filter/sort watched films grid
    │   ├── MovieDetail.js     ← Single film detail + edit
    │   └── Analytics.js       ← Charts and taste profile
    └── styles/
        └── global.css         ← Full design system (CSS variables, all styles)
```

---

## Setup & Running

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Start json-server (backend) in one terminal
```bash
npm run server
# Runs on http://localhost:3001
```

### Step 3 — Start React app in another terminal
```bash
npm start
# Runs on http://localhost:3000
```

### Or run both together
```bash
npm run dev
```

---

## Redux Architecture (No Toolkit)

### Action Types → Action Creators → Thunks → Reducers

```
User clicks "Add Movie"
    ↓
Component calls this.props.addMovie(data)    [mapDispatchToProps]
    ↓
addMovie thunk dispatches addMovieRequest()  [async thunk]
    ↓
Axios POST /movies                           [movieService.js]
    ↓
On success: dispatch addMovieSuccess(movie)
    ↓
moviesReducer handles ADD_MOVIE_SUCCESS      [reducers.js]
    ↓
Redux state updated → component re-renders
```

---

## Features

- **Dashboard** — Stats, recently watched, high-priority watchlist
- **Watchlist** — Filter by genre/priority, search by title/director
- **Watched** — Filter + sort (by date/rating/title)
- **Movie Detail** — Full review, edit form, mark as watched, delete
- **Analytics** — Genre bar chart, rating distribution, monthly activity, top films pie chart

---

## Key Concepts Demonstrated

1. **Redux without toolkit** — manual action types, action creators, combineReducers, createStore
2. **Custom thunk middleware** — written from scratch, not imported
3. **mapStateToProps / mapDispatchToProps** — every page uses connect()
4. **React Router v6 with class components** — wrapper function pattern for useNavigate/useParams
5. **Axios service layer** — all API calls abstracted into movieService.js
6. **Controlled forms** — all forms use class state with handleChange pattern
7. **Filter + sort** — derived state computed in render from Redux filters slice
