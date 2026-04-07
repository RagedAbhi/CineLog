/**
 * CineLog Extension — Content Script (injected into netflix.com/watch/*)
 *
 * Responsibilities:
 * - Finds the Netflix <video> element and attaches play/pause/seek listeners.
 * - Sends sync events to the background service worker.
 * - Receives sync commands from background and applies them to the video.
 * - Injects a minimal chat overlay on the Netflix page.
 * - Auto-joins room if ?clroom=XXXX is in the URL.
 * - Requests current playback state from others when joining late (catch-up).
 */

(function () {
    'use strict';

    const BACKEND_URL = 'http://127.0.0.1:5000'; // FIX #1: Use local dev server, not Render
    const SYNC_DEBOUNCE_MS = 300;
    const SEEK_TOLERANCE_S = 2; // seconds of drift before forcing a seek

    let video = null;
    let isSyncing = false; // guard against echo loops
    let syncTimeout = null;
    let roomCode = null;
    let currentUser = null;
    let chatOverlayVisible = true;
    let videoWatcherInterval = null; // FIX #3: persistent video watcher handle

    // ── Init ────────────────────────────────────────────────────────────────

    function init() {
        // Check URL for room code
        const params = new URLSearchParams(window.location.search);
        const urlRoom = params.get('clroom');

        chrome.storage.session.get('roomCode', ({ roomCode: storedRoom }) => {
            roomCode = urlRoom || storedRoom || null;

            if (roomCode && urlRoom) {
                // Store it so it persists through Netflix's own redirects
                chrome.storage.session.set({ roomCode });
                autoJoinRoom(roomCode);
            }

            chrome.storage.local.get(['cinelogToken', 'cinelogUser'], ({ cinelogToken, cinelogUser }) => {
                if (cinelogToken && roomCode) {
                    currentUser = cinelogUser || null;
                    startVideoWatcher(); // FIX #3: use persistent watcher
                    injectChatOverlay();
                    // FIX #4: Request state from existing room members (catch-up)
                    requestRoomState();
                }
            });
        });
    }

    // ── Auto-join via REST ──────────────────────────────────────────────────

    async function autoJoinRoom(code) {
        const { cinelogToken } = await chrome.storage.local.get('cinelogToken');
        if (!cinelogToken) return;

        try {
            // FIX #1: Use BACKEND_URL constant, not hardcoded Render URL
            const res = await fetch(`${BACKEND_URL}/api/rooms/${code}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cinelogToken}`
                }
            });
            if (res.ok) {
                chrome.runtime.sendMessage({ type: 'CINELOG_JOIN_ROOM', roomCode: code });
                showBadge(`Joined room ${code}`);
            }
        } catch (e) {
            console.warn('[CineLog] Auto-join failed:', e);
        }
    }

    // ── FIX #4: Catch-up: request current state from host ──────────────────

    function requestRoomState() {
        // Give other members a moment to be ready, then ask for current state
        setTimeout(() => {
            chrome.runtime.sendMessage({ type: 'CINELOG_REQUEST_STATE' });
        }, 1500);
    }

    // ── FIX #3: Persistent video watcher ───────────────────────────────────
    // Instead of a one-shot MutationObserver that stops when video is found,
    // we poll every second so any new <video> (e.g. after title navigation) is picked up.

    function startVideoWatcher() {
        if (videoWatcherInterval) return; // already running
        videoWatcherInterval = setInterval(() => {
            const v = document.querySelector('video');
            if (v && v !== video) {
                video = v;
                attachVideoListeners();
                console.log('[CineLog] New video element detected & listeners attached');
            }
        }, 1000);
    }

    function attachVideoListeners() {
        if (!video) return;
        // Remove old listeners first to avoid duplicates
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('seeked', onSeeked);

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('seeked', onSeeked);
    }

    function emitSync(action, currentTime) {
        if (isSyncing) return;
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            chrome.runtime.sendMessage({ type: 'CINELOG_EMIT_SYNC', action, currentTime });
        }, SYNC_DEBOUNCE_MS);
    }

    function onPlay()   { emitSync('play',  video.currentTime); }
    function onPause()  { emitSync('pause', video.currentTime); }
    function onSeeked() { emitSync('seek',  video.currentTime); }

    // ── Receive sync from background ────────────────────────────────────────

    chrome.runtime.onMessage.addListener((message) => {

        switch (message.type) {

            case 'CINELOG_SYNC': {
                if (!video) return;
                const { action, currentTime } = message.payload;

                // FIX #2: Set isSyncing flag BEFORE triggering video actions,
                // and clear it AFTER the event fully settles (1000ms gives buffer
                // for Netflix's own async event chain to complete).
                isSyncing = true;
                clearTimeout(syncTimeout); // cancel any pending outbound sync

                if (action === 'play') {
                    applySeekIfNeeded(currentTime);
                    video.play().catch(() => {});
                } else if (action === 'pause') {
                    applySeekIfNeeded(currentTime);
                    video.pause();
                } else if (action === 'seek') {
                    video.currentTime = currentTime;
                }

                setTimeout(() => { isSyncing = false; }, 1000);
                break;
            }

            // FIX #4: Someone new joined and is asking for current state
            case 'CINELOG_STATE_REQUEST': {
                if (!video) return;
                chrome.runtime.sendMessage({
                    type: 'CINELOG_EMIT_STATE_RESPONSE',
                    state: {
                        currentTime: video.currentTime,
                        paused: video.paused
                    }
                });
                break;
            }

            // FIX #4: We received the state from the host — seek to catch up
            case 'CINELOG_STATE_RESPONSE': {
                if (!video) return;
                const { currentTime, paused } = message.state;
                isSyncing = true;
                video.currentTime = currentTime;
                if (paused) {
                    video.pause();
                } else {
                    video.play().catch(() => {});
                }
                showBadge(`Synced to ${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')}`);
                setTimeout(() => { isSyncing = false; }, 1000);
                break;
            }

            case 'CINELOG_CHAT': {
                appendChatMessage(message.payload);
                break;
            }
            case 'CINELOG_MEMBER_JOIN': {
                showBadge(`${message.payload.user?.username || 'Someone'} joined`);
                break;
            }
            case 'CINELOG_MEMBER_LEFT': {
                showBadge(`${message.payload.user?.username || 'Someone'} left`);
                break;
            }
            case 'CINELOG_DISSOLVED': {
                showBadge('Host ended the room', 4000);
                break;
            }
        }
    });

    function applySeekIfNeeded(targetTime) {
        if (Math.abs(video.currentTime - targetTime) > SEEK_TOLERANCE_S) {
            video.currentTime = targetTime;
        }
    }

    // ── Chat overlay ────────────────────────────────────────────────────────

    function injectChatOverlay() {
        if (document.getElementById('cinelog-chat-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'cinelog-chat-overlay';
        overlay.innerHTML = `
            <div id="cl-chat-header">
                <span>💬 CineLog</span>
                <button id="cl-chat-toggle">—</button>
            </div>
            <div id="cl-chat-messages"></div>
            <div id="cl-chat-input-row">
                <input id="cl-chat-input" placeholder="Say something…" maxlength="200" />
                <button id="cl-chat-send">➤</button>
            </div>
        `;
        document.body.appendChild(overlay);
        injectChatStyles();

        document.getElementById('cl-chat-toggle').addEventListener('click', toggleChat);
        document.getElementById('cl-chat-send').addEventListener('click', sendChat);
        document.getElementById('cl-chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendChat();
        });
    }

    function toggleChat() {
        chatOverlayVisible = !chatOverlayVisible;
        const messages = document.getElementById('cl-chat-messages');
        const inputRow = document.getElementById('cl-chat-input-row');
        const btn = document.getElementById('cl-chat-toggle');
        if (messages) messages.style.display = chatOverlayVisible ? 'flex' : 'none';
        if (inputRow) inputRow.style.display = chatOverlayVisible ? 'flex' : 'none';
        if (btn) btn.textContent = chatOverlayVisible ? '—' : '+';
    }

    function sendChat() {
        const input = document.getElementById('cl-chat-input');
        if (!input || !input.value.trim()) return;
        const message = input.value.trim();
        input.value = '';
        chrome.runtime.sendMessage({
            type: 'CINELOG_EMIT_CHAT',
            payload: {
                message,
                userId: currentUser?._id,
                username: currentUser?.username || 'You',
                avatar: currentUser?.profilePicture
            }
        });
    }

    function appendChatMessage({ username, message, userId }) {
        const container = document.getElementById('cl-chat-messages');
        if (!container) return;

        const isOwn = userId && currentUser && userId === (currentUser._id || currentUser.id);
        const div = document.createElement('div');
        div.className = `cl-msg${isOwn ? ' cl-msg-own' : ''}`;
        div.innerHTML = `<span class="cl-msg-user">${escapeHtml(username)}</span><span class="cl-msg-text">${escapeHtml(message)}</span>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;

        // Auto-fade older messages (keep last 30)
        const msgs = container.querySelectorAll('.cl-msg');
        if (msgs.length > 30) msgs[0].remove();
    }

    function showBadge(text, duration = 2500) {
        let badge = document.getElementById('cl-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'cl-badge';
            document.body.appendChild(badge);
            injectBadgeStyles();
        }
        badge.textContent = text;
        badge.style.opacity = '1';
        clearTimeout(badge._timeout);
        badge._timeout = setTimeout(() => { badge.style.opacity = '0'; }, duration);
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Injected styles ─────────────────────────────────────────────────────

    function injectChatStyles() {
        if (document.getElementById('cl-chat-styles')) return;
        const style = document.createElement('style');
        style.id = 'cl-chat-styles';
        style.textContent = `
            #cinelog-chat-overlay {
                position: fixed;
                bottom: 80px;
                right: 20px;
                width: 280px;
                background: rgba(10, 10, 18, 0.92);
                border: 1px solid rgba(129, 140, 248, 0.2);
                border-radius: 16px;
                z-index: 99999;
                font-family: system-ui, sans-serif;
                color: #fff;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            }
            #cl-chat-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                background: rgba(129,140,248,0.1);
                border-bottom: 1px solid rgba(129,140,248,0.15);
                font-size: 13px;
                font-weight: 600;
            }
            #cl-chat-toggle {
                background: none;
                border: none;
                color: rgba(255,255,255,0.5);
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
            }
            #cl-chat-messages {
                height: 180px;
                overflow-y: auto;
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .cl-msg { display: flex; flex-direction: column; gap: 1px; }
            .cl-msg-own { align-items: flex-end; }
            .cl-msg-user { font-size: 10px; color: rgba(255,255,255,0.45); font-weight: 600; }
            .cl-msg-text {
                background: rgba(255,255,255,0.07);
                border-radius: 8px;
                padding: 5px 9px;
                font-size: 13px;
                max-width: 90%;
                word-break: break-word;
            }
            .cl-msg-own .cl-msg-text { background: rgba(129,140,248,0.2); }
            #cl-chat-input-row {
                display: flex;
                border-top: 1px solid rgba(255,255,255,0.06);
            }
            #cl-chat-input {
                flex: 1;
                background: transparent;
                border: none;
                padding: 10px 12px;
                color: #fff;
                font-size: 13px;
                outline: none;
            }
            #cl-chat-send {
                width: 38px;
                background: transparent;
                border: none;
                border-left: 1px solid rgba(255,255,255,0.06);
                color: #818cf8;
                cursor: pointer;
                font-size: 14px;
            }
            #cl-chat-send:hover { background: rgba(129,140,248,0.1); }
        `;
        document.head.appendChild(style);
    }

    function injectBadgeStyles() {
        if (document.getElementById('cl-badge-styles')) return;
        const style = document.createElement('style');
        style.id = 'cl-badge-styles';
        style.textContent = `
            #cl-badge {
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(10,10,18,0.92);
                border: 1px solid rgba(129,140,248,0.25);
                color: #fff;
                padding: 8px 20px;
                border-radius: 100px;
                font-size: 13px;
                font-family: system-ui, sans-serif;
                font-weight: 500;
                z-index: 99999;
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    // ── Start ───────────────────────────────────────────────────────────────
    init();

})();
