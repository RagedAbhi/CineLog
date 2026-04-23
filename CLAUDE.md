# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run full stack (frontend + backend concurrently)
npm run dev

# Frontend only (port 3000, increased heap for large builds)
npm start

# Backend only (port 5000)
npm run server

# Production build
npm run build
```

No test or lint scripts are configured. The backend has no nodemon — restart manually after server-side changes.

## Architecture

CineLog is a full-stack movie/TV diary app with social features.

**Frontend**: React 18 + Redux (vanilla, no Redux Toolkit) + React Router v6, deployed to **Vercel**  
**Backend**: Express.js + MongoDB (Mongoose), deployed to **Render** (`cinelog-wdaj.onrender.com`)  
**Real-time**: Socket.io (initialized in `server/index.js`, consumed via `src/hooks/useSocket.js`)

### Frontend structure

- `src/pages/` — full-page views (Dashboard, MovieDetail, FriendsPage, Messenger, Analytics, etc.)
- `src/components/` — shared UI (Topbar, MovieCard, modals, Toast, GlobalSearch, SocialPulse)
- `src/store/` — Redux: `store.js`, `reducers.js`, `actions.js`, `thunks.js`
- `src/services/` — API callers: `movieService.js`, `authService.js`, `tmdbService.js`, `GSAPAnimations.js`
- `src/config.js` — Environment-aware API URL (auto-switches localhost ↔ Render based on `window.location.hostname`)
- `src/styles/global.css` — CSS variables and design system tokens

### Backend structure

- `server/controllers/` — business logic per domain (auth, media, user, friend, recommendation, message, search)
- `server/routes/` — Express routers, all mounted under `/api/*`
- `server/models/` — Mongoose schemas (User, Media, Friendship, Message, Recommendation, SearchCache, UserBehavior)
- `server/middleware/authMiddleware.js` — JWT Bearer token verification, attaches `req.user`
- `server/services/socketService.js` — Socket.io event handlers

### State management

Redux slices (in `reducers.js`): `movies`, `auth`, `filters`, `ui` (toasts/modals), `recommendations`, `chats`.  
Most components are **class components** using `mapStateToProps`/`mapDispatchToProps`. Some newer components use hooks. Async logic lives in `thunks.js`.

### Authentication

JWT-based. Tokens stored in `localStorage`, sent as `Authorization: Bearer <token>` on every API call. 30-day expiry. `App.js` redirects unauthenticated users to `/auth`. A 30-second heartbeat (`POST /api/users/heartbeat`) keeps sessions active.

## Key patterns

### Mixed component model
Older pages (Dashboard, Watchlist, Watched, MovieCard) are **class components** connected via `connect(mapStateToProps, mapDispatchToProps)`. Newer components (AuthPage, Topbar, AddMovieModal) are **functional with hooks**. React Router v6 hooks (`useNavigate`, `useParams`) cannot be used directly in class components — the codebase uses wrapper functions:

```javascript
function DashboardWrapper(props) {
  const navigate = useNavigate();
  return <Dashboard {...props} navigate={navigate} />;
}
export default DashboardWrapper;
```

### Adding a feature end-to-end
1. Add Mongoose schema fields in `server/models/`
2. Add controller logic in `server/controllers/`
3. Register route in `server/routes/` and mount in `server/index.js`
4. Add service caller in `src/services/movieService.js` (or relevant service)
5. Add action types in `src/store/actions.js`, thunk in `src/store/thunks.js`, handler in `src/store/reducers.js`
6. Dispatch from component

### Media deduplication
The `(userId, imdbID)` compound unique index on `Media` prevents duplicate entries. If a user adds the same title twice (e.g., from watchlist to watched), the backend **updates** the existing document rather than rejecting it. The Watchlist page also deduplicates in the UI by `titleKey | mediaType | year`.

### Metadata healing
When a media detail is fetched, `mediaController.js` automatically calls `searchService.enrichMediaMetadata()` (OMDB/TMDB) if plot or genre is missing. This happens on-the-fly; no manual trigger required.

### TMDB caching
`tmdbService.js` caches API responses in `localStorage` with a 1-hour TTL (`tmdb_cache_<key>`). Clear localStorage or adjust TTL during development if stale data appears.

### Streaming providers
`tmdbService.fetchStreamingAvailability()` calls backend `/api/search/providers/imdb/:imdbID`, which uses the **WatchMode API** with a TMDB fallback. Requires `WATCHMODE_API_KEY` in `server/.env`.

### Socket.io usage
`useSocket.js` is initialized once at the root in `App.js`. The client authenticates via `socket.handshake.auth.token` and joins a personal room with `socket.emit('join', userId)`. Key events: `new_recommendation` (inbound), `room:host_change`, `room:member_left` (watch rooms). Watch room state is **in-memory** on the server in `socketService.js` — it does not persist across server restarts.

## External APIs

| Service | Used for |
|---|---|
| **TMDB** | Primary movie/TV metadata, credits, streaming providers |
| **OMDB** | Fallback/legacy movie details and search |
| **Algolia** | Full-text search indexing (`server/controllers/searchController.js`) |
| **WatchMode** | OTT streaming availability per title |
| **OpenAI** | AI-powered recommendations (embeddings stored in `Media.embedding` field — 1536-dim vector) |
| **Socket.io** | Real-time notifications, live recommendations, chat, watch rooms |

Frontend env vars (`.env`, prefixed `REACT_APP_`): `REACT_APP_TMDB_API_KEY`, `REACT_APP_OMDB_API_KEY`.  
Backend env vars (`server/.env`): `MONGODB_URI`, `JWT_SECRET`, `TMDB_API_KEY`, `OMDB_API_KEY`, `ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_KEY`, `OPENAI_API_KEY`, `WATCHMODE_API_KEY`.

## Database

MongoDB Atlas (`MONGODB_URI` in `server/.env`) with local fallback (`mongodb://127.0.0.1:27017/cinelog`).  
The `Media` model has a unique compound index on `(userId, imdbID)` — prevents duplicate entries per user.

## Deployment

- `vercel.json` rewrites `/api/*` and socket calls to the Render backend, enabling the Vercel frontend to proxy to the backend seamlessly.
- Frontend port in dev: 3000. Backend port: 5000. `PORT=3006` in `.env` overrides the CRA default if needed.
- Winston logs to `server/logs/error.log` and `server/logs/combined.log`. User avatars are stored to `server/uploads/` via multer.
