/**
 * CineLog Extension — Netflix Sync v2.0
 *
 * The content script owns its own Socket.io connection so it is never
 * subject to Chrome's service-worker suspension. The service worker is
 * only used for auth-token / room-code storage and popup communication.
 *
 * Architecture:
 *   [ Netflix page (this script) ] <──socket──> [ CineLog Server ]
 *                      ↕ chrome.runtime.sendMessage (auth/room only)
 *   [ Service Worker (popup bridge) ]
 */

(function () {
    'use strict';

    // ── Config ─────────────────────────────────────────────────────────────
    const BACKEND_URL    = 'http://127.0.0.1:5000';
    const SEEK_TOLERANCE = 2;     // seconds before forcing a seek on remote sync
    const ECHO_WINDOW_MS = 1200;  // ms to suppress self-triggered events after remote sync

    // ── State ───────────────────────────────────────────────────────────────
    let socket      = null;
    let roomCode    = null;
    let currentUser = null;
    let video       = null;
    let videoTimer  = null;
    let activated   = false;
    let lastRemoteAction = 0;  // timestamp of last remote-applied action

    // ── Inline Socket.io v4 client (no import, no CDN) ─────────────────────
    // Implements just enough of the Engine.io + Socket.io v4 wire protocol
    // to emit events and receive them over a native WebSocket.

    function createSocket(serverUrl) {
        const base = serverUrl.replace(/\/$/, '');
        const ws   = new WebSocket(
            base.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://') +
            '/socket.io/?EIO=4&transport=websocket'
        );

        const handlers = {};
        let pingTimer  = null;
        let connected  = false;
        let reconnectTimer = null;
        let reconnectDelay = 1500;

        function fire(event, ...args) {
            (handlers[event] || []).forEach(fn => {
                try { fn(...args); } catch(e) { console.error('[CineLog Socket]', e); }
            });
        }

        function send(packet) {
            if (ws.readyState === WebSocket.OPEN) ws.send(packet);
        }

        ws.onopen = () => {
            // Send Socket.io namespace-connect packet
            send('40');
        };

        ws.onmessage = ({ data }) => {
            if (data === '2') { send('3'); return; }           // server PING → PONG

            if (data.startsWith('0')) {                        // Engine.io OPEN
                try {
                    const cfg = JSON.parse(data.slice(1));
                    pingTimer = setInterval(() => send('3'), (cfg.pingInterval || 25000) - 2000);
                } catch(_) {}
                return;
            }

            if (data.startsWith('40')) {                       // SIO namespace CONNECTED
                connected = true;
                reconnectDelay = 1500;
                fire('connect');
                return;
            }

            if (data.startsWith('42')) {                       // SIO EVENT
                try {
                    const [event, ...args] = JSON.parse(data.slice(2));
                    fire(event, ...args);
                } catch(e) { console.error('[CineLog Socket] Parse error:', e); }
            }
        };

        ws.onclose = () => {
            connected = false;
            clearInterval(pingTimer);
            fire('disconnect');
            // Auto-reconnect with back-off (keep trying while room is active)
            if (roomCode) {
                reconnectTimer = setTimeout(() => {
                    reconnectDelay = Math.min(reconnectDelay * 1.5, 15000);
                    connectAndActivate();
                }, reconnectDelay);
            }
        };

        ws.onerror = () => {};  // onclose fires next, handles reconnect

        return {
            get connected() { return connected; },
            on(event, fn) { (handlers[event] = handlers[event] || []).push(fn); return this; },
            off(event, fn) {
                if (!fn) { handlers[event] = []; return; }
                handlers[event] = (handlers[event] || []).filter(h => h !== fn);
            },
            emit(event, data) { send('42' + JSON.stringify([event, data])); },
            close() {
                clearInterval(pingTimer);
                clearTimeout(reconnectTimer);
                ws.close();
            }
        };
    }

    // ── Echo prevention ─────────────────────────────────────────────────────
    // A remote-triggered action marks a timestamp; any local events fired
    // within ECHO_WINDOW_MS of that timestamp are ignored.

    function markRemoteAction() { lastRemoteAction = Date.now(); }
    function isEcho() { return Date.now() - lastRemoteAction < ECHO_WINDOW_MS; }

    // ── Video sync ──────────────────────────────────────────────────────────

    function onPlay()   { if (!isEcho()) emitSync('play',  video.currentTime); }
    function onPause()  { if (!isEcho()) emitSync('pause', video.currentTime); }
    function onSeeked() { if (!isEcho()) emitSync('seek',  video.currentTime); }

    function emitSync(action, time) {
        if (!socket || !socket.connected || !roomCode) return;
        socket.emit('room:sync', { roomCode, action, currentTime: time });
    }

    function applySync(action, targetTime) {
        if (!video) return;
        markRemoteAction();

        if (Math.abs(video.currentTime - targetTime) > SEEK_TOLERANCE) {
            video.currentTime = targetTime;
        }

        if (action === 'play')  video.play().catch(() => {});
        if (action === 'pause') video.pause();
        if (action === 'seek')  video.currentTime = targetTime;
    }

    function attachVideoListeners() {
        video.removeEventListener('play',   onPlay);
        video.removeEventListener('pause',  onPause);
        video.removeEventListener('seeked', onSeeked);
        video.addEventListener('play',   onPlay);
        video.addEventListener('pause',  onPause);
        video.addEventListener('seeked', onSeeked);
        log('Video listeners attached');
    }

    function startVideoWatcher() {
        if (videoTimer) return;
        // Check immediately, then every 800ms
        function check() {
            const v = document.querySelector('video');
            if (v && v !== video) {
                video = v;
                attachVideoListeners();
            }
        }
        check();
        videoTimer = setInterval(check, 800);
    }

    // ── Socket setup ────────────────────────────────────────────────────────

    function connectAndActivate() {
        if (socket) { socket.close(); socket = null; }

        socket = createSocket(BACKEND_URL);

        socket.on('connect', () => {
            log('Socket connected — joining room', roomCode);
            socket.emit('room:join_socket', roomCode);
            // Request current state from the host so we jump to the right position
            setTimeout(() => socket.emit('room:request_state', { roomCode }), 800);
        });

        socket.on('room:synced', ({ action, currentTime }) => {
            applySync(action, currentTime);
            log(`Sync received: ${action} @ ${currentTime.toFixed(1)}s`);
        });

        // Host responds with its current playback state for late-joiners
        socket.on('room:state_response', ({ state }) => {
            if (!state) return;
            const { currentTime, paused } = state;
            markRemoteAction();
            if (video) {
                video.currentTime = currentTime;
                if (paused) video.pause(); else video.play().catch(() => {});
                const t = `${Math.floor(currentTime/60)}:${String(Math.floor(currentTime%60)).padStart(2,'0')}`;
                showBadge(`⏱ Synced to ${t}`);
                appendChatMessage({ message: `Room synced to ${t}`, isSystem: true });
            }
        });

        // The host's video state is needed when someone requests it
        socket.on('room:state_request', () => {
            if (!video) return;
            socket.emit('room:state_response', {
                roomCode,
                state: { currentTime: video.currentTime, paused: video.paused }
            });
        });

        socket.on('room:message', (data) => {
            appendChatMessage(data);
        });

        socket.on('room:member_join', ({ user }) => {
            showBadge(`${user?.username || 'Someone'} joined`);
            appendChatMessage({ message: `${user?.username || 'Someone'} joined the room`, isSystem: true });
        });

        socket.on('room:member_left', ({ user }) => {
            showBadge(`${user?.username || 'Someone'} left`);
        });

        socket.on('room:dissolved', () => {
            showBadge('Host ended the room session', 5000);
            deactivate();
        });

        socket.on('disconnect', () => {
            log('Socket disconnected');
        });
    }

    // ── Activation lifecycle ─────────────────────────────────────────────────

    function activate(code, user) {
        if (activated && roomCode === code) return;
        activated  = true;
        roomCode   = code;
        currentUser = user;

        startVideoWatcher();
        connectAndActivate();

        const isWatchPage = window.location.pathname.startsWith('/watch/');
        if (isWatchPage) {
            injectChatOverlay();
            showBadge(`🎬 CineLog · Room ${roomCode}`);
        } else {
            showBadge(`🎬 CineLog · Joined ${roomCode} — navigate to a title to start watching`, 6000);
        }
    }

    function deactivate() {
        activated  = false;
        roomCode   = null;
        clearInterval(videoTimer);
        videoTimer = null;
        if (socket) { socket.close(); socket = null; }
        document.getElementById('cinelog-chat-overlay')?.remove();
    }

    // ── Init ─────────────────────────────────────────────────────────────────

    async function autoJoinAndActivate(code) {
        const { cinelogToken } = await chrome.storage.local.get('cinelogToken');
        if (!cinelogToken) { showBadge('CineLog: sign in to the extension first', 5000); return; }

        try {
            const res = await fetch(`${BACKEND_URL}/api/rooms/${code}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cinelogToken}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            // Tell service worker to update its roomCode + notify popup
            chrome.runtime.sendMessage({ type: 'CINELOG_JOIN_ROOM', roomCode: code });
        } catch (e) {
            log('Auto-join error:', e.message);
        }

        const { cinelogUser } = await chrome.storage.local.get('cinelogUser');
        activate(code, cinelogUser || null);
    }

    function init() {
        const urlRoom = new URLSearchParams(window.location.search).get('clroom');

        chrome.runtime.sendMessage({ type: 'CINELOG_GET_STATUS' }, (status) => {
            if (chrome.runtime.lastError) return;  // no service worker yet

            const storedRoom = status?.roomCode || null;

            if (urlRoom && urlRoom !== storedRoom) {
                // New room from URL — auto-join
                autoJoinAndActivate(urlRoom);
                return;
            }

            const code = urlRoom || storedRoom;
            if (!code) return;  // no room active

            chrome.storage.local.get(['cinelogToken', 'cinelogUser'], ({ cinelogToken, cinelogUser }) => {
                if (cinelogToken) activate(code, cinelogUser || null);
            });
        });
    }

    // ── Service worker messages (room join/leave from popup) ─────────────────

    chrome.runtime.onMessage.addListener((message) => {
        switch (message.type) {
            case 'CINELOG_ROOM_JOINED':
                chrome.storage.local.get('cinelogUser', ({ cinelogUser }) => {
                    activate(message.roomCode, cinelogUser || null);
                });
                break;
            case 'CINELOG_ROOM_LEFT':
                deactivate();
                break;
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
                <div style="display:flex;gap:6px;align-items:center">
                    <span id="cl-room-code-badge">${roomCode}</span>
                    <button id="cl-chat-toggle">—</button>
                </div>
            </div>
            <div id="cl-chat-messages"></div>
            <div id="cl-chat-input-row">
                <input id="cl-chat-input" placeholder="Chat with the room…" maxlength="200" />
                <button id="cl-chat-send">➤</button>
            </div>
        `;
        document.body.appendChild(overlay);
        injectStyles();

        let chatVisible = true;
        document.getElementById('cl-chat-toggle').onclick = () => {
            chatVisible = !chatVisible;
            const msgs = document.getElementById('cl-chat-messages');
            const row  = document.getElementById('cl-chat-input-row');
            if (msgs) msgs.style.display = chatVisible ? 'flex' : 'none';
            if (row)  row.style.display  = chatVisible ? 'flex' : 'none';
            document.getElementById('cl-chat-toggle').textContent = chatVisible ? '—' : '+';
        };
        document.getElementById('cl-chat-send').onclick   = sendChat;
        document.getElementById('cl-chat-input').onkeydown = e => { if (e.key === 'Enter') sendChat(); };
    }

    function sendChat() {
        const input = document.getElementById('cl-chat-input');
        if (!input?.value.trim() || !socket?.connected) return;
        const text = input.value.trim();
        input.value = '';
        socket.emit('room:chat', {
            roomCode,
            message: text,
            userId:   currentUser?._id  || currentUser?.id,
            username: currentUser?.username || 'You',
            avatar:   currentUser?.profilePicture
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
            const isOwn = userId && currentUser &&
                userId.toString() === ((currentUser._id || currentUser.id) || '').toString();
            div.className = `cl-msg${isOwn ? ' cl-msg-own' : ''}`;
            div.innerHTML = `<span class="cl-msg-user">${esc(username)}</span>`
                          + `<span class="cl-msg-text">${esc(message)}</span>`;
        }
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        if (container.children.length > 60) container.children[0].remove();
    }

    function showBadge(text, duration = 3000) {
        let badge = document.getElementById('cl-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'cl-badge';
            document.body.appendChild(badge);
            injectBadgeStyle();
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
            #cinelog-chat-overlay {
                position: fixed; bottom: 90px; right: 24px; width: 300px;
                background: rgba(8,8,16,0.94); border: 1px solid rgba(129,140,248,0.22);
                border-radius: 18px; z-index: 2147483647; color: #fff;
                box-shadow: 0 12px 48px rgba(0,0,0,0.6); font-family: system-ui,sans-serif;
                overflow: hidden;
            }
            #cl-chat-header {
                display:flex; align-items:center; justify-content:space-between;
                padding: 11px 14px; background: rgba(129,140,248,0.1);
                border-bottom: 1px solid rgba(129,140,248,0.1); font-weight:600; font-size:14px;
            }
            #cl-room-code-badge {
                font-size:10px; font-weight:800; letter-spacing:.15em;
                background: rgba(129,140,248,0.15); color:#818cf8;
                padding: 2px 7px; border-radius:6px;
            }
            #cl-chat-toggle {
                background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; font-size:18px; line-height:1;
            }
            #cl-chat-messages {
                height:210px; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:6px;
            }
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
            #cl-chat-send:hover { background:rgba(129,140,248,0.1); }
        `;
        document.head.appendChild(s);
    }

    function injectBadgeStyle() {
        if (document.getElementById('cl-badge-style')) return;
        const s = document.createElement('style');
        s.id = 'cl-badge-style';
        s.textContent = `
            #cl-badge {
                position:fixed; top:72px; left:50%; transform:translateX(-50%);
                background:rgba(8,8,16,0.92); border:1px solid rgba(129,140,248,0.25);
                color:#fff; padding:9px 22px; border-radius:100px; font-size:13px;
                font-family:system-ui,sans-serif; font-weight:500; z-index:2147483647;
                opacity:0; transition:opacity .3s; pointer-events:none; white-space:nowrap;
            }
        `;
        document.head.appendChild(s);
    }

    function esc(str) {
        return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function log(...args) { console.log('[CineLog]', ...args); }

    // ── Start ───────────────────────────────────────────────────────────────
    init();

})();
