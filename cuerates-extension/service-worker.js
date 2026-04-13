/**
 * Cuerates Extension — Service Worker v5.1
 * Lightweight Auth/Storage Bridge
 */

const BACKEND_URL = 'https://cuerates.onrender.com';

console.log('[Cuerates] Service Worker v5.1 Active');

// ── Helpers ───────────────────────────────────────────────────────────────

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

        case 'CUERATES_SET_TOKEN': {
            const { token, user } = message;
            chrome.storage.local.set({ cueratesToken: token, cueratesUser: user });
            sendResponse({ ok: true });
            break;
        }

        case 'CUERATES_LOGOUT': {
            chrome.storage.local.remove(['cueratesToken', 'cueratesUser']);
            chrome.storage.session.clear();
            broadcastToNetflixTabs({ type: 'CUERATES_ROOM_LEFT' });
            sendResponse({ ok: true });
            break;
        }

        case 'CUERATES_JOIN_ROOM': {
            chrome.storage.session.set({ roomCode: message.roomCode });
            broadcastToNetflixTabs({ type: 'CUERATES_ROOM_JOINED', roomCode: message.roomCode });
            sendResponse({ ok: true });
            break;
        }

        case 'CUERATES_LEAVE_ROOM': {
            chrome.storage.session.remove('roomCode');
            broadcastToNetflixTabs({ type: 'CUERATES_ROOM_LEFT' });
            sendResponse({ ok: true });
            break;
        }

        case 'CUERATES_GET_STATUS': {
            Promise.all([
                chrome.storage.local.get(['cueratesToken', 'cueratesUser']),
                chrome.storage.session.get('roomCode')
            ]).then(([local, session]) => {
                sendResponse({
                    token: local.cueratesToken || null,
                    user: local.cueratesUser || null,
                    roomCode: session.roomCode || null
                });
            });
            return true; // async sendResponse
        }
    }
    return true; 
});
