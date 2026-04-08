/**
 * Minimal Socket.io v4 client using native WebSocket.
 * Implements the Engine.io + Socket.io packet protocol so the extension
 * can communicate with the CineLog Socket.io server without any npm dependency.
 *
 * Packet format reference (Engine.io v4 / Socket.io v4):
 *   Engine.io types: 0=OPEN  2=PING  3=PONG  4=MESSAGE
 *   Socket.io types: 0=CONNECT  2=EVENT  (prepended to Engine.io MESSAGE)
 *   Full example: "42["room:sync", {...}]"
 *                  ^^ 4=ENGINE MSG, 2=SIO EVENT
 */
export class SocketClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.ws = null;
        this.sid = null;
        this._pingTimer = null;
        this._reconnectTimer = null;
        this._reconnectDelay = 1000;
        this._handlers = {};   // event → [fn]
        this.connected = false;

        this._connect();
    }

    // ── Connection ────────────────────────────────────────────────────────

    _connect() {
        const base = this.serverUrl
            .replace(/^https:\/\//, 'wss://')
            .replace(/^http:\/\//, 'ws://')
            .replace(/\/$/, '');

        const url = `${base}/socket.io/?EIO=4&transport=websocket`;

        try {
            this.ws = new WebSocket(url);
        } catch (e) {
            console.error('[CineLog Socket] WebSocket creation failed:', e);
            this._scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            // Send namespace connect packet
            this.ws.send('40');
        };

        this.ws.onmessage = ({ data }) => this._onRaw(data);

        this.ws.onclose = () => {
            this.connected = false;
            clearInterval(this._pingTimer);
            this._fire('disconnect');
            this._scheduleReconnect();
        };

        this.ws.onerror = (e) => {
            console.error('[CineLog Socket] WebSocket error:', e.message || e);
        };
    }

    _scheduleReconnect() {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => {
            this._reconnectDelay = Math.min(this._reconnectDelay * 2, 30_000);
            this._connect();
        }, this._reconnectDelay);
    }

    // ── Packet parsing ────────────────────────────────────────────────────

    _onRaw(data) {
        // Engine.io PING from server
        if (data === '2') {
            this.ws.send('3');  // PONG
            return;
        }

        // Engine.io OPEN (handshake)
        if (data.startsWith('0')) {
            try {
                const cfg = JSON.parse(data.slice(1));
                this.sid = cfg.sid;
                this._reconnectDelay = 1000;
                // Keep-alive: send pong every pingInterval ms
                this._pingTimer = setInterval(() => {
                    if (this.ws.readyState === WebSocket.OPEN) this.ws.send('3');
                }, (cfg.pingInterval || 25000) - 2000);
            } catch (_) {}
            return;
        }

        // Socket.io CONNECT confirmation ("40{...}" or "40")
        if (data.startsWith('40')) {
            this.connected = true;
            this._fire('connect');
            return;
        }

        // Socket.io EVENT ("42[...]")
        if (data.startsWith('42')) {
            try {
                const [event, ...args] = JSON.parse(data.slice(2));
                this._fire(event, ...args);
            } catch (e) {
                console.error('[CineLog Socket] Parse error:', e.message, data);
            }
            return;
        }
    }

    // ── Public API ────────────────────────────────────────────────────────

    emit(event, data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send('42' + JSON.stringify([event, data]));
    }

    on(event, fn) {
        (this._handlers[event] = this._handlers[event] || []).push(fn);
        return this;
    }

    off(event, fn) {
        if (!this._handlers[event]) return;
        this._handlers[event] = fn
            ? this._handlers[event].filter(h => h !== fn)
            : [];
    }

    disconnect() {
        clearInterval(this._pingTimer);
        clearTimeout(this._reconnectTimer);
        if (this.ws) this.ws.close();
        this.connected = false;
    }

    _fire(event, ...args) {
        (this._handlers[event] || []).forEach(fn => {
            try { fn(...args); } catch (e) { console.error('[CineLog Socket] Handler error:', e); }
        });
    }
}
