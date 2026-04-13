# CineLog Extension — Watch Together

Chrome extension that syncs Netflix playback across multiple users in a CineLog Watch Together room.

## How to load (development / sideloading)

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `cinelog-extension/` folder
5. Pin the CineLog icon to your toolbar

## How to use

1. Click the CineLog toolbar icon and sign in with your CineLog credentials
2. On a movie detail page in CineLog, click **Watch Together on Netflix**
3. Create a room → share the 6-character code with friends
4. Friends enter the code in the extension popup → Join
5. Click **Open Netflix** — the extension will auto-sync play/pause/seek for everyone in the room

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker — Socket.io connection, event relay |
| `content-script.js` | Injected into Netflix — hooks video player, renders chat overlay |
| `popup.html` / `popup.js` | Extension popup UI — login, room join/leave, member list |
| `icons/` | Extension icons (PNG, 16/48/128px) |

## Notes

- The extension uses the same JWT token as the CineLog web app
- Room sync is debounced (300ms) to prevent echo loops
- A seek tolerance of ±2s prevents unnecessary re-seeks on minor drift
- Chat is overlaid on the Netflix page and can be toggled via the `—` button
