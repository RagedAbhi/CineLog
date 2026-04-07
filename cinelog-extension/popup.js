/**
 * CineLog Extension — Popup Script
 * Handles login, room join/leave, and live member display.
 */

const BACKEND_URL = 'https://cinelog-wdaj.onrender.com';

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const statusDot        = $('status-dot');
const viewLoading      = $('view-loading');
const viewLogin        = $('view-login');
const viewMain         = $('view-main');
const loginEmail       = $('login-email');
const loginPassword    = $('login-password');
const loginError       = $('login-error');
const loginBtn         = $('login-btn');
const logoutBtn        = $('logout-btn');
const sectionRoom      = $('section-room');
const sectionNoRoom    = $('section-no-room');
const roomCodeDisplay  = $('room-code-display');
const roomTitleDisplay = $('room-title-display');
const membersList      = $('members-list');
const leaveBtn         = $('leave-btn');
const joinCodeInput    = $('join-code-input');
const joinBtn          = $('join-btn');
const joinError        = $('join-error');

// ── State ──────────────────────────────────────────────────────────────────
let token = null;
let currentRoom = null;

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
    const status = await bgMessage({ type: 'CINELOG_GET_STATUS' });
    token = status.token;

    if (!token) {
        show(viewLogin);
        return;
    }

    updateDot(status.connected);
    show(viewMain);

    if (status.roomCode) {
        await loadRoom(status.roomCode);
    } else {
        showNoRoom();
    }
}

// ── Background messaging ───────────────────────────────────────────────────
function bgMessage(msg) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(msg, (res) => resolve(res || {}));
    });
}

// ── Login ──────────────────────────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();
    if (!email || !password) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in…';
    loginError.style.display = 'none';

    try {
        const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Login failed');

        token = data.token;
        // Save user info for content-script
        chrome.storage.local.set({ cinelogUser: data.user });
        await bgMessage({ type: 'CINELOG_SET_TOKEN', token });

        show(viewMain);
        updateDot(true);
        showNoRoom();
    } catch (err) {
        loginError.textContent = err.message;
        loginError.style.display = 'block';
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }
});

// ── Logout ─────────────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
    await bgMessage({ type: 'CINELOG_LOGOUT' });
    token = null;
    currentRoom = null;
    show(viewLogin);
    updateDot(false);
});

// ── Tabs ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        $('panel-join').style.display   = target === 'join'   ? 'block' : 'none';
        $('panel-create').style.display = target === 'create' ? 'block' : 'none';
    });
});

// ── Join room ──────────────────────────────────────────────────────────────
joinCodeInput.addEventListener('input', () => {
    joinCodeInput.value = joinCodeInput.value.toUpperCase();
});

joinBtn.addEventListener('click', async () => {
    const code = joinCodeInput.value.trim();
    if (!code || code.length !== 6) return;

    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining…';
    joinError.style.display = 'none';

    try {
        const res = await fetch(`${BACKEND_URL}/api/rooms/${code}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Room not found');

        await bgMessage({ type: 'CINELOG_JOIN_ROOM', roomCode: code });
        await loadRoom(code, data);
    } catch (err) {
        joinError.textContent = err.message;
        joinError.style.display = 'block';
    } finally {
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join';
    }
});

// ── Leave room ─────────────────────────────────────────────────────────────
leaveBtn.addEventListener('click', async () => {
    if (!currentRoom) return;

    leaveBtn.disabled = true;
    try {
        await fetch(`${BACKEND_URL}/api/rooms/${currentRoom.roomCode}/leave`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        await bgMessage({ type: 'CINELOG_LEAVE_ROOM' });
    } catch (_) {}

    currentRoom = null;
    showNoRoom();
    leaveBtn.disabled = false;
});

// ── Load / render room ─────────────────────────────────────────────────────
async function loadRoom(code, roomData) {
    try {
        const room = roomData || await (await fetch(`${BACKEND_URL}/api/rooms/${code}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })).json();

        if (!room.roomCode) { showNoRoom(); return; }
        currentRoom = room;
        renderRoom(room);
    } catch (_) {
        showNoRoom();
    }
}

function renderRoom(room) {
    sectionRoom.style.display    = 'block';
    sectionNoRoom.style.display  = 'none';

    roomCodeDisplay.textContent  = room.roomCode;
    roomTitleDisplay.textContent = room.contentTitle || 'Netflix Session';

    membersList.innerHTML = '';
    (room.members || []).filter(m => m.isActive).forEach(m => {
        const div = document.createElement('div');
        div.className = 'member';
        const avatar = m.user?.profilePicture
            ? `<img src="${m.user.profilePicture}" alt="${m.user.username}" />`
            : (m.user?.username || '?')[0].toUpperCase();
        div.innerHTML = `<div class="member-avatar">${avatar}</div><span>${m.user?.username || '?'}</span>`;
        membersList.appendChild(div);
    });
}

function showNoRoom() {
    sectionRoom.style.display   = 'none';
    sectionNoRoom.style.display = 'block';
}

// ── Live updates from background ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'ROOM_UPDATE' && currentRoom) {
        currentRoom.members = message.payload.members;
        renderRoom(currentRoom);
    }
    if (message.type === 'ROOM_DISSOLVED') {
        currentRoom = null;
        showNoRoom();
    }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function show(el) {
    viewLoading.style.display = 'none';
    viewLogin.style.display   = 'none';
    viewMain.style.display    = 'none';
    el.style.display          = 'block';
}

function updateDot(connected) {
    statusDot.className = 'status-dot' + (connected ? ' connected' : '');
}

// ── Start ──────────────────────────────────────────────────────────────────
boot();
