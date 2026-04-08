/**
 * CineLog Extension — Service Worker v4.1
 * Lightweight Auth/Storage Bridge
 */

const BACKEND_URL = 'https://save-upper-beam-corp.trycloudflare.com';

console.log('[CineLog] Service Worker v4.1 Active');

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

        case 'CINELOG_SET_TOKEN': {
            const { token, user } = message;
            chrome.storage.local.set({ cinelogToken: token, cinelogUser: user });
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_LOGOUT': {
            chrome.storage.local.remove(['cinelogToken', 'cinelogUser']);
            chrome.storage.session.clear();
            broadcastToNetflixTabs({ type: 'CINELOG_ROOM_LEFT' });
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_JOIN_ROOM': {
            chrome.storage.session.set({ roomCode: message.roomCode });
            broadcastToNetflixTabs({ type: 'CINELOG_ROOM_JOINED', roomCode: message.roomCode });
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_LEAVE_ROOM': {
            chrome.storage.session.remove('roomCode');
            broadcastToNetflixTabs({ type: 'CINELOG_ROOM_LEFT' });
            sendResponse({ ok: true });
            break;
        }

        case 'CINELOG_GET_STATUS': {
            Promise.all([
                chrome.storage.local.get(['cinelogToken', 'cinelogUser']),
                chrome.storage.session.get('roomCode')
            ]).then(([local, session]) => {
                sendResponse({
                    token: local.cinelogToken || null,
                    user: local.cinelogUser || null,
                    roomCode: session.roomCode || null
                });
            });
            return true; // async sendResponse
        }
    }
    return true; 
});
