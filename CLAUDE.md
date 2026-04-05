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

No test or lint scripts are configured.

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

## External APIs

| Service | Used for |
|---|---|
| **TMDB** | Primary movie/TV metadata, credits, streaming providers |
| **OMDB** | Fallback/legacy movie details and search |
| **Algolia** | Full-text search indexing (`server/controllers/searchController.js`) |
| **OpenAI** | AI-powered recommendations (embeddings stored in `Media.embedding` field — 1536-dim vector) |
| **Socket.io** | Real-time notifications, live recommendations, chat |

API keys live in `server/.env` (backend) and `.env` (frontend, prefixed `REACT_APP_`).

## Database

MongoDB Atlas (`MONGODB_URI` in `server/.env`) with local fallback (`mongodb://127.0.0.1:27017/cinelog`).  
The `Media` model has a unique compound index on `(userId, imdbID)` — prevents duplicate entries per user.

## Deployment

- `vercel.json` rewrites `/api/*` and socket calls to the Render backend, enabling the Vercel frontend to proxy to the backend seamlessly.
- Frontend port in dev: 3000. Backend port: 5000. `PORT=3006` in `.env` overrides the CRA default if needed.
