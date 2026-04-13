/**
 * CineLog Extension — Netflix Sync v5.0 (Teleparty-style)
 * Full rewrite: Netflix internal API, latency compensation, drift correction,
 * buffering sync, host-only control, collapsible overlay, emoji reactions.
 */

(function () {
    'use strict';

    const BACKEND_URL      = 'https://cuerates.onrender.com';
    const SYNC_DEBOUNCE_MS = 150;
    const SEEK_TOLERANCE_S = 1.0;
    const DRIFT_CHECK_MS   = 10000;
    const DRIFT_HARD_S     = 3.0;
    const DRIFT_SOFT_S     = 1.0;

    let socket        = null;
    let video         = null;
    let roomCode      = null;
    let currentUser   = null;
    let activated     = false;
    let syncTimer     = null;
    let watcher       = null;
    let isHost        = false;
    let panelExpanded = true;
    let latencyMs     = 0;      // half RTT in milliseconds
    let lastSeqApplied = -1;    // sequence-based echo prevention
    let driftTimer    = null;
    let heartbeatTimer = null;
    let lastHeartbeat = null;   // { currentTime, paused, receivedAt }
    let members       = [];
    let isBuffering   = false;
    let suppressUntil = 0;      // timestamp — suppress outgoing emits until this time

    console.log('%c🎬 [Cuerates] Sync Engine v5.0 Active', 'color: #818cf8; font-size: 14px; font-weight: bold;');

    // ── Netflix Internal Player API ──────────────────────────────────────────
    // Avoids page reloads for seeks — direct playback control without DRM friction.

    function getNetflixPlayer() {
        try {
            const vp = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
            const sid = vp.getAllPlayerSessionIds()[0];
            return sid ? vp.getVideoPlayerBySessionId(sid) : null;
        } catch (e) {
            return null;
        }
    }

    function playerSeek(timeSeconds) {
        const p = getNetflixPlayer();
        if (p) {
            p.seek(Math.floor(timeSeconds * 1000)); // Netflix API expects milliseconds
        } else if (video) {
            video.currentTime = timeSeconds;
        }
    }

    function playerPlay() {
        const p = getNetflixPlayer();
        if (p) {
            p.play();
        } else if (video) {
            video.play().catch(() => showBadge('⚠️ Click the page to allow playback'));
        }
    }

    function playerPause() {
        const p = getNetflixPlayer();
        if (p) {
            p.pause();
        } else if (video) {
            video.pause();
        }
    }

    function playerGetTime() {
        const p = getNetflixPlayer();
        if (p) {
            return p.getCurrentTime() / 1000; // ms → seconds
        }
        return video ? video.currentTime : 0;
    }

    function playerIsPaused() {
        return video ? video.paused : true;
    }

    // ── Echo Prevention ──────────────────────────────────────────────────────

    function suppressEmit(ms) { suppressUntil = Date.now() + (ms || 1500); }
    function isSuppressed()   { return Date.now() < suppressUntil; }

    // ── Video Event Handlers ─────────────────────────────────────────────────

    function onPlay()   { if (isHost && !isSuppressed()) emitSync('play',  playerGetTime()); }
    function onPause()  { if (isHost && !isSuppressed()) emitSync('pause', playerGetTime()); }
    function onSeeked() { if (isHost && !isSuppressed()) emitSync('seek',  playerGetTime()); }

    function onWaiting() {
        if (!socket?.connected || !roomCode || isBuffering) return;
        isBuffering = true;
        socket.emit('room:buffer_start', { roomCode });
        updateLocalMemberBuffering(true);
    }

    function onCanPlay() {
        if (!socket?.connected || !roomCode || !isBuffering) return;
        isBuffering = false;
        socket.emit('room:buffer_end', { roomCode });
        updateLocalMemberBuffering(false);
    }

    const videoHandlers = { play: onPlay, pause: onPause, seeked: onSeeked, waiting: onWaiting, canplay: onCanPlay };

    // ── Sync Emit ────────────────────────────────────────────────────────────

    function emitSync(action, currentTime) {
        if (!socket?.connected || !roomCode) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            socket.emit('room:sync', { roomCode, action, currentTime });
            showActionStatus(action, currentTime, 'You');
        }, SYNC_DEBOUNCE_MS);
    }

    // ── Apply Incoming Sync ──────────────────────────────────────────────────

    function applySync(action, targetTime, seq) {
        if (!video) return;

        // Sequence-based dedup: ignore replays (seq === -1 bypasses for initial state)
        if (seq !== undefined && seq !== -1 && seq <= lastSeqApplied) return;
        if (seq !== undefined && seq !== -1) lastSeqApplied = seq;

        suppressEmit(1500);

        // Compensate for socket latency: target is already in the past by latencyMs
        const compensated = targetTime + (latencyMs / 1000);
        const current = playerGetTime();

        if (action === 'seek' || Math.abs(current - compensated) > SEEK_TOLERANCE_S) {
            playerSeek(compensated);
        }

        if (action === 'play' || action === 'seek') {
            playerPlay();
        } else if (action === 'pause') {
            playerPause();
        }

    }

    // ── Drift Correction (guests only) ───────────────────────────────────────
    // Runs every 10s. Compares local position to last heartbeat from host.

    function startDriftCorrection() {
        if (driftTimer) return;
        driftTimer = setInterval(() => {
            if (!lastHeartbeat || isHost || !video || playerIsPaused()) return;

            const elapsedSec = (Date.now() - lastHeartbeat.receivedAt) / 1000;
            const expected = lastHeartbeat.currentTime + (lastHeartbeat.paused ? 0 : elapsedSec);
            const actual = playerGetTime();
            const drift = Math.abs(actual - expected);

            if (drift > DRIFT_HARD_S) {
                console.log(`[Cuerates] Hard drift correction: ${drift.toFixed(1)}s`);
                suppressEmit(1500);
                playerSeek(expected);
                if (!lastHeartbeat.paused && playerIsPaused()) playerPlay();
                if (lastHeartbeat.paused && !playerIsPaused()) playerPause();
            } else if (drift > DRIFT_SOFT_S) {
                // Soft: nudge playback rate for a few seconds to catch up silently
                const rate = actual < expected ? 1.08 : 0.93;
                if (video) {
                    video.playbackRate = rate;
                    setTimeout(() => { if (video) video.playbackRate = 1.0; }, 3000);
                }
            }
        }, DRIFT_CHECK_MS);
    }

    function stopDriftCorrection() {
        if (driftTimer) { clearInterval(driftTimer); driftTimer = null; }
    }

    // ── Host Heartbeat ───────────────────────────────────────────────────────
    // Host emits current position every 10s so guests can drift-correct.

    function startHeartbeat() {
        if (heartbeatTimer) return;
        heartbeatTimer = setInterval(() => {
            if (!socket?.connected || !roomCode || !isHost) return;
            socket.emit('room:heartbeat', {
                roomCode,
                currentTime: playerGetTime(),
                paused: playerIsPaused()
            });
        }, DRIFT_CHECK_MS);
    }

    function stopHeartbeat() {
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    }

    // ── Socket Management ────────────────────────────────────────────────────

    async function connectSocket(token) {
        if (socket?.connected) return;
        if (socket) socket.disconnect();

        socket = io(BACKEND_URL, {
            transports: ['websocket'],
            auth: { token }
        });

        socket.on('connect', () => {
            console.log('[Cuerates] Connected:', socket.id);
            updateStatusUI('connected');

            // Measure latency (half RTT) immediately on connect
            socket.emit('room:ping', { clientTime: Date.now() });

            if (roomCode) {
                socket.emit('room:join_socket', roomCode);
            }
        });

        socket.on('room:pong', ({ clientTime }) => {
            latencyMs = (Date.now() - clientTime) / 2;
            console.log(`[Cuerates] Latency offset: ${latencyMs.toFixed(0)}ms`);
        });

        // ── Join confirmation from server ────────────────────────────────────
        socket.on('room:joined', ({ isHost: hostFlag, members: memberList, lastState }) => {
            isHost = hostFlag;
            members = memberList || [];
            renderMembers();
            updateHostBadge();

            if (lastState) {
                // Server has stored playback state — sync after player loads
                setTimeout(() => applySync(lastState.paused ? 'pause' : 'play', lastState.currentTime, -1), 2000);
            } else if (!hostFlag) {
                // No stored state yet — ask host directly
                setTimeout(() => socket.emit('room:request_state', { roomCode }), 2000);
            }

            if (hostFlag) {
                startHeartbeat();
            } else {
                startDriftCorrection();
            }
        });

        // ── Playback sync from host ──────────────────────────────────────────
        socket.on('room:synced', ({ action, currentTime, seq }) => {
            applySync(action, currentTime, seq);
            const host = members.find(m => m.isHost);
            showActionStatus(action, currentTime, host?.username || 'Host');
        });

        // ── Heartbeat from host ──────────────────────────────────────────────
        socket.on('room:heartbeat', ({ currentTime, paused }) => {
            lastHeartbeat = { currentTime, paused, receivedAt: Date.now() };
        });

        // ── Host change ──────────────────────────────────────────────────────
        socket.on('room:host_change', ({ newHostSocketId, members: memberList }) => {
            members = memberList || [];
            const wasHost = isHost;
            isHost = newHostSocketId === socket.id;
            renderMembers();
            updateHostBadge();

            if (isHost && !wasHost) {
                stopDriftCorrection();
                startHeartbeat();
                showBadge('👑 You are now the host');
            }
        });

        // ── Member join / leave ──────────────────────────────────────────────
        socket.on('room:member_join', ({ user, members: memberList }) => {
            members = memberList || [];
            renderMembers();
            appendChatMessage({ message: `${user.username} joined`, isSystem: true });
        });

        socket.on('room:member_left', ({ username, members: memberList }) => {
            members = memberList || [];
            renderMembers();
            appendChatMessage({ message: `${username} left`, isSystem: true });
        });

        socket.on('room:members_update', ({ members: memberList }) => {
            members = memberList || [];
            renderMembers();
        });

        // ── Buffering sync ───────────────────────────────────────────────────
        socket.on('room:pause_for_buffer', ({ username }) => {
            suppressEmit(2000);
            playerPause();
            showActionStatus('pause', null, null, `⏳ Waiting for ${username}…`);
        });

        socket.on('room:resume_after_buffer', () => {
            if (playerIsPaused()) {
                suppressEmit(1500);
                playerPlay();
                showActionStatus('play', null, null, '▶ All caught up — resuming');
            }
        });

        // ── Emoji reactions ──────────────────────────────────────────────────
        socket.on('room:reaction', ({ emoji, username }) => {
            floatEmoji(emoji, username);
        });

        // ── Chat ─────────────────────────────────────────────────────────────
        socket.on('room:message', (data) => {
            appendChatMessage(data);
        });

        // ── State response (late-join fallback) ──────────────────────────────
        socket.on('room:state_request', () => {
            if (!video) return;
            socket.emit('room:state_response', {
                roomCode,
                state: { currentTime: playerGetTime(), paused: playerIsPaused() },
                requesterSocketId: null // server handles routing
            });
        });

        socket.on('room:state_response', ({ state }) => {
            if (!state) return;
            setTimeout(() => applySync(state.paused ? 'pause' : 'play', state.currentTime, -1), 2000);
        });

        // ── Connection status ────────────────────────────────────────────────
        socket.on('room:dissolved', () => {
            showBadge('Host ended session', 5000);
            deactivate();
        });

        socket.on('connect_error', (err) => {
            console.error('[Cuerates] Socket error:', err.message);
            updateStatusUI('error', err.message);
        });

        socket.on('disconnect', () => {
            console.log('[Cuerates] Socket disconnected');
            updateStatusUI('disconnected');
            stopHeartbeat();
        });

        socket.on('reconnect', () => {
            socket.emit('room:ping', { clientTime: Date.now() });
            if (roomCode) socket.emit('room:join_socket', roomCode);
        });
    }

    // ── Video Watcher ────────────────────────────────────────────────────────

    function attachListeners() {
        if (!video) return;
        Object.keys(videoHandlers).forEach(e => {
            video.removeEventListener(e, videoHandlers[e]);
            video.addEventListener(e, videoHandlers[e]);
        });
        console.log('[Cuerates] Video listeners attached');
    }

    function startWatcher() {
        if (watcher) return;
        watcher = setInterval(() => {
            const v = document.querySelector('video');
            if (v && v !== video) { video = v; attachListeners(); }
        }, 1000);
        const v = document.querySelector('video');
        if (v) { video = v; attachListeners(); }
    }

    // ── Activation ───────────────────────────────────────────────────────────

    async function activate(code, user, token) {
        if (activated && roomCode === code) return;
        activated = true;
        roomCode = code;
        currentUser = user;

        startWatcher();
        connectSocket(token);

        if (window.location.pathname.includes('/watch/')) {
            injectOverlay();
            showBadge(`🎬 Connected to ${roomCode}`);
        } else {
            showBadge(`🎬 Joined ${roomCode}! Navigate to a title to start syncing.`, 5000);
        }
    }

    function deactivate() {
        activated = false;
        roomCode = null;
        if (watcher)     { clearInterval(watcher); watcher = null; }
        stopDriftCorrection();
        stopHeartbeat();
        if (socket) { socket.disconnect(); socket = null; }
        ['cinelog-panel', 'cuerates-pill', 'cl-badge', 'cl-styles'].forEach(id => {
            document.getElementById(id)?.remove();
        });
        document.querySelectorAll('.cl-float-emoji').forEach(el => el.remove());
        showBadge('CineLog: Room Left');
    }

    // ── Init & Message Handling ──────────────────────────────────────────────

    async function autoJoinRoom(code) {
        const { cueratesToken } = await chrome.storage.local.get('cueratesToken');
        if (!cueratesToken) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/rooms/${code}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cueratesToken}` }
            });
            if (res.ok) chrome.runtime.sendMessage({ type: 'CUERATES_JOIN_ROOM', roomCode: code });
        } catch (e) { console.warn('[Cuerates] Auto-join error:', e); }
    }

    async function init() {
        const urlRoom = new URLSearchParams(window.location.search).get('clroom');
        chrome.runtime.sendMessage({ type: 'CUERATES_GET_STATUS' }, async (status) => {
            if (chrome.runtime.lastError || !status) return;
            const { cueratesToken, cueratesUser } = await chrome.storage.local.get(['cueratesToken', 'cueratesUser']);
            if (!cueratesToken) return;
            const code = urlRoom || status.roomCode;
            if (urlRoom && urlRoom !== status.roomCode) {
                await autoJoinRoom(urlRoom);
                activate(urlRoom, cueratesUser, cueratesToken);
            } else if (code) {
                activate(code, cueratesUser, cueratesToken);
            }
        });
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'CUERATES_ROOM_JOINED') init();
        else if (message.type === 'CUERATES_ROOM_LEFT') deactivate();
    });

    // ── Helpers ──────────────────────────────────────────────────────────────

    function updateLocalMemberBuffering(buffering) {
        if (!socket) return;
        const m = members.find(m => m.socketId === socket.id);
        if (m) { m.isBuffering = buffering; renderMembers(); }
    }

    // ── UI ───────────────────────────────────────────────────────────────────

    function injectOverlay() {
        if (document.getElementById('cinelog-panel')) return;

        // ── Panel (expanded state) ─────────────────────────────────────────
        const panel = document.createElement('div');
        panel.id = 'cinelog-panel';
        panel.innerHTML = `
            <div id="cl-header">
                <div id="cl-header-left">
                    <span class="cl-logo">🎬</span>
                    <div>
                        <div class="cl-title">Cuerates</div>
                        <div id="cl-status-row">
                            <span id="cl-status-dot"></span>
                            <span id="cl-status-text">Connecting…</span>
                        </div>
                    </div>
                </div>
                <div id="cl-header-right">
                    <span id="cl-room-code">${esc(roomCode)}</span>
                    <button id="cl-collapse-btn" title="Collapse panel">−</button>
                </div>
            </div>
            <div id="cl-members-bar"></div>
            <div id="cl-action-status"></div>
            <div id="cl-messages"></div>
            <div id="cl-emoji-bar">
                ${['❤️','😂','😮','👏','🔥','💀'].map(e =>
                    `<button class="cl-emoji-btn" data-emoji="${e}" title="React">${e}</button>`
                ).join('')}
            </div>
            <div id="cl-input-row">
                <input id="cl-input" placeholder="Say something…" maxlength="200" autocomplete="off" />
                <button id="cl-send-btn" title="Send">➤</button>
            </div>
        `;
        document.body.appendChild(panel);

        // ── Pill (collapsed state) ─────────────────────────────────────────
        const pill = document.createElement('div');
        pill.id = 'cuerates-pill';
        pill.innerHTML = `<span>🎬</span><span id="cl-pill-count">0</span>`;
        document.body.appendChild(pill);

        injectStyles();

        // Events
        document.getElementById('cl-collapse-btn').onclick = togglePanel;
        pill.onclick = togglePanel;
        document.getElementById('cl-send-btn').onclick = sendChat;
        document.getElementById('cl-input').onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
        document.querySelectorAll('.cl-emoji-btn').forEach(btn => {
            btn.onclick = () => {
                if (socket?.connected && roomCode) {
                    socket.emit('room:reaction', { roomCode, emoji: btn.dataset.emoji });
                }
            };
        });

        if (socket?.connected) updateStatusUI('connected');
        renderMembers();
        updateHostBadge();
    }

    function togglePanel() {
        panelExpanded = !panelExpanded;
        const panel = document.getElementById('cinelog-panel');
        const pill  = document.getElementById('cuerates-pill');
        if (!panel || !pill) return;
        if (panelExpanded) {
            panel.classList.remove('cl-hidden');
            pill.classList.add('cl-hidden');
        } else {
            panel.classList.add('cl-hidden');
            pill.classList.remove('cl-hidden');
            document.getElementById('cl-pill-count').textContent = members.length;
        }
    }

    function renderMembers() {
        const bar = document.getElementById('cl-members-bar');
        if (!bar) return;

        bar.innerHTML = members.map(m => `
            <div class="cl-member" title="${esc(m.username)}${m.isHost ? ' · Host' : ''}${m.isBuffering ? ' · Buffering…' : ''}">
                <div class="cl-avatar">${esc(m.username.charAt(0).toUpperCase())}</div>
                ${m.isHost       ? '<span class="cl-crown">👑</span>'                              : ''}
                ${m.isBuffering  ? '<span class="cl-buf-dot"></span>'                               : ''}
            </div>
        `).join('');

        const pillCount = document.getElementById('cl-pill-count');
        if (pillCount) pillCount.textContent = members.length;
    }

    let hostBadgeEl = null;
    function updateHostBadge() {
        const headerLeft = document.getElementById('cl-header-left');
        if (!headerLeft) return;
        if (!hostBadgeEl) {
            hostBadgeEl = document.createElement('span');
            hostBadgeEl.id = 'cl-host-badge';
            headerLeft.appendChild(hostBadgeEl);
        }
        hostBadgeEl.textContent   = isHost ? '👑 Host' : '👤 Guest';
        hostBadgeEl.style.cssText = `
            font-size:10px; padding:2px 8px; border-radius:6px; margin-top:3px;
            display:inline-block;
            background:${isHost ? 'rgba(245,197,24,0.12)' : 'rgba(255,255,255,0.07)'};
            color:${isHost ? '#f5c518' : 'rgba(255,255,255,0.45)'};
        `;
    }

    let actionStatusTimer = null;
    function showActionStatus(action, time, username, customMsg) {
        const el = document.getElementById('cl-action-status');
        if (!el) return;
        const icons = { play: '▶', pause: '⏸', seek: '⏩' };
        const timeStr = (time !== null && time !== undefined) ? ` ${formatTime(time)}` : '';
        const who = username ? `${username} ` : '';
        el.textContent = customMsg || `${icons[action] || ''} ${who}${action}${timeStr}`;
        el.style.opacity = '1';
        clearTimeout(actionStatusTimer);
        actionStatusTimer = setTimeout(() => { el.style.opacity = '0'; }, 3500);
    }

    function updateStatusUI(status, errorMsg) {
        const dot  = document.getElementById('cl-status-dot');
        const text = document.getElementById('cl-status-text');
        if (!dot || !text) return;
        const states = {
            connected:    { bg: '#10b981', label: currentUser?.username ? `@${currentUser.username}` : 'Connected' },
            error:        { bg: '#ef4444', label: errorMsg || 'Error' },
            disconnected: { bg: '#f59e0b', label: 'Reconnecting…' }
        };
        const s = states[status] || states.disconnected;
        dot.style.background = s.bg;
        text.textContent = s.label;
    }

    function sendChat() {
        const input = document.getElementById('cl-input');
        if (!input?.value.trim() || !socket?.connected) return;
        socket.emit('room:chat', { roomCode, message: input.value.trim() });
        input.value = '';
    }

    function appendChatMessage({ username, message, userId, isSystem, timestamp }) {
        const container = document.getElementById('cl-messages');
        if (!container) return;

        const div = document.createElement('div');

        if (isSystem) {
            div.className = 'cl-sys';
            div.textContent = message;
        } else {
            const isOwn = userId && currentUser &&
                userId.toString() === (currentUser._id || currentUser.id || '').toString();
            const initial = (username || '?').charAt(0).toUpperCase();
            const timeStr = timestamp
                ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';
            div.className = `cl-msg${isOwn ? ' cl-own' : ''}`;
            div.innerHTML = `
                <div class="cl-msg-av">${esc(initial)}</div>
                <div class="cl-msg-body">
                    <div class="cl-msg-meta">
                        <span class="cl-msg-name">${esc(username)}</span>
                        <span class="cl-msg-time">${esc(timeStr)}</span>
                    </div>
                    <div class="cl-msg-text">${esc(message)}</div>
                </div>
            `;
        }

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        if (container.children.length > 50) container.children[0].remove();
    }

    function floatEmoji(emoji) {
        const el = document.createElement('div');
        el.className = 'cl-float-emoji';
        el.textContent = emoji;
        el.style.left = `${15 + Math.random() * 70}%`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2600);
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

    // ── Styles ───────────────────────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('cl-styles')) return;
        const s = document.createElement('style');
        s.id = 'cl-styles';
        s.textContent = `
            /* ── Notification badge ───────────────────────────────────────── */
            #cl-badge {
                position:fixed; top:72px; left:50%; transform:translateX(-50%);
                background:rgba(8,8,16,0.92); border:1px solid rgba(129,140,248,0.25);
                color:#fff; padding:9px 22px; border-radius:100px;
                font-size:13px; font-weight:500; font-family:system-ui,sans-serif;
                z-index:2147483647; opacity:0; transition:opacity .3s; pointer-events:none;
            }

            /* ── Panel ────────────────────────────────────────────────────── */
            #cinelog-panel {
                position:fixed; bottom:88px; right:22px; width:308px;
                background:rgba(8,8,16,0.96); border:1px solid rgba(129,140,248,0.2);
                border-radius:18px; z-index:2147483647; color:#fff;
                box-shadow:0 16px 56px rgba(0,0,0,0.7); font-family:system-ui,sans-serif;
                overflow:hidden; backdrop-filter:blur(14px);
                display:flex; flex-direction:column;
            }
            #cinelog-panel.cl-hidden { display:none; }

            /* ── Pill (collapsed) ─────────────────────────────────────────── */
            #cuerates-pill {
                display:none; position:fixed; bottom:88px; right:22px;
                width:54px; height:54px; border-radius:50%; cursor:pointer;
                background:rgba(129,140,248,0.88); z-index:2147483647;
                align-items:center; justify-content:center; flex-direction:column; gap:1px;
                font-size:17px; box-shadow:0 4px 20px rgba(129,140,248,0.45);
                transition:transform .15s;
            }
            #cuerates-pill:not(.cl-hidden) { display:flex; }
            #cuerates-pill:hover { transform:scale(1.08); }
            #cl-pill-count { font-size:10px; font-weight:700; color:#fff; line-height:1; }

            /* ── Header ───────────────────────────────────────────────────── */
            #cl-header {
                display:flex; align-items:center; justify-content:space-between;
                padding:11px 14px; background:rgba(129,140,248,0.09);
                border-bottom:1px solid rgba(129,140,248,0.1); flex-shrink:0;
            }
            #cl-header-left  { display:flex; align-items:center; gap:8px; }
            .cl-logo         { font-size:18px; line-height:1; }
            .cl-title        { font-size:14px; font-weight:700; line-height:1.2; }
            #cl-status-row   { display:flex; align-items:center; gap:5px; margin-top:3px; }
            #cl-status-dot   { width:6px; height:6px; border-radius:50%; background:#f59e0b; flex-shrink:0; }
            #cl-status-text  { font-size:10px; color:rgba(255,255,255,0.45); font-weight:500; }
            #cl-header-right { display:flex; align-items:center; gap:8px; }
            #cl-room-code    {
                font-size:10px; font-weight:800; letter-spacing:.15em;
                background:rgba(129,140,248,0.14); color:#818cf8;
                padding:2px 8px; border-radius:6px;
            }
            #cl-collapse-btn {
                background:none; border:none; color:rgba(255,255,255,0.35);
                cursor:pointer; font-size:18px; line-height:1; padding:0;
            }
            #cl-collapse-btn:hover { color:#fff; }

            /* ── Members bar ──────────────────────────────────────────────── */
            #cl-members-bar {
                display:flex; align-items:center; gap:10px; padding:8px 14px;
                border-bottom:1px solid rgba(255,255,255,0.05); flex-shrink:0; min-height:44px;
            }
            .cl-member  { position:relative; }
            .cl-avatar  {
                width:28px; height:28px; border-radius:50%;
                background:rgba(129,140,248,0.28);
                display:flex; align-items:center; justify-content:center;
                font-size:12px; font-weight:700;
                border:2px solid rgba(129,140,248,0.35);
            }
            .cl-crown   { position:absolute; top:-7px; left:50%; transform:translateX(-50%); font-size:10px; }
            .cl-buf-dot {
                position:absolute; bottom:0; right:0;
                width:8px; height:8px; border-radius:50%;
                background:#f59e0b; border:1.5px solid rgba(8,8,16,0.96);
                animation:cl-pulse 1s infinite;
            }
            @keyframes cl-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }

            /* ── Action status (non-chat, auto-fades) ─────────────────────── */
            #cl-action-status {
                padding:4px 14px; font-size:11px; color:rgba(255,255,255,0.45);
                opacity:0; transition:opacity .3s; min-height:22px; flex-shrink:0;
                white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
            }

            /* ── Messages ─────────────────────────────────────────────────── */
            #cl-messages {
                flex:1; min-height:0; max-height:190px; overflow-y:auto;
                padding:10px 12px; display:flex; flex-direction:column; gap:8px;
                scrollbar-width:thin; scrollbar-color:rgba(129,140,248,.25) transparent;
            }
            #cl-messages::-webkit-scrollbar       { width:3px; }
            #cl-messages::-webkit-scrollbar-thumb { background:rgba(129,140,248,.28); border-radius:10px; }

            .cl-msg      { display:flex; gap:8px; align-items:flex-start; }
            .cl-own      { flex-direction:row-reverse; }
            .cl-msg-av   {
                width:24px; height:24px; border-radius:50%; flex-shrink:0; margin-top:2px;
                background:rgba(129,140,248,.28);
                display:flex; align-items:center; justify-content:center;
                font-size:10px; font-weight:700;
            }
            .cl-msg-body { display:flex; flex-direction:column; gap:2px; max-width:82%; }
            .cl-msg-meta { display:flex; align-items:center; gap:5px; }
            .cl-own .cl-msg-meta { flex-direction:row-reverse; }
            .cl-msg-name { font-size:11px; color:rgba(255,255,255,.45); font-weight:600; }
            .cl-msg-time { font-size:10px; color:rgba(255,255,255,.22); }
            .cl-msg-text {
                background:rgba(255,255,255,.07); padding:6px 11px;
                border-radius:10px 10px 10px 3px;
                font-size:13px; line-height:1.4; word-break:break-word;
            }
            .cl-own .cl-msg-text {
                background:rgba(129,140,248,.2);
                border-radius:10px 10px 3px 10px;
            }
            .cl-sys {
                text-align:center; font-size:11px;
                color:rgba(255,255,255,.28); font-style:italic;
            }

            /* ── Emoji bar ────────────────────────────────────────────────── */
            #cl-emoji-bar {
                display:flex; justify-content:space-around; padding:7px 12px;
                border-top:1px solid rgba(255,255,255,.05); flex-shrink:0;
            }
            .cl-emoji-btn {
                background:none; border:none; font-size:18px; cursor:pointer;
                padding:3px 5px; border-radius:7px; transition:transform .12s;
            }
            .cl-emoji-btn:hover  { transform:scale(1.45); background:rgba(255,255,255,.08); }
            .cl-emoji-btn:active { transform:scale(.88); }

            /* ── Input ────────────────────────────────────────────────────── */
            #cl-input-row {
                display:flex; border-top:1px solid rgba(255,255,255,.06); flex-shrink:0;
            }
            #cl-input {
                flex:1; background:transparent; border:none;
                padding:11px 12px; color:#fff; outline:none; font-size:13px;
            }
            #cl-input::placeholder { color:rgba(255,255,255,.22); }
            #cl-send-btn {
                width:42px; background:none; border:none;
                border-left:1px solid rgba(255,255,255,.06);
                color:#818cf8; cursor:pointer; font-size:14px;
            }
            #cl-send-btn:hover { color:#fff; }

            /* ── Floating emoji reaction ──────────────────────────────────── */
            .cl-float-emoji {
                position:fixed; bottom:150px; font-size:34px;
                z-index:2147483647; pointer-events:none;
                animation:cl-float 2.6s ease-out forwards;
            }
            @keyframes cl-float {
                0%   { transform:translateY(0) scale(1);   opacity:1; }
                100% { transform:translateY(-210px) scale(1.5); opacity:0; }
            }
        `;
        document.head.appendChild(s);
    }

    // ── Utilities ────────────────────────────────────────────────────────────

    function formatTime(s) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        return h > 0
            ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
            : `${m}:${String(sec).padStart(2,'0')}`;
    }

    function esc(str) {
        return String(str || '')
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;');
    }

    init();
})();
