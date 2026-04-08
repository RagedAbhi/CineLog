/**
 * CineLog Extension — Version 1.2.0 (Service Worker)
 * Renamed to force cache refresh.
 */

import { io } from './socket-io.esm.js';

const BACKEND_URL = 'http://127.0.0.1:5000';

let socket = null;
let currentRoomCode = null;
let authToken = null;

console.log('[CineLog] Service Worker v1.2.0 Initialized');

// ── Socket lifecycle ───────────────────────────────────────────────────────

function connectSocket(token) {
    if (socket && socket.connected) return;

    authToken = token;
    socket = io(BACKEND_URL, { transports: ['websocket'] });

    socket.on('connect', () => {
        console.log('[CineLog Ext] Socket connected:', socket.id);
        if (currentRoomCode) {
            socket.emit('room:join_socket', currentRoomCode);
        }
    });

    socket.on('room:synced', (data) => {
        broadcastToNetflixTab({ type: 'CINELOG_SYNC', payload: data });
    });

    socket.on('room:state_request', () => {
        broadcastToNetflixTab({ type: 'CINELOG_STATE_REQUEST' });
    });

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
    const tabs = await chrome.tabs.query({ url: 'https://www.netflix.com/*' });
    for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
}

function notifyPopup(message) {
    chrome.runtime.sendMessage(message).catch(() => {});
}

// ── Messages ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'CINELOG_SET_TOKEN': {
            const { token } = message;
            chrome.storage.local.set({ cinelogToken: token });
            connectSocket(token);
            sendResponse({ ok: true });
            break;
        }
        case 'CINELOG_LOGOUT': {
            if (socket) { socket.disconnect(); socket = null; }
            currentRoomCode = null;
            chrome.storage.local.remove('cinelogToken');
            chrome.storage.session.clear();
            sendResponse({ ok: true });
            break;
        }
        case 'CINELOG_JOIN_ROOM': {
            const { roomCode } = message;
            currentRoomCode = roomCode;
            chrome.storage.session.set({ roomCode });
            if (socket) socket.emit('room:join_socket', roomCode);
            broadcastToNetflixTab({ type: 'CINELOG_ROOM_JOINED', roomCode });
            sendResponse({ ok: true });
            break;
        }
        case 'CINELOG_LEAVE_ROOM': {
            if (socket && currentRoomCode) {
                socket.emit('room:leave_socket', currentRoomCode);
            }
            broadcastToNetflixTab({ type: 'CINELOG_ROOM_LEFT' });
            currentRoomCode = null;
            chrome.storage.session.remove('roomCode');
            sendResponse({ ok: true });
            break;
        }
        case 'CINELOG_EMIT_SYNC': {
            if (socket && currentRoomCode) {
                socket.emit('room:sync', { roomCode: currentRoomCode, ...message });
            }
            sendResponse({ ok: true });
            break;
        }
        case 'CINELOG_EMIT_CHAT': {
            if (socket && currentRoomCode) {
                socket.emit('room:chat', { roomCode: currentRoomCode, ...message.payload });
            }
            sendResponse({ ok: true });
            break;
        }
        case 'CINELOG_REQUEST_STATE': {
            if (socket && currentRoomCode) {
                socket.emit('room:request_state', { roomCode: currentRoomCode });
            }
            sendResponse({ ok: true });
            break;
        }
        case 'CINELOG_EMIT_STATE_RESPONSE': {
            if (socket && currentRoomCode) {
                socket.emit('room:state_response', { roomCode: currentRoomCode, state: message.state });
            }
            sendResponse({ ok: true });
            break;
        }
        case 'CINELOG_GET_STATUS': {
            sendResponse({
                connected: socket?.connected || false,
                roomCode: currentRoomCode,
                token: authToken
            });
            break;
        }
    }
    return true; 
});

// ── Boot ──────────────────────────────────────────────────────────────────

chrome.storage.local.get('cinelogToken', ({ cinelogToken }) => {
    if (cinelogToken) connectSocket(cinelogToken);
});

chrome.storage.session.get('roomCode', ({ roomCode }) => {
    if (roomCode) currentRoomCode = roomCode;
});
