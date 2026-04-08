/**
 * CineLog Extension — Netflix Sync v4.0
 * Direct-Connection Architecture (Stable)
 */

(function () {
    'use strict';

    const BACKEND_URL      = 'https://cuerates.onrender.com';
    const SYNC_DEBOUNCE_MS = 800;
    const SEEK_TOLERANCE_S = 3.0;
    const ECHO_WINDOW_MS   = 2500;

    let socket      = null;
    let video       = null;
    let roomCode    = null;
    let currentUser = null;
    let activated   = false;
    let isSyncing   = false;
    let syncTimer   = null;
    let watcher     = null;
    let overlayVisible = true;
    let lastRemoteAction = 0;
    let lastAppliedPos   = -1;
    let lastAppliedAction = null;
    let handshakeShield  = true; // Start with shield active
    let pendingSync      = null; // { action, currentTime }

    console.log('%c🎬 [CineLog] Sync Engine v4.0 Active', 'color: #818cf8; font-size: 14px; font-weight: bold;');

    // ── Echo Prevention ──────────────────────────────────────────────────────

    function markRemoteAction() { lastRemoteAction = Date.now(); }
    function isEcho() { return Date.now() - lastRemoteAction < ECHO_WINDOW_MS; }

    // ── Sync Logic ───────────────────────────────────────────────────────────

    function onPlay()   { if (!isSyncing && !isEcho()) emitSync('play',  video.currentTime); }
    function onPause()  { if (!isSyncing && !isEcho()) emitSync('pause', video.currentTime); }
    function onSeeked() { if (!isSyncing && !isEcho()) emitSync('seek',  video.currentTime); }

    function emitSync(action, currentTime) {
        if (!socket?.connected || !roomCode || handshakeShield) return;
        
        // SYNC SHIELD: Don't echo back what we just received from the server
        const isEchoOfRemote = (action === lastAppliedAction && Math.abs(currentTime - lastAppliedPos) < 1.0);
        if (isEchoOfRemote) {
            return;
        }

        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            console.log(`[CineLog] Outgoing Sync: ${action} at ${formatTime(currentTime)}`);
            socket.emit('room:sync', { roomCode, action, currentTime });
        }, SYNC_DEBOUNCE_MS);
    }

    function applySync(action, targetTime) {
        if (!video) return;
        
        // Track what we applied to ignore it in emitSync
        lastAppliedPos = targetTime;
        lastAppliedAction = action;
        
        isSyncing = true;
        markRemoteAction();

        console.log(`[CineLog] Applying Remote Sync: ${action} at ${formatTime(targetTime)}`);

        if (Math.abs(video.currentTime - targetTime) > SEEK_TOLERANCE_S) {
            video.currentTime = targetTime;
        }

        if (action === 'play') {
            video.play().catch(() => {
                showBadge('⚠️ Play blocked — click anywhere to allow audio', 5000);
            });
        } 
        else if (action === 'pause') {
            video.pause();
        }
        else if (action === 'seek') {
            video.currentTime = targetTime;
        }

        // Keep shield active for a bit longer to catch late events
        setTimeout(() => { 
            isSyncing = false; 
            // We clear the applied refs after a delay to allow manual seeks again
            setTimeout(() => {
                if (Date.now() - lastRemoteAction > 2000) {
                    lastAppliedPos = -1;
                    lastAppliedAction = null;
                }
            }, 1000);
        }, 1500);
    }

    // ── Socket Management ────────────────────────────────────────────────────

    async function connectSocket(token) {
        if (socket?.connected) return;
        if (socket) socket.disconnect();

        // 'io' is available globally via socket.io.min.js injected via manifest
        socket = io(BACKEND_URL, {
            transports: ['websocket'],
            auth: { token }
        });

        socket.on('connect', () => {
            console.log('[CineLog] Socket Connected:', socket.id);
            updateStatusUI('connected');
            if (roomCode) {
                socket.emit('room:join_socket', roomCode);
                setTimeout(() => socket.emit('room:request_state', { roomCode }), 1000);
            }
        });

        socket.on('connect_error', (err) => {
            console.error('[CineLog] Socket Connection Error:', err.message);
            updateStatusUI('error', err.message);
        });

        socket.on('room:synced', ({ action, currentTime }) => {
            handleIncomingSync(action, currentTime);
        });

        socket.on('room:state_request', () => {
            if (!video) return;
            socket.emit('room:state_response', {
                roomCode,
                state: { currentTime: video.currentTime, paused: video.paused }
            });
        });

        socket.on('room:state_response', ({ state }) => {
            if (!state) return;
            // Delay initial state to allow player load
            setTimeout(() => {
                handleIncomingSync(state.paused ? 'pause' : 'play', state.currentTime, true);
            }, 3000);
        });

        function handleIncomingSync(action, currentTime, isInitial = false) {
            if (!video) return;
            
            const delta = Math.abs(video.currentTime - currentTime);
            const needsSync = delta > SEEK_TOLERANCE_S || isInitial;

            if (needsSync) {
                pendingSync = { action, currentTime };
                showSyncPrompt(action, currentTime);
            } else {
                // Real-time synchronization for Play/Pause if already at the correct time
                if (action === 'play' && video.paused) {
                    applySync('play', video.currentTime);
                } else if (action === 'pause' && !video.paused) {
                    applySync('pause', video.currentTime);
                }
            }
        }

        socket.on('room:message', (data) => {
            appendChatMessage(data);
        });

        socket.on('room:member_join', ({ user }) => {
            const name = user?.username || 'A friend';
            showBadge(`${name} joined`);
            appendChatMessage({ message: `${name} joined the room`, isSystem: true });
        });

        socket.on('room:member_left', ({ user }) => {
            showBadge(`${user?.username || 'Friend'} left`);
        });

        socket.on('room:dissolved', () => {
            showBadge('Host ended session', 5000);
            deactivate();
        });

        socket.on('disconnect', () => {
            console.log('[CineLog] Socket Disconnected');
            updateStatusUI('disconnected');
        });
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

    async function activate(code, user, token) {
        if (activated && roomCode === code) return;
        activated   = true;
        roomCode    = code;
        currentUser = user;

        startWatcher();
        connectSocket(token);

        // ACTIVATE HANDSHAKE SHIELD (Wait 3s before allowing outgoing syncs)
        handshakeShield = true;
        setTimeout(() => { handshakeShield = false; console.log('[CineLog] Handshake shield released'); }, 3000);

        const isWatchPage = window.location.pathname.includes('/watch/');
        if (isWatchPage) {
            injectOverlay();
            showBadge(`🎬 Connected to ${roomCode}`);

            // STATE PERSISTENCE: Check if we reloaded into a paused state
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('clpaused') === '1') {
                const pauseInterval = setInterval(() => {
                    if (video) {
                        video.pause();
                        clearInterval(pauseInterval);
                        console.log('[CineLog] State Persistence: Applied initial pause');
                    }
                }, 200);
                setTimeout(() => clearInterval(pauseInterval), 10000);
            }
        } else {
            showBadge(`🎬 Joined ${roomCode}! Watch a title to sync.`, 5000);
        }
    }

    function deactivate() {
        activated = false;
        roomCode = null;
        if (watcher) { clearInterval(watcher); watcher = null; }
        if (socket) { socket.disconnect(); socket = null; }
        document.getElementById('cinelog-chat-overlay')?.remove();
        showBadge('CineLog: Room Left');
    }

    // ── Communication & Init ─────────────────────────────────────────────────

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

    async function init() {
        const urlRoom = new URLSearchParams(window.location.search).get('clroom');
        
        chrome.runtime.sendMessage({ type: 'CINELOG_GET_STATUS' }, async (status) => {
            if (chrome.runtime.lastError || !status) return;

            const { cinelogToken, cinelogUser } = await chrome.storage.local.get(['cinelogToken', 'cinelogUser']);
            if (!cinelogToken) return;

            const code = urlRoom || status.roomCode;
            if (urlRoom && urlRoom !== status.roomCode) {
                await autoJoinRoom(urlRoom);
                activate(urlRoom, cinelogUser, cinelogToken);
            } else if (code) {
                activate(code, cinelogUser, cinelogToken);
            }
        });
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'CINELOG_ROOM_JOINED') {
            init();
        } else if (message.type === 'CINELOG_ROOM_LEFT') {
            deactivate();
        }
    });

    // ── UI Overlay ───────────────────────────────────────────────────────────

    function injectOverlay() {
        if (document.getElementById('cinelog-chat-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'cinelog-chat-overlay';
        overlay.innerHTML = `
            <div id="cl-chat-header">
                <div style="display:flex;flex-direction:column">
                    <span style="font-size:14px;font-weight:700">🎬 CineLog</span>
                    <div id="cl-status-row">
                        <span id="cl-status-dot"></span>
                        <span id="cl-status-text">Connecting...</span>
                    </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
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
            // DETACH MODE: For browsers like Opera, we actually remove the box to clear DRM flags
            overlayVisible = !overlayVisible;
            const messages = document.getElementById('cl-chat-messages');
            const inputRow = document.getElementById('cl-chat-input-row');
            const overlay = document.getElementById('cinelog-chat-overlay');

            if (!overlayVisible) {
                // Shrink and hide content
                messages.style.display = 'none';
                inputRow.style.display = 'none';
                overlay.style.width = '40px';
                overlay.style.height = '40px';
                overlay.style.borderRadius = '50%';
                overlay.style.background = 'rgba(129,140,248,0.5)';
                document.getElementById('cl-chat-toggle').textContent = '+';
                document.getElementById('cl-chat-header').style.display = 'none';
            } else {
                // Restore
                messages.style.display = 'flex';
                inputRow.style.display = 'flex';
                overlay.style.width = '300px';
                overlay.style.height = 'auto';
                overlay.style.borderRadius = '18px';
                overlay.style.background = 'rgba(8,8,16,0.94)';
                document.getElementById('cl-chat-toggle').textContent = '—';
                document.getElementById('cl-chat-header').style.display = 'flex';
            }
        };
        document.getElementById('cl-chat-send').onclick = sendChat;
        document.getElementById('cl-chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
        
        // Initial UI state
        if (socket?.connected) updateStatusUI('connected');
    }

    function updateStatusUI(status, errorMsg) {
        const dot = document.getElementById('cl-status-dot');
        const text = document.getElementById('cl-status-text');
        if (!dot || !text) return;

        if (status === 'connected') {
            dot.style.background = '#10b981';
            text.textContent = currentUser?.username ? `Connected as ${currentUser.username}` : 'Connected';
        } else if (status === 'error') {
            dot.style.background = '#ef4444';
            text.textContent = errorMsg || 'Auth Error';
        } else {
            dot.style.background = '#f59e0b';
            text.textContent = 'Disconnected';
        }
    }

    function sendChat() {
        const input = document.getElementById('cl-chat-input');
        if (!input?.value.trim() || !socket?.connected) return;
        const text = input.value.trim();
        input.value = '';
        socket.emit('room:chat', { roomCode, message: text });
    }

    function appendChatMessage({ username, message, userId, isSystem }) {
        const container = document.getElementById('cl-chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        if (isSystem) {
            div.className = 'cl-msg-system';
            div.innerHTML = `<span class="cl-msg-text-system">${esc(message)}</span>`;
        } else {
            const isOwn = userId && currentUser && (userId.toString() === (currentUser._id || currentUser.id || '').toString());
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
        badge._t = setTimeout(() => { if (badge) badge.style.opacity = '0'; }, duration);
    }

    function showSyncPrompt(action, time) {
        let prompt = document.getElementById('cl-sync-prompt');
        if (!prompt) {
            prompt = document.createElement('div');
            prompt.id = 'cl-sync-prompt';
            document.body.appendChild(prompt);
        }
        
        prompt.innerHTML = `
            <div class="cl-sync-content">
                <span class="cl-sync-icon">🎬</span>
                <span class="cl-sync-text">Out of sync with host (${formatTime(time)})</span>
                <button id="cl-sync-now-btn">Click to Sync</button>
            </div>
        `;
        prompt.classList.add('visible');

        document.getElementById('cl-sync-now-btn').onclick = () => {
            if (pendingSync) {
                // NATIVE SYNC: We reload the page with the timestamp in the URL.
                // This bypasses DRM manipulation detection because Netflix handles the seek natively on load.
                const url = new URL(window.location.href);
                url.searchParams.set('t', Math.floor(pendingSync.currentTime));
                url.searchParams.set('clroom', roomCode);
                
                // If the host is paused, tell the reloaded page to pause too
                if (pendingSync.action === 'pause') {
                    url.searchParams.set('clpaused', '1');
                } else {
                    url.searchParams.delete('clpaused');
                }
                
                hideSyncPrompt();
                showBadge('🚀 Snapping to Host... (Native Sync)');
                
                setTimeout(() => {
                    window.location.href = url.toString();
                }, 500);
            }
        };
    }

    function hideSyncPrompt() {
        const prompt = document.getElementById('cl-sync-prompt');
        if (prompt) prompt.classList.remove('visible');
    }

    function injectStyles() {
        if (document.getElementById('cl-styles')) return;
        const s = document.createElement('style');
        s.id = 'cl-styles';
        s.textContent = `
            #cl-badge { position: fixed; top: 72px; left: 50%; transform: translateX(-50%); background: rgba(8,8,16,0.92); border: 1px solid rgba(129,140,248,0.25); color: #fff; padding: 9px 22px; border-radius: 100px; font-size: 13px; font-weight: 500; z-index: 2147483647; opacity: 0; transition: opacity .3s; pointer-events: none; }
            #cinelog-chat-overlay { position: fixed; bottom: 90px; right: 24px; width: 300px; background: rgba(8,8,16,0.94); border: 1px solid rgba(129,140,248,0.22); border-radius: 18px; z-index: 2147483647; color: #fff; box-shadow: 0 12px 48px rgba(0,0,0,0.6); font-family: system-ui,sans-serif; overflow: hidden; }
            #cl-chat-header { display:flex; align-items:center; justify-content:space-between; padding: 11px 14px; background: rgba(129,140,248,0.1); border-bottom: 1px solid rgba(129,140,248,0.1); }
            #cl-status-row { display:flex; align-items:center; gap:5px; margin-top:2px; }
            #cl-status-dot { width:6px; height:6px; border-radius:50%; background:#f59e0b; }
            #cl-status-text { font-size:10px; color:rgba(255,255,255,0.5); font-weight:500; }
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

            /* Sync Prompt Banner */
            #cl-sync-prompt { position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: center; padding: 20px; z-index: 2147483647; transform: translateY(-100%); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: none; }
            #cl-sync-prompt.visible { transform: translateY(0); }
            .cl-sync-content { pointer-events: auto; display: flex; align-items: center; gap: 15px; background: rgba(8, 8, 16, 0.95); backdrop-filter: blur(10px); border: 1px solid rgba(129, 140, 248, 0.3); padding: 12px 24px; border-radius: 100px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
            .cl-sync-text { color: #fff; font-size: 14px; font-weight: 500; font-family: system-ui, sans-serif; }
            #cl-sync-now-btn { background: #818cf8; color: #000; border: none; padding: 6px 16px; border-radius: 100px; font-size: 13px; font-weight: 700; cursor: pointer; transition: transform 0.2s; }
            #cl-sync-now-btn:hover { transform: scale(1.05); }
            #cl-sync-now-btn:active { transform: scale(0.95); }
        `;
        document.head.appendChild(s);
    }

    function formatTime(s) {
        return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
    }

    function esc(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    init();
})();
