/**
 * CineLog Extension — Netflix Sync v3.0
 * Lightweight UI & Event Relay
 */

(function () {
    'use strict';

    const SYNC_DEBOUNCE_MS = 300;
    const SEEK_TOLERANCE_S = 2;

    let video       = null;
    let roomCode    = null;
    let currentUser = null;
    let activated   = false;
    let isSyncing   = false;
    let syncTimer   = null;
    let watcher     = null;
    let overlayVisible = true;

    console.log('%c🎬 [CineLog] Sync Engine v3.0 Loaded', 'color: #818cf8; font-size: 14px; font-weight: bold;');

    // ── Sync Relay ───────────────────────────────────────────────────────────

    function onPlay()   { if (!isSyncing) emitSync('play',  video.currentTime); }
    function onPause()  { if (!isSyncing) emitSync('pause', video.currentTime); }
    function onSeeked() { if (!isSyncing) emitSync('seek',  video.currentTime); }

    function emitSync(action, currentTime) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            chrome.runtime.sendMessage({ 
                type: 'CINELOG_EMIT_SYNC', 
                payload: { action, currentTime } 
            });
        }, SYNC_DEBOUNCE_MS);
    }

    function applySync(action, targetTime) {
        if (!video) return;
        isSyncing = true;

        if (Math.abs(video.currentTime - targetTime) > SEEK_TOLERANCE_S) {
            video.currentTime = targetTime;
        }

        if (action === 'play')  video.play().catch(() => {});
        if (action === 'pause') video.pause();
        if (action === 'seek')  video.currentTime = targetTime;

        setTimeout(() => { isSyncing = false; }, 1000);
    }

    // ── Video Watcher ────────────────────────────────────────────────────────

    function attachListeners() {
        if (!video) return;
        video.removeEventListener('play',   onPlay);
        video.removeEventListener('pause',  onPause);
        video.removeEventListener('seeked', onSeeked);
        video.addEventListener('play',   onPlay);
        video.addEventListener('pause',  onPause);
        video.addEventListener('seeked', onSeeked);
        console.log('[CineLog] Video listeners attached');
    }

    function startWatcher() {
        if (watcher) return;
        watcher = setInterval(() => {
            const v = document.querySelector('video');
            if (v && v !== video) {
                video = v;
                attachListeners();
            }
        }, 1000);
        const v = document.querySelector('video');
        if (v) { video = v; attachListeners(); }
    }

    // ── Activation ───────────────────────────────────────────────────────────

    function activate(code, user) {
        if (activated && roomCode === code) return;
        activated   = true;
        roomCode    = code;
        currentUser = user;

        startWatcher();

        const isWatchPage = window.location.pathname.includes('/watch/');
        if (isWatchPage) {
            injectOverlay();
            showBadge(`🎬 Connected to ${roomCode}`);
            // Request catch-up state
            setTimeout(() => {
                chrome.runtime.sendMessage({ type: 'CINELOG_REQUEST_STATE' });
            }, 1500);
        } else {
            showBadge(`🎬 Joined ${roomCode}! Watch a title to start sync.`, 5000);
        }
    }

    function deactivate() {
        activated = false;
        roomCode = null;
        if (watcher) { clearInterval(watcher); watcher = null; }
        document.getElementById('cinelog-chat-overlay')?.remove();
        showBadge('CineLog: Room Left');
    }

    // ── Communication ────────────────────────────────────────────────────────

    chrome.runtime.onMessage.addListener((message) => {
        switch (message.type) {
            case 'CINELOG_ROOM_JOINED':
                activate(message.roomCode, null);
                // Refresh full status to get user data
                init();
                break;
            case 'CINELOG_ROOM_LEFT':
                deactivate();
                break;
            case 'CINELOG_SYNC':
                applySync(message.payload.action, message.payload.currentTime);
                break;
            case 'CINELOG_STATE_REQUEST':
                if (video) {
                    chrome.runtime.sendMessage({
                        type: 'CINELOG_EMIT_STATE_RESPONSE',
                        state: { currentTime: video.currentTime, paused: video.paused }
                    });
                }
                break;
            case 'CINELOG_STATE_RESPONSE':
                applySync(message.state.paused ? 'pause' : 'play', message.state.currentTime);
                const t = formatTime(message.state.currentTime);
                showBadge(`⏱ Synced to ${t}`);
                appendChatMessage({ message: `Room synced to ${t}`, isSystem: true });
                break;
            case 'CINELOG_CHAT':
                appendChatMessage(message.payload);
                break;
            case 'CINELOG_MEMBER_JOIN':
                showBadge(`${message.payload.user?.username || 'Friend'} joined`);
                break;
            case 'CINELOG_MEMBER_LEFT':
                showBadge(`${message.payload.user?.username || 'Friend'} left`);
                break;
            case 'CINELOG_DISSOLVED':
                showBadge('Host ended session', 5000);
                deactivate();
                break;
        }
    });

    // ── UI ───────────────────────────────────────────────────────────────────

    function injectOverlay() {
        if (document.getElementById('cinelog-chat-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'cinelog-chat-overlay';
        overlay.innerHTML = `
            <div id="cl-chat-header">
                <span>🎬 CineLog</span>
                <div style="display:flex;gap:6px;align-items:center">
                    <span id="cl-room-code-badge">${roomCode}</span>
                    <button id="cl-chat-toggle">—</button>
                </div>
            </div>
            <div id="cl-chat-messages"></div>
            <div id="cl-chat-input-row">
                <input id="cl-chat-input" placeholder="Chat with room…" maxlength="200" />
                <button id="cl-chat-send">➤</button>
            </div>
        `;
        document.body.appendChild(overlay);
        injectStyles();
        document.getElementById('cl-chat-toggle').onclick = () => {
            overlayVisible = !overlayVisible;
            document.getElementById('cl-chat-messages').style.display = overlayVisible ? 'flex' : 'none';
            document.getElementById('cl-chat-input-row').style.display = overlayVisible ? 'flex' : 'none';
            document.getElementById('cl-chat-toggle').textContent = overlayVisible ? '—' : '+';
        };
        document.getElementById('cl-chat-send').onclick = sendChat;
        document.getElementById('cl-chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
    }

    function sendChat() {
        const input = document.getElementById('cl-chat-input');
        if (!input?.value.trim()) return;
        const text = input.value.trim();
        input.value = '';
        chrome.runtime.sendMessage({ 
            type: 'CINELOG_EMIT_CHAT', 
            payload: { message: text } 
        });
    }

    function appendChatMessage({ username, message, userId, isSystem }) {
        const container = document.getElementById('cl-chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        if (isSystem) {
            div.className = 'cl-msg-system';
            div.innerHTML = `<span class="cl-msg-text-system">${esc(message)}</span>`;
        } else {
            const isOwn = userId && currentUser && (userId === (currentUser._id || currentUser.id));
            div.className = `cl-msg${isOwn ? ' cl-msg-own' : ''}`;
            div.innerHTML = `<span class="cl-msg-user">${esc(username)}</span><span class="cl-msg-text">${esc(message)}</span>`;
        }
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
        clearTimeout(badge._t);
        badge._t = setTimeout(() => { badge.style.opacity = '0'; }, duration);
    }

    function injectStyles() {
        if (document.getElementById('cl-styles')) return;
        const s = document.createElement('style');
        s.id = 'cl-styles';
        s.textContent = `
            #cl-badge { position: fixed; top: 72px; left: 50%; transform: translateX(-50%); background: rgba(8,8,16,0.92); border: 1px solid rgba(129,140,248,0.25); color: #fff; padding: 9px 22px; border-radius: 100px; font-size: 13px; font-weight: 500; z-index: 2147483647; opacity: 0; transition: opacity .3s; pointer-events: none; }
            #cinelog-chat-overlay { position: fixed; bottom: 90px; right: 24px; width: 300px; background: rgba(8,8,16,0.94); border: 1px solid rgba(129,140,248,0.22); border-radius: 18px; z-index: 2147483647; color: #fff; box-shadow: 0 12px 48px rgba(0,0,0,0.6); font-family: system-ui,sans-serif; overflow: hidden; }
            #cl-chat-header { display:flex; align-items:center; justify-content:space-between; padding: 11px 14px; background: rgba(129,140,248,0.1); border-bottom: 1px solid rgba(129,140,248,0.1); font-weight:600; font-size:14px; }
            #cl-room-code-badge { font-size:10px; font-weight:800; letter-spacing:.15em; background: rgba(129,140,248,0.15); color:#818cf8; padding: 2px 7px; border-radius:6px; }
            #cl-chat-toggle { background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; font-size:18px; line-height:1; }
            #cl-chat-messages { height:210px; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:6px; }
            .cl-msg        { display:flex; flex-direction:column; gap:1px; }
            .cl-msg-own    { align-items:flex-end; }
            .cl-msg-system { align-items:center; margin:2px 0; }
            .cl-msg-user   { font-size:11px; color:rgba(255,255,255,0.4); font-weight:600; }
            .cl-msg-text   { background:rgba(255,255,255,0.07); border-radius:10px; padding:6px 11px; font-size:13px; max-width:88%; word-break:break-word; }
            .cl-msg-own .cl-msg-text { background:rgba(129,140,248,0.2); }
            .cl-msg-text-system { font-size:11px; color:rgba(255,255,255,0.3); font-style:italic; }
            #cl-chat-input-row { display:flex; border-top:1px solid rgba(255,255,255,0.06); }
            #cl-chat-input { flex:1; background:transparent; border:none; padding:11px 12px; color:#fff; outline:none; font-size:13px; }
            #cl-chat-send  { width:42px; background:none; border:none; border-left:1px solid rgba(255,255,255,0.06); color:#818cf8; cursor:pointer; font-size:14px; }
        `;
        document.head.appendChild(s);
    }

    // ── Utils ────────────────────────────────────────────────────────────────

    function formatTime(s) {
        return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
    }

    function esc(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    async function init() {
        const urlRoom = new URLSearchParams(window.location.search).get('clroom');
        chrome.runtime.sendMessage({ type: 'CINELOG_GET_STATUS' }, (status) => {
            if (chrome.runtime.lastError || !status) return;
            const code = urlRoom || status.roomCode;
            if (code) activate(code, status.user);
        });
    }

    init();
})();
