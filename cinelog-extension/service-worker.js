/**
 * CineLog Extension — Service Worker v2.0
 *
 * The service worker is now a lightweight auth + popup bridge.
 * ALL real-time sync goes directly from netflix-sync.js (content script)
 * to the CineLog server over its own socket — bypassing this worker
 * entirely so Chrome's service-worker suspension never breaks sync.
 *
 * Responsibilities:
 *  - Store / restore auth token in chrome.storage.local
 *  - Store active room code in chrome.storage.session
 *  - Notify open Netflix tabs when room is joined or left (from popup)
 *  - Handle popup↔background communication
 */

const BACKEND_URL = 'http://127.0.0.1:5000';

// ── Helpers ───────────────────────────────────────────────────────────────

async function broadcastToNetflixTabs(message) {
    try {
        const tabs = await chrome.tabs.query({ url: 'https://www.netflix.com/*' });
        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        }
    } catch (_) {}
}

function notifyPopup(message) {
    chrome.runtime.sendMessage(message).catch(() => {});
}

// ── Message handler ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
        switch (message.type) {

            // ── Auth ──────────────────────────────────────────────────────

            case 'CINELOG_SET_TOKEN': {
                await chrome.storage.local.set({ cinelogToken: message.token });
                sendResponse({ ok: true });
                break;
            }

            case 'CINELOG_LOGOUT': {
                await chrome.storage.local.remove(['cinelogToken', 'cinelogUser']);
                await chrome.storage.session.clear();
                broadcastToNetflixTabs({ type: 'CINELOG_ROOM_LEFT' });
                sendResponse({ ok: true });
                break;
            }

            // ── Room ──────────────────────────────────────────────────────
            // Called by:
            //   a) netflix-sync.js after auto-joining from URL param
            //   b) popup.js after user joins via code input

            case 'CINELOG_JOIN_ROOM': {
                await chrome.storage.session.set({ roomCode: message.roomCode });
                // Notify all open Netflix tabs so they activate sync
                broadcastToNetflixTabs({ type: 'CINELOG_ROOM_JOINED', roomCode: message.roomCode });
                sendResponse({ ok: true });
                break;
            }

            case 'CINELOG_LEAVE_ROOM': {
                const { roomCode } = await chrome.storage.session.get('roomCode');
                if (roomCode) {
                    // Best-effort REST leave (content script may have already done it)
                    const { cinelogToken } = await chrome.storage.local.get('cinelogToken');
                    if (cinelogToken) {
                        fetch(`${BACKEND_URL}/api/rooms/${roomCode}/leave`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${cinelogToken}` }
                        }).catch(() => {});
                    }
                }
                await chrome.storage.session.remove('roomCode');
                broadcastToNetflixTabs({ type: 'CINELOG_ROOM_LEFT' });
                sendResponse({ ok: true });
                break;
            }

            // ── Status poll (from popup and content script) ────────────────

            case 'CINELOG_GET_STATUS': {
                const { cinelogToken } = await chrome.storage.local.get('cinelogToken');
                const { roomCode }     = await chrome.storage.session.get('roomCode');
                sendResponse({ token: cinelogToken || null, roomCode: roomCode || null });
                break;
            }

            default:
                sendResponse({ ok: false });
        }
    })();

    return true; // keep channel open for async sendResponse
});

// ── Tab navigation: push room code to newly loaded Netflix watch pages ────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!tab.url?.includes('netflix.com')) return;

    const { roomCode } = await chrome.storage.session.get('roomCode');
    if (!roomCode) return;

    // Small delay to let the content script initialise
    setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: 'CINELOG_ROOM_JOINED', roomCode }).catch(() => {});
    }, 1500);
});
