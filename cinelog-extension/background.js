/**
 * CineLog Extension — Background Service Worker
 *
 * Responsibilities:
 * - Maintains the Socket.io connection to the CineLog backend.
 * - Passes sync events between the content-script (Netflix tab) and the server.
 * - Manages auth token stored in chrome.storage.local.
 * - Receives room join/leave commands from popup.
 */

import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

const BACKEND_URL = 'http://127.0.0.1:5000';

let socket = null;
let currentRoomCode = null;
let authToken = null;

// ── Socket lifecycle ───────────────────────────────────────────────────────

function connectSocket(token) {
    if (socket && socket.connected) return;

    authToken = token;
    socket = io(BACKEND_URL, { transports: ['websocket'] });

    socket.on('connect', () => {
        console.log('[CineLog Ext] Socket connected:', socket.id);
        // Re-join room if one was active before reconnect
        if (currentRoomCode) {
            socket.emit('room:join_socket', currentRoomCode);
        }
    });

    // Relay sync events down to the content script
    socket.on('room:synced', (data) => {
        broadcastToNetflixTab({ type: 'CINELOG_SYNC', payload: data });
    });

    // FIX #4: Someone requested state — forward to this tab's content script
    socket.on('room:state_request', () => {
        broadcastToNetflixTab({ type: 'CINELOG_STATE_REQUEST' });
    });

    // FIX #4: Host responded with state — forward back to the requester only
    socket.on('room:state_response', (data) => {
        broadcastToNetflixTab({ type: 'CINELOG_STATE_RESPONSE', state: data.state });
    });

    socket.on('room:member_join', (data) => {
        broadcastToNetflixTab({ type: 'CINELOG_MEMBER_JOIN', payload: data });
        notifyPopup({ type: 'ROOM_UPDATE', payload: data });
    });

    socket.on('room:member_left', (data) => {
        broadcastToNetflixTab({ type: 'CINELOG_MEMBER_LEFT', payload: data });
        notifyPopup({ type: 'ROOM_UPDATE', payload: data });
    });

    socket.on('room:dissolved', () => {
        broadcastToNetflixTab({ type: 'CINELOG_DISSOLVED' });
        notifyPopup({ type: 'ROOM_DISSOLVED' });
        currentRoomCode = null;
        chrome.storage.session.remove('roomCode');
    });

    socket.on('room:message', (data) => {
        broadcastToNetflixTab({ type: 'CINELOG_CHAT', payload: data });
    });

    socket.on('disconnect', () => {
        console.log('[CineLog Ext] Socket disconnected');
    });
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function broadcastToNetflixTab(message) {
    const tabs = await chrome.tabs.query({ url: 'https://www.netflix.com/watch/*' });
    for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
}

function notifyPopup(message) {
    chrome.runtime.sendMessage(message).catch(() => {});
}

// ── Messages from content-script and popup ─────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {

        // Auth: popup logged in
        case 'CINELOG_SET_TOKEN': {
            const { token } = message;
            chrome.storage.local.set({ cinelogToken: token });
            connectSocket(token);
            sendResponse({ ok: true });
            break;
        }

        // Auth: popup logged out
        case 'CINELOG_LOGOUT': {
            if (socket) { socket.disconnect(); socket = null; }
            currentRoomCode = null;
            chrome.storage.local.remove('cinelogToken');
            chrome.storage.session.clear();
            sendResponse({ ok: true });
            break;
        }

        // Room: join (called from popup after REST join)
        case 'CINELOG_JOIN_ROOM': {
            const { roomCode } = message;
            currentRoomCode = roomCode;
            chrome.storage.session.set({ roomCode });
            if (socket) socket.emit('room:join_socket', roomCode);
            // Notify any open Netflix tabs so they initialize immediately
            broadcastToNetflixTab({ type: 'CINELOG_ROOM_JOINED', roomCode });
            sendResponse({ ok: true });
            break;
        }

        // Room: leave (called from popup)
        case 'CINELOG_LEAVE_ROOM': {
            if (socket && currentRoomCode) {
                socket.emit('room:leave_socket', currentRoomCode);
            }
            // Notify Netflix tabs to remove overlay
            broadcastToNetflixTab({ type: 'CINELOG_ROOM_LEFT' });
            currentRoomCode = null;
            chrome.storage.session.remove('roomCode');
            sendResponse({ ok: true });
            break;
        }

        // Sync: relayed from content-script → server
        case 'CINELOG_EMIT_SYNC': {
            if (socket && currentRoomCode) {
                socket.emit('room:sync', {
                    roomCode: currentRoomCode,
                    action: message.action,
                    currentTime: message.currentTime
                });
            }
            sendResponse({ ok: true });
            break;
        }

        // Chat: sent from content-script overlay → server
        case 'CINELOG_EMIT_CHAT': {
            if (socket && currentRoomCode) {
                socket.emit('room:chat', {
                    roomCode: currentRoomCode,
                    ...message.payload
                });
            }
            sendResponse({ ok: true });
            break;
        }

        // FIX #4: Content script requests current state from room (catch-up for late joiner)
        case 'CINELOG_REQUEST_STATE': {
            if (socket && currentRoomCode) {
                socket.emit('room:request_state', { roomCode: currentRoomCode });
            }
            sendResponse({ ok: true });
            break;
        }

        // FIX #4: Content script (host) replied with its current state
        case 'CINELOG_EMIT_STATE_RESPONSE': {
            if (socket && currentRoomCode) {
                socket.emit('room:state_response', {
                    roomCode: currentRoomCode,
                    state: message.state
                });
            }
            sendResponse({ ok: true });
            break;
        }

        // Status: popup polling current state
        case 'CINELOG_GET_STATUS': {
            sendResponse({
                connected: socket?.connected || false,
                roomCode: currentRoomCode,
                token: authToken
            });
            break;
        }
    }

    return true; // keep channel open for async sendResponse
});

// ── On startup: restore token and reconnect ────────────────────────────────

chrome.storage.local.get('cinelogToken', ({ cinelogToken }) => {
    if (cinelogToken) {
        connectSocket(cinelogToken);
    }
});

chrome.storage.session.get('roomCode', ({ roomCode }) => {
    if (roomCode) currentRoomCode = roomCode;
});
