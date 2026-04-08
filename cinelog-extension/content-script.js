/**
 * CineLog Extension — Content Script (injected into netflix.com/watch/*)
 *
 * KEY FIX: The overlay and video watcher now initialize dynamically when
 * the user joins a room from the popup, without requiring a page refresh.
 * The background worker sends CINELOG_ROOM_JOINED after any room join.
 */

(function () {
    'use strict';

    const BACKEND_URL = 'http://127.0.0.1:5000';
    const SYNC_DEBOUNCE_MS = 300;
    const SEEK_TOLERANCE_S = 2;

    let video = null;
    let isSyncing = false;
    let syncTimeout = null;
    let roomCode = null;
    let currentUser = null;
    let chatOverlayVisible = true;
    let videoWatcherInterval = null;
    let initialized = false; // guard: don't double-init

    // ── Helpers ─────────────────────────────────────────────────────────────

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

    function applySeekIfNeeded(targetTime) {
        if (Math.abs(video.currentTime - targetTime) > SEEK_TOLERANCE_S) {
            video.currentTime = targetTime;
        }
    }

    function attachVideoListeners() {
        if (!video) return;
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('seeked', onSeeked);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('seeked', onSeeked);
        console.log('[CineLog] Video listeners attached');
    }

    // ── Persistent video watcher ─────────────────────────────────────────────
    // Polls every second so any new <video> (e.g. after title navigation) gets picked up

    function startVideoWatcher() {
        if (videoWatcherInterval) return;
        videoWatcherInterval = setInterval(() => {
            const v = document.querySelector('video');
            if (v && v !== video) {
                video = v;
                attachVideoListeners();
            }
        }, 1000);
        // Also check immediately
        const v = document.querySelector('video');
        if (v) { video = v; attachVideoListeners(); }
    }

    function stopVideoWatcher() {
        if (videoWatcherInterval) {
            clearInterval(videoWatcherInterval);
            videoWatcherInterval = null;
        }
        if (video) {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('seeked', onSeeked);
            video = null;
        }
    }

    // ── Core initializer ─────────────────────────────────────────────────────
    // Called either at page load (if already in a room) OR dynamically
    // when the background sends CINELOG_ROOM_JOINED

    function activate(code, user) {
        if (initialized) return;
        initialized = true;
        roomCode = code;
        currentUser = user;

        console.log('[CineLog] Activated for room:', roomCode);
        startVideoWatcher();
        injectChatOverlay();
        showBadge(`🎬 CineLog • Room ${roomCode}`);

        // Request current state from existing members (catch-up for late joiner)
        setTimeout(() => {
            chrome.runtime.sendMessage({ type: 'CINELOG_REQUEST_STATE' });
        }, 1500);
    }

    function deactivate() {
        initialized = false;
        roomCode = null;
        stopVideoWatcher();
        const overlay = document.getElementById('cinelog-chat-overlay');
        if (overlay) overlay.remove();
        showBadge('CineLog • Left room');
    }

    // ── Auto-join via REST (for ?clroom= URL param) ──────────────────────────

    async function autoJoinRoom(code) {
        const { cinelogToken } = await chrome.storage.local.get('cinelogToken');
        if (!cinelogToken) return;

        try {
            const res = await fetch(`${BACKEND_URL}/api/rooms/${code}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cinelogToken}`
                }
            });
            if (res.ok) {
                chrome.runtime.sendMessage({ type: 'CINELOG_JOIN_ROOM', roomCode: code });
                // activate() will be called when background echoes CINELOG_ROOM_JOINED
            }
        } catch (e) {
            console.warn('[CineLog] Auto-join failed:', e);
        }
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    // Only activates if already in a room at page load time

    function init() {
        const params = new URLSearchParams(window.location.search);
        const urlRoom = params.get('clroom');

        chrome.storage.session.get('roomCode', ({ roomCode: storedRoom }) => {
            const code = urlRoom || storedRoom || null;

            if (urlRoom) {
                chrome.storage.session.set({ roomCode: urlRoom });
                autoJoinRoom(urlRoom);
                return; // activate() triggered by CINELOG_ROOM_JOINED echo
            }

            if (code) {
                chrome.storage.local.get(['cinelogToken', 'cinelogUser'], ({ cinelogToken, cinelogUser }) => {
                    if (cinelogToken) {
                        activate(code, cinelogUser || null);
                    }
                });
            }
        });
    }

    // ── Message listener ─────────────────────────────────────────────────────

    chrome.runtime.onMessage.addListener((message) => {

        switch (message.type) {

            // KEY FIX: Background fires this when popup joins a room.
            // This makes overlay appear WITHOUT a Netflix page refresh.
            case 'CINELOG_ROOM_JOINED': {
                chrome.storage.local.get('cinelogUser', ({ cinelogUser }) => {
                    activate(message.roomCode, cinelogUser || null);
                });
                break;
            }

            // Room left from popup
            case 'CINELOG_ROOM_LEFT': {
                deactivate();
                break;
            }

            case 'CINELOG_SYNC': {
                if (!video) return;
                const { action, currentTime } = message.payload;

                isSyncing = true;
                clearTimeout(syncTimeout);

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

            // Someone new joined and is asking for current state
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

            // We received the state from another member — seek to catch up
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
                const mins = Math.floor(currentTime / 60);
                const secs = String(Math.floor(currentTime % 60)).padStart(2, '0');
                showBadge(`Synced to ${mins}:${secs}`);
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
                deactivate();
                break;
            }
        }
    });

    // ── Chat overlay ─────────────────────────────────────────────────────────

    function injectChatOverlay() {
        if (document.getElementById('cinelog-chat-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'cinelog-chat-overlay';
        overlay.innerHTML = `
            <div id="cl-chat-header">
                <span>🎬 CineLog</span>
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
        const text = input.value.trim();
        input.value = '';
        chrome.runtime.sendMessage({
            type: 'CINELOG_EMIT_CHAT',
            payload: {
                message: text,
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

    // ── Styles ───────────────────────────────────────────────────────────────

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

    // ── Start ─────────────────────────────────────────────────────────────────
    init();

})();
