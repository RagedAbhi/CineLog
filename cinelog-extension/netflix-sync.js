/**
 * CineLog Extension — Version 1.2.0 (Content Script)
 * Renamed to force cache refresh.
 */

(function () {
    'use strict';

    console.log('%c🎬 [CineLog] Version 1.2.0 Loaded! %cRefreshing Sync Engine...', 'color: #818cf8; font-size: 16px; font-weight: bold;', 'color: #888; font-size: 12px;');

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
    let initialized = false; 

    // ── Communication ───────────────────────────────────────────────────────

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

    // ── Video lifecycle ─────────────────────────────────────────────────────

    function attachVideoListeners() {
        if (!video) return;
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('seeked', onSeeked);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('seeked', onSeeked);
        console.log('[CineLog] Video listeners synchronized');
    }

    function startVideoWatcher() {
        if (videoWatcherInterval) return;
        videoWatcherInterval = setInterval(() => {
            const v = document.querySelector('video');
            if (v && v !== video) {
                video = v;
                attachVideoListeners();
            }
        }, 1000);
        const v = document.querySelector('video');
        if (v) { video = v; attachVideoListeners(); }
    }

    // ── Activation ──────────────────────────────────────────────────────────

    function activate(code, user) {
        if (initialized) return;
        initialized = true;
        roomCode = code;
        currentUser = user;

        console.log('[CineLog] Joining room:', roomCode);
        startVideoWatcher();

        const isWatchPage = window.location.pathname.includes('/watch/');
        if (isWatchPage) {
            injectChatOverlay();
            showBadge(`🎬 CineLog • Connected to ${roomCode}`);
            setTimeout(() => {
                chrome.runtime.sendMessage({ type: 'CINELOG_REQUEST_STATE' });
            }, 1500);
        } else {
            showBadge(`🎬 CineLog • Joined ${roomCode}! Play a movie to start sync.`, 5000);
        }
    }

    function deactivate() {
        initialized = false;
        roomCode = null;
        if (videoWatcherInterval) { clearInterval(videoWatcherInterval); videoWatcherInterval = null; }
        const overlay = document.getElementById('cinelog-chat-overlay');
        if (overlay) overlay.remove();
        showBadge('CineLog • Left session');
    }

    // ── Init ────────────────────────────────────────────────────────────────

    async function autoJoinRoom(code) {
        const { cinelogToken } = await chrome.storage.local.get('cinelogToken');
        if (!cinelogToken) return;

        try {
            const res = await fetch(`${BACKEND_URL}/api/rooms/${code}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cinelogToken}` }
            });
            if (res.ok) {
                chrome.runtime.sendMessage({ type: 'CINELOG_JOIN_ROOM', roomCode: code });
            }
        } catch (e) { console.warn('[CineLog] Auto-join error:', e); }
    }

    function init() {
        const params = new URLSearchParams(window.location.search);
        const urlRoom = params.get('clroom');

        chrome.runtime.sendMessage({ type: 'CINELOG_GET_STATUS' }, (status) => {
            if (chrome.runtime.lastError || !status) return;

            const code = urlRoom || status.roomCode || null;
            if (urlRoom && urlRoom !== status.roomCode) {
                autoJoinRoom(urlRoom);
                return;
            }

            if (code) {
                chrome.storage.local.get(['cinelogToken', 'cinelogUser'], ({ cinelogToken, cinelogUser }) => {
                    if (cinelogToken) activate(code, cinelogUser || null);
                });
            }
        });
    }

    // ── Messages ────────────────────────────────────────────────────────────

    chrome.runtime.onMessage.addListener((message) => {
        switch (message.type) {
            case 'CINELOG_ROOM_JOINED': {
                chrome.storage.local.get('cinelogUser', ({ cinelogUser }) => {
                    activate(message.roomCode, cinelogUser || null);
                });
                break;
            }
            case 'CINELOG_ROOM_LEFT': { deactivate(); break; }
            case 'CINELOG_SYNC': {
                if (!video) return;
                const { action, currentTime } = message.payload;
                isSyncing = true;
                if (action === 'play') { applySeekIfNeeded(currentTime); video.play().catch(() => {}); }
                else if (action === 'pause') { applySeekIfNeeded(currentTime); video.pause(); }
                else if (action === 'seek') { video.currentTime = currentTime; }
                setTimeout(() => { isSyncing = false; }, 1000);
                break;
            }
            case 'CINELOG_STATE_REQUEST': {
                if (!video) return;
                chrome.runtime.sendMessage({
                    type: 'CINELOG_EMIT_STATE_RESPONSE',
                    state: { currentTime: video.currentTime, paused: video.paused }
                });
                break;
            }
            case 'CINELOG_STATE_RESPONSE': {
                if (!video) return;
                const { currentTime, paused } = message.state;
                isSyncing = true;
                video.currentTime = currentTime;
                if (paused) video.pause(); else video.play().catch(() => {});
                showBadge('Synced with room');
                setTimeout(() => { isSyncing = false; }, 1000);
                break;
            }
            case 'CINELOG_CHAT': { appendChatMessage(message.payload); break; }
            case 'CINELOG_MEMBER_JOIN': { showBadge(`${message.payload.user?.username || 'Friend'} joined`); break; }
            case 'CINELOG_MEMBER_LEFT': { showBadge(`${message.payload.user?.username || 'Friend'} left`); break; }
            case 'CINELOG_DISSOLVED': { showBadge('Host ended session', 4000); deactivate(); break; }
        }
    });

    // ── UI (Chat & Badge) ───────────────────────────────────────────────────

    function injectChatOverlay() {
        if (document.getElementById('cinelog-chat-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'cinelog-chat-overlay';
        overlay.innerHTML = `
            <div id="cl-chat-header"><span>🎬 CineLog</span><button id="cl-chat-toggle">—</button></div>
            <div id="cl-chat-messages"></div>
            <div id="cl-chat-input-row">
                <input id="cl-chat-input" placeholder="Chat with room…" maxlength="200" />
                <button id="cl-chat-send">➤</button>
            </div>
        `;
        document.body.appendChild(overlay);
        injectStyles();
        document.getElementById('cl-chat-toggle').onclick = () => {
            chatOverlayVisible = !chatOverlayVisible;
            document.getElementById('cl-chat-messages').style.display = chatOverlayVisible ? 'flex' : 'none';
            document.getElementById('cl-chat-input-row').style.display = chatOverlayVisible ? 'flex' : 'none';
            document.getElementById('cl-chat-toggle').textContent = chatOverlayVisible ? '—' : '+';
        };
        document.getElementById('cl-chat-send').onclick = sendChat;
        document.getElementById('cl-chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
    }

    function sendChat() {
        const input = document.getElementById('cl-chat-input');
        if (!input || !input.value.trim()) return;
        const text = input.value.trim();
        input.value = '';
        chrome.runtime.sendMessage({ type: 'CINELOG_EMIT_CHAT', payload: {
            message: text, userId: currentUser?._id, username: currentUser?.username || 'You'
        }});
    }

    function appendChatMessage({ username, message, userId }) {
        const container = document.getElementById('cl-chat-messages');
        if (!container) return;
        const isOwn = userId && currentUser && userId === (currentUser._id || currentUser.id);
        const div = document.createElement('div');
        div.className = `cl-msg${isOwn ? ' cl-msg-own' : ''}`;
        div.innerHTML = `<span class="cl-msg-user">${String(username).replace(/</g,'&lt;')}</span><span class="cl-msg-text">${String(message).replace(/</g,'&lt;')}</span>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        if (container.children.length > 50) container.children[0].remove();
    }

    function showBadge(text, duration = 3000) {
        let badge = document.getElementById('cl-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'cl-badge';
            document.body.appendChild(badge);
        }
        badge.textContent = text;
        badge.style.opacity = '1';
        clearTimeout(badge._timeout);
        badge._timeout = setTimeout(() => { badge.style.opacity = '0'; }, duration);
    }

    function injectStyles() {
        if (document.getElementById('cl-styles')) return;
        const style = document.createElement('style');
        style.id = 'cl-styles';
        style.textContent = `
            #cl-badge { position: fixed; top: 80px; left: 50%; transform: translateX(-50%); background: rgba(10,10,18,0.9); border: 1px solid rgba(129,140,248,0.2); color: #fff; padding: 10px 24px; border-radius: 100px; font-size: 13px; font-weight: 500; z-index: 100000; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
            #cinelog-chat-overlay { position: fixed; bottom: 100px; right: 28px; width: 300px; background: rgba(10,10,18,0.92); border: 1px solid rgba(129,140,248,0.2); border-radius: 16px; z-index: 100000; color: #fff; box-shadow: 0 12px 48px rgba(0,0,0,0.5); font-family: sans-serif; overflow: hidden; }
            #cl-chat-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(129,140,248,0.1); border-bottom: 1px solid rgba(129,140,248,0.1); font-weight: 600; font-size: 14px; }
            #cl-chat-toggle { background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 18px; }
            #cl-chat-messages { height: 220px; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
            .cl-msg { display: flex; flex-direction: column; gap: 2px; }
            .cl-msg-own { align-items: flex-end; }
            .cl-msg-user { font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 600; }
            .cl-msg-text { background: rgba(255,255,255,0.06); border-radius: 10px; padding: 6px 12px; font-size: 13px; max-width: 85%; }
            .cl-msg-own .cl-msg-text { background: rgba(129,140,248,0.2); }
            #cl-chat-input-row { display: flex; border-top: 1px solid rgba(255,255,255,0.06); }
            #cl-chat-input { flex: 1; background: transparent; border: none; padding: 12px; color: #fff; outline: none; font-size: 13px; }
            #cl-chat-send { width: 44px; background: none; border: none; color: #818cf8; cursor: pointer; border-left: 1px solid rgba(255,255,255,0.06); }
        `;
        document.head.appendChild(style);
    }

    init();
})();
