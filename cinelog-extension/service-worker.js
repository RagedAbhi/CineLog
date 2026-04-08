/**
 * CineLog Extension — Service Worker v3.0
 * Standardized stability update.
 */

importScripts('./socket.io.min.js');

const BACKEND_URL = 'http://127.0.0.1:5000';

let socket = null;
let currentRoomCode = null;
let authToken = null;
let currentUser = null;

console.log('[CineLog] Service Worker v3.0 Initialized');

// ── Socket lifecycle ───────────────────────────────────────────────────────

function connectSocket(token) {
    if (socket && socket.connected) return;

    authToken = token;
    socket = io(BACKEND_URL, { 
        transports: ['websocket'],
        auth: { token }
    });

    socket.on('connect', () => {
        console.log('[CineLog] Socket connected:', socket.id);
        if (currentRoomCode) {
            socket.emit('room:join_socket', currentRoomCode);
        }
    });

    socket.on('room:synced', (data) => {
        broadcastToNetflixTabs({ type: 'CINELOG_SYNC', payload: data });
    });

    socket.on('room:state_request', (data) => {
        broadcastToNetflixTabs({ type: 'CINELOG_STATE_REQUEST', requesterSocketId: data.requesterSocketId });
    });

    socket.on('room:state_response', (data) => {
        broadcastToNetflixTabs({ type: 'CINELOG_STATE_RESPONSE', state: data.state });
    });

    socket.on('room:message', (data) => {
        broadcastToNetflixTabs({ type: 'CINELOG_CHAT', payload: data });
    });

    socket.on('room:member_join', (data) => {
        broadcastToNetflixTabs({ type: 'CINELOG_MEMBER_JOIN', payload: data });
    });

    socket.on('room:member_left', (data) => {
        broadcastToNetflixTabs({ type: 'CINELOG_MEMBER_LEFT', payload: data });
    });

    socket.on('room:dissolved', () => {
        broadcastToNetflixTabs({ type: 'CINELOG_DISSOLVED' });
        currentRoomCode = null;
        chrome.storage.session.remove('roomCode');
    });

    socket.on('disconnect', () => {
        console.log('[CineLog] Socket disconnected');
    });
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function broadcastToNetflixTabs(message) {
    try {
        const tabs = await chrome.tabs.query({ url: 'https://www.netflix.com/*' });
        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        }
    } catch (_) {}
}

// ── Message handler ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {

        case 'CINELOG_SET_TOKEN': {
            const { token, user } = message;
            chrome.storage.local.set({ cinelogToken: token, cinelogUser: user });
            authToken = token;
            currentUser = user;
            connectSocket(token);
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_LOGOUT': {
            if (socket) { socket.disconnect(); socket = null; }
            currentRoomCode = null;
            chrome.storage.local.remove(['cinelogToken', 'cinelogUser']);
            chrome.storage.session.clear();
            broadcastToNetflixTabs({ type: 'CINELOG_ROOM_LEFT' });
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_JOIN_ROOM': {
            const { roomCode } = message;
            currentRoomCode = roomCode;
            chrome.storage.session.set({ roomCode });
            
            if (socket) {
                if (!socket.connected) connectSocket(authToken);
                socket.emit('room:join_socket', roomCode);
            }
            
            broadcastToNetflixTabs({ type: 'CINELOG_ROOM_JOINED', roomCode });
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_LEAVE_ROOM': {
            if (socket && currentRoomCode) {
                socket.emit('room:leave_socket', currentRoomCode);
            }
            broadcastToNetflixTabs({ type: 'CINELOG_ROOM_LEFT' });
            currentRoomCode = null;
            chrome.storage.session.remove('roomCode');
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_EMIT_SYNC': {
            if (socket && socket.connected && currentRoomCode) {
                socket.emit('room:sync', { 
                    roomCode: currentRoomCode, 
                    ...message.payload,
                    username: currentUser?.username || 'Someone'
                });
            }
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_EMIT_CHAT': {
            if (socket && socket.connected && currentRoomCode) {
                socket.emit('room:chat', { 
                    roomCode: currentRoomCode, 
                    ...message.payload,
                    username: currentUser?.username || 'Someone'
                });
            }
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_REQUEST_STATE': {
            if (socket && socket.connected && currentRoomCode) {
                socket.emit('room:request_state', { roomCode: currentRoomCode });
            }
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_EMIT_STATE_RESPONSE': {
            if (socket && socket.connected && currentRoomCode) {
                socket.emit('room:state_response', { 
                    roomCode: currentRoomCode, 
                    state: message.state 
                });
            }
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_GET_STATUS': {
            sendResponse({
                token: authToken,
                user: currentUser,
                roomCode: currentRoomCode,
                connected: socket?.connected || false
            });
            break;
        }
    }
    return true; 
});

// ── Startup ────────────────────────────────────────────────────────────────

chrome.storage.local.get(['cinelogToken', 'cinelogUser'], ({ cinelogToken, cinelogUser }) => {
    if (cinelogToken) {
        authToken = cinelogToken;
        currentUser = cinelogUser;
        connectSocket(cinelogToken);
    }
});

chrome.storage.session.get('roomCode', ({ roomCode }) => {
    if (roomCode) currentRoomCode = roomCode;
});
