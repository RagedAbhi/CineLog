import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipForward, SkipBack, AlertTriangle, Subtitles, Users, MessageCircle, Send, Copy, Check, Smile } from 'lucide-react';
import { fetchAllSubtitles, getInstalledAddons } from '../services/addonService';
import { updatePlaybackProgress, getPlaybackProgress } from '../services/playbackService';
import { io } from 'socket.io-client';
import config from '../config';

const EMOJIS = ['😂','❤️','🔥','👏','😮','😭','🎬','🍿','✨','💀','😍','🤣','👀','💯','🎉'];

const fmt = (secs) => {
    if (!isFinite(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
};

const VIDEO_EXT = /\.(mp4|mkv|avi|webm|mov|m4v|ts|wmv)$/i;

const loadWebTorrent = () => new Promise((resolve, reject) => {
    if (window.WebTorrent) { resolve(window.WebTorrent); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/webtorrent@1.9.7/webtorrent.min.js';
    script.onload = () => window.WebTorrent ? resolve(window.WebTorrent) : reject(new Error('WebTorrent not found on window'));
    script.onerror = () => reject(new Error('Failed to load WebTorrent script'));
    document.head.appendChild(script);
});

const getMagnetURI = (stream) => {
    if (stream?.url?.startsWith('magnet:')) return stream.url;
    if (stream?.infoHash) return `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.name || '')}`;
    return null;
};

const IS_ELECTRON = typeof window !== 'undefined' && !!window.__ELECTRON__?.isElectron;

const PlayerPicker = ({ mediaPlayers, savedPlayer, showPicker, onTogglePicker, onSelect }) => (
    <div style={{ position: 'relative', marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
            <button
                onClick={() => savedPlayer ? onSelect(savedPlayer) : onTogglePicker()}
                style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: 'rgba(255,165,0,0.15)', border: '1px solid rgba(255,165,0,0.4)',
                    color: '#ffa500', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                }}
            >
                🎬 {savedPlayer ? `Open in ${savedPlayer.name}` : 'Open with...'}
            </button>
            {savedPlayer && (
                <button
                    onClick={onTogglePicker}
                    title="Change player"
                    style={{
                        padding: '8px 10px', borderRadius: 8,
                        background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)',
                        color: '#ffa500', cursor: 'pointer', fontSize: '0.8rem',
                    }}
                >⚙</button>
            )}
        </div>
        {showPicker && (
            <div style={{
                position: 'absolute', top: '110%', zIndex: 50,
                background: '#0b091c', border: '1px solid rgba(255,165,0,0.3)',
                borderRadius: 10, padding: 8, minWidth: 180,
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}>
                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '4px 8px 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Open stream with
                </p>
                {mediaPlayers.length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: '#64748b', padding: '4px 8px' }}>No players detected</p>
                ) : mediaPlayers.map(player => (
                    <button
                        key={player.path}
                        onClick={() => onSelect(player)}
                        style={{
                            width: '100%', textAlign: 'left', background: 'none', border: 'none',
                            color: savedPlayer?.path === player.path ? '#ffa500' : '#fff',
                            padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                            fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,165,0,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                        {player.name}
                        {savedPlayer?.path === player.path && <span style={{ fontSize: '0.7rem' }}>✓ saved</span>}
                    </button>
                ))}
            </div>
        )}
    </div>
);

const VideoPlayerModal = ({ url, stream, title, movie, imdbId, onClose, roomId: initialRoomId }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const wtClientRef = useRef(null);
    const controlsTimer = useRef(null);

    // In Electron mode, torrent streams arrive as a pre-built localhost HTTP URL (url is set, stream is null).
    // Browser WebTorrent is only used on web when url is absent and stream has a magnet/infoHash.
    const isTorrent = !IS_ELECTRON && !url && stream && (stream.infoHash || stream.url?.startsWith('magnet:'));
    const isLocalTorrentStream = IS_ELECTRON && !!(url?.includes('127.0.0.1') && url?.includes('/api/torrent/stream'));

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [buffered, setBuffered] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [torrentInfo, setTorrentInfo] = useState('');
    const [subtitles, setSubtitles] = useState([]);
    const [activeSub, setActiveSub] = useState(null);
    const [trackSrc, setTrackSrc] = useState(null);
    const [showSubMenu, setShowSubMenu] = useState(false);

    // External player picker
    const [mediaPlayers, setMediaPlayers] = useState([]);
    const [savedPlayer, setSavedPlayer] = useState(null);
    const [showPlayerPicker, setShowPlayerPicker] = useState(false);

    // Stream Together state
    const socketRef = useRef(null);
    const isSyncingRef = useRef(false);
    const heartbeatRef = useRef(null);
    const [roomId, setRoomId] = useState(initialRoomId || null);
    const [isHost, setIsHost] = useState(false);
    const [roomMembers, setRoomMembers] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showRoomPanel, setShowRoomPanel] = useState(false);
    const [initialState, setInitialState] = useState(null);
    const chatEndRef = useRef(null);
    const isInRoom = !!roomId;

    // Progress Tracking
    const lastSavedTimeRef = useRef(0);
    const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

    const resetControlsTimer = useCallback(() => {
        setShowControls(true);
        clearTimeout(controlsTimer.current);
        controlsTimer.current = setTimeout(() => {
            if (playing) setShowControls(false);
        }, 3000);
    }, [playing]);

    useEffect(() => { resetControlsTimer(); return () => clearTimeout(controlsTimer.current); }, [playing]);

    // Browser-side WebTorrent streaming
    useEffect(() => {
        if (!isTorrent || !videoRef.current) return;
        let mounted = true;
        setLoading(true);
        setError('');
        setTorrentInfo('Loading WebTorrent engine...');

        loadWebTorrent().then(WT => {
            if (!mounted) return;
            setTorrentInfo('Connecting to peers...');
            const client = new WT();
            wtClientRef.current = client;

            const magnetURI = getMagnetURI(stream);
            if (!magnetURI) { setError('Invalid torrent data (no magnet/infoHash)'); setLoading(false); return; }

            client.add(magnetURI, (torrent) => {
                if (!mounted) return;
                setTorrentInfo(`Found torrent: ${torrent.files.length} file(s). Selecting video...`);

                const idx = stream.fileIdx ?? 0;
                let file = torrent.files[idx];
                if (!file || !VIDEO_EXT.test(file.name)) {
                    file = torrent.files
                        .filter(f => VIDEO_EXT.test(f.name))
                        .sort((a, b) => b.length - a.length)[0] || torrent.files[0];
                }

                if (!file) { setError('No video file found in torrent'); setLoading(false); return; }

                setTorrentInfo(`Buffering "${file.name}"... (${(file.length / 1e9).toFixed(2)} GB)`);

                file.renderTo(videoRef.current, (err) => {
                    if (!mounted) return;
                    if (err) { setError('Torrent render failed: ' + err.message); setLoading(false); }
                    else { setLoading(false); setTorrentInfo(''); }
                });
            });

            client.on('error', (err) => {
                if (mounted) { setError('WebTorrent: ' + err.message); setLoading(false); }
            });
        }).catch(err => {
            if (mounted) { setError('Could not load WebTorrent engine: ' + err.message); setLoading(false); }
        });

        return () => {
            mounted = false;
            if (wtClientRef.current) { wtClientRef.current.destroy(); wtClientRef.current = null; }
        };
    }, [isTorrent]); // only run once per mount

    // Desktop Torrent Status Polling
    useEffect(() => {
        if (!isLocalTorrentStream || !loading) return;

        const getInfoHash = () => {
            if (!url) return null;
            // Try query param first
            const fromQuery = new URLSearchParams(url.split('?')[1]).get('infoHash');
            if (fromQuery) return fromQuery;
            
            // Try extracting from path (e.g., /stream/HASH)
            const parts = url.split('/');
            const lastPart = parts[parts.length - 1].split('?')[0];
            if (lastPart && lastPart.length === 40) return lastPart; // Standard 40-char infoHash
            
            return null;
        };

        const infoHash = getInfoHash();
        if (!infoHash) return;

        const pollStatus = async () => {
            try {
                const res = await fetch(`${config.TORRENT_SERVER_URL}/api/torrent/status?infoHash=${infoHash}`);
                if (res.ok) {
                    const data = await res.json();
                    const speedMb = (data.downloadSpeed / (1024 * 1024)).toFixed(2);
                    setTorrentInfo(`Connected to ${data.numPeers} peers | Speed: ${speedMb} MB/s`);
                }
            } catch (err) {
                console.error('[Torrent] Status poll failed:', err);
            }
        };

        const interval = setInterval(pollStatus, 2000);
        pollStatus();

        return () => clearInterval(interval);
    }, [isLocalTorrentStream, loading, url]);

    // Fetch subtitles
    useEffect(() => {
        const loadSubs = async () => {
            try {
                let id = imdbId || movie?.imdbID || movie?.imdb_id;
                if (id) {
                    // Strip any existing :s:e markers to avoid tt123:1:1:1:1
                    id = String(id).split(':')[0];
                    if (!id.startsWith('tt')) id = `tt${id}`;
                }

                // Extract season/episode from URL if it's a series
                const params = new URLSearchParams(url?.split('?')[1] || '');
                const season = params.get('season');
                const episode = params.get('episode');
                const type = (movie?.mediaType || params.get('type')) === 'series' ? 'series' : 'movie';

                const { installedAddons } = await getInstalledAddons();
                const fetched = await fetchAllSubtitles({
                    imdbId: id,
                    addons: installedAddons,
                    type: type,
                    season: type === 'series' ? (season || 1) : undefined,
                    episode: type === 'series' ? (episode || 1) : undefined,
                    title: movie?.title || title
                });
                setSubtitles(fetched);
                // Auto-select English if available
                const english = fetched.find(s => s.lang?.toLowerCase().includes('eng') || s.id?.toLowerCase().includes('eng'));
                if (english) setActiveSub(english);
            } catch (err) {
                console.error('Subtitle fetch failed:', err);
            }
        };
        if (movie || imdbId || url) loadSubs();
    }, [imdbId, movie, url]);

    // Handle SRT conversion and Track Src
    useEffect(() => {
        if (!activeSub) {
            setTrackSrc(null);
            // Hide all text tracks when subtitles turned off
            if (videoRef.current) {
                Array.from(videoRef.current.textTracks).forEach(t => { t.mode = 'hidden'; });
            }
            return;
        }

        const prepareSub = async () => {
            try {
                // Fetch subtitle directly — Electron's session CORS bypass (in electron.js) allows
                // the renderer to fetch any external URL without restrictions or proxying.
                const res = await fetch(activeSub.url);
                let text = await res.text();

                // Convert SRT to VTT if the content doesn't already start with WEBVTT
                if (!text.trimStart().startsWith('WEBVTT')) {
                    text = 'WEBVTT\n\n' + text
                        .replace(/\r\n/g, '\n')
                        .replace(/\r/g, '\n')
                        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
                        .trim();
                }

                const blob = new Blob([text], { type: 'text/vtt' });
                setTrackSrc(URL.createObjectURL(blob));
            } catch (err) {
                console.error('Failed to prepare subtitle:', err);
            }
        };

        prepareSub();
        return () => {
            if (trackSrc && trackSrc.startsWith('blob:')) {
                URL.revokeObjectURL(trackSrc);
            }
        };
    }, [activeSub]);

    // Load available media players and saved preference once on mount
    useEffect(() => {
        if (!IS_ELECTRON) return;
        window.__ELECTRON__?.getMediaPlayers?.()?.then(players => {
            setMediaPlayers(players || []);
        });
        try {
            const saved = JSON.parse(localStorage.getItem('cinelog_media_player') || 'null');
            if (saved?.name && saved?.path) setSavedPlayer(saved);
        } catch {}
    }, []);

    const openWithPlayer = (player) => {
        window.__ELECTRON__?.launchWithPlayer(player.path, url);
        localStorage.setItem('cinelog_media_player', JSON.stringify(player));
        setSavedPlayer(player);
        setShowPlayerPicker(false);
    };

    // Imperatively manage the <track> element instead of using React JSX.
    // React's declarative <track> inside <video> is unreliable in Electron —
    // dynamically added JSX tracks often don't register in textTracks correctly.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Remove any existing subtitle tracks from previous selection
        Array.from(video.querySelectorAll('track[kind="subtitles"]')).forEach(t => t.remove());
        // Hide any lingering textTracks
        Array.from(video.textTracks).forEach(t => { t.mode = 'hidden'; });

        if (!trackSrc) return;

        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.src = trackSrc;
        track.srclang = activeSub?.id || 'en';
        track.label = activeSub?.lang || 'Subtitle';
        track.default = true;
        video.appendChild(track);

        const enable = () => {
            // Find and show our track
            Array.from(video.textTracks).forEach(t => {
                t.mode = (t.label === track.label) ? 'showing' : 'hidden';
            });
        };

        track.addEventListener('load', enable);
        // Also apply immediately and after a short delay in case load already fired
        enable();
        const t = setTimeout(enable, 500);

        return () => {
            clearTimeout(t);
            track.removeEventListener('load', enable);
            if (track.parentNode === video) video.removeChild(track);
        };
    }, [trackSrc]);

    // ── Stream Together socket ────────────────────────────────────────────────
    useEffect(() => {
        if (!roomId) return;
        const token = localStorage.getItem('token');
        const sock = io(config.SOCKET_URL, { auth: { token }, transports: ['websocket'] });
        socketRef.current = sock;

        sock.on('connect', () => {
            sock.emit('join', null); // personal room optional
            sock.emit('room:join_socket', roomId);
        });

        sock.on('room:joined', ({ isHost: h, members, lastState }) => {
            setIsHost(h);
            setRoomMembers(members);
            setShowChat(true);
            if (!h && lastState) {
                // If video is ready, apply now. Otherwise, store for onLoadedMetadata
                if (videoRef.current && videoRef.current.readyState >= 1) {
                    isSyncingRef.current = true;
                    videoRef.current.currentTime = lastState.currentTime;
                    if (lastState.paused) videoRef.current.pause();
                    else videoRef.current.play().catch(() => {});
                    setTimeout(() => { isSyncingRef.current = false; }, 500);
                } else {
                    setInitialState(lastState);
                }
            }
        });

        sock.on('room:member_join', ({ members }) => setRoomMembers(members));
        sock.on('room:member_left', ({ members }) => setRoomMembers(members));
        sock.on('room:members_update', ({ members }) => setRoomMembers(members));

        sock.on('room:synced', ({ action, currentTime }) => {
            if (!videoRef.current) return;
            isSyncingRef.current = true;
            videoRef.current.currentTime = currentTime;
            if (action === 'play') videoRef.current.play().catch(() => {});
            else if (action === 'pause') videoRef.current.pause();
            setTimeout(() => { isSyncingRef.current = false; }, 500);
        });

        sock.on('room:heartbeat', ({ currentTime, paused }) => {
            if (!videoRef.current) return;
            const drift = Math.abs(videoRef.current.currentTime - currentTime);
            if (drift > 3) {
                isSyncingRef.current = true;
                videoRef.current.currentTime = currentTime;
                setTimeout(() => { isSyncingRef.current = false; }, 500);
            }
            if (paused && !videoRef.current.paused) videoRef.current.pause();
            if (!paused && videoRef.current.paused) videoRef.current.play().catch(() => {});
        });

        sock.on('room:pause_for_buffer', () => {
            isSyncingRef.current = true;
            videoRef.current?.pause();
            setTimeout(() => { isSyncingRef.current = false; }, 500);
        });

        sock.on('room:resume_after_buffer', () => {
            isSyncingRef.current = true;
            videoRef.current?.play().catch(() => {});
            setTimeout(() => { isSyncingRef.current = false; }, 500);
        });

        sock.on('room:message', (msg) => {
            setChatMessages(prev => [...prev, msg]);
        });

        sock.on('room:reaction', ({ emoji, username }) => {
            setChatMessages(prev => [...prev, { message: `${emoji}`, username, isReaction: true, timestamp: new Date() }]);
        });

        return () => {
            sock.emit('room:leave_socket', roomId);
            sock.disconnect();
            socketRef.current = null;
            clearInterval(heartbeatRef.current);
        };
    }, [roomId]);

    // Host heartbeat (every 5s)
    useEffect(() => {
        if (!isHost || !roomId) return;
        heartbeatRef.current = setInterval(() => {
            if (videoRef.current && socketRef.current) {
                socketRef.current.emit('room:heartbeat', {
                    roomCode: roomId,
                    currentTime: videoRef.current.currentTime,
                    paused: videoRef.current.paused,
                });
            }
        }, 5000);
        return () => clearInterval(heartbeatRef.current);
    }, [isHost, roomId]);

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const emitSync = useCallback((action) => {
        if (!roomId || !socketRef.current || isSyncingRef.current) return;
        socketRef.current.emit('room:sync', {
            roomCode: roomId,
            action,
            currentTime: videoRef.current?.currentTime || 0,
        });
    }, [roomId]);

    const startStreamTogether = useCallback(() => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        setRoomId(code);
        setIsHost(true);
    }, []);

    const copyRoomCode = useCallback(() => {
        if (!roomId) return;
        navigator.clipboard.writeText(roomId).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [roomId]);

    const sendChat = useCallback(() => {
        if (!chatInput.trim() || !socketRef.current || !roomId) return;
        socketRef.current.emit('room:chat', { roomCode: roomId, message: chatInput.trim() });
        setChatInput('');
    }, [chatInput, roomId]);

    const sendEmoji = useCallback((emoji) => {
        if (!socketRef.current || !roomId) return;
        socketRef.current.emit('room:reaction', { roomCode: roomId, emoji });
        setShowEmojiPicker(false);
    }, [roomId]);

    // Reset state when direct URL changes
    // Progress Restoration
    useEffect(() => {
        const restoreProgress = async () => {
            if (!imdbId || hasRestoredProgress) return;
            
            const season = movie?.mediaType === 'series' ? (movie.season || parseInt(new URLSearchParams(url.split('?')[1]).get('season'))) : undefined;
            const episode = movie?.mediaType === 'series' ? (movie.episode || parseInt(new URLSearchParams(url.split('?')[1]).get('episode'))) : undefined;
            
            const progress = await getPlaybackProgress(imdbId, season, episode);
            if (progress && progress.currentTime > 10 && (progress.currentTime / progress.duration) < 0.95) {
                if (videoRef.current) {
                    videoRef.current.currentTime = progress.currentTime;
                    lastSavedTimeRef.current = progress.currentTime;
                }
            }
            setHasRestoredProgress(true);
        };
        restoreProgress();
    }, [imdbId, hasRestoredProgress, movie, url]);

    // Periodic Progress Saving
    useEffect(() => {
        if (!playing || !imdbId || !videoRef.current) return;

        const saveInterval = setInterval(() => {
            const v = videoRef.current;
            if (!v) return;

            // Only save if moved significantly (at least 5 seconds)
            if (Math.abs(v.currentTime - lastSavedTimeRef.current) >= 5) {
                updatePlaybackProgress({
                    mediaId: imdbId,
                    title: title || movie?.title,
                    poster: movie?.poster || stream?.poster,
                    mediaType: movie?.mediaType || (url?.includes('series') ? 'series' : 'movie'),
                    currentTime: v.currentTime,
                    duration: v.duration,
                    season: movie?.mediaType === 'series' ? (movie.season || parseInt(new URLSearchParams(url.split('?')[1]).get('season'))) : undefined,
                    episode: movie?.mediaType === 'series' ? (movie.episode || parseInt(new URLSearchParams(url.split('?')[1]).get('episode'))) : undefined
                });
                lastSavedTimeRef.current = v.currentTime;
            }
        }, 5000);

        return () => clearInterval(saveInterval);
    }, [playing, imdbId, title, movie, stream, url]);

    // Save on Unmount
    useEffect(() => {
        return () => {
            if (videoRef.current && imdbId) {
                const v = videoRef.current;
                updatePlaybackProgress({
                    mediaId: imdbId,
                    title: title || movie?.title,
                    poster: movie?.poster || stream?.poster,
                    mediaType: movie?.mediaType || (url?.includes('series') ? 'series' : 'movie'),
                    currentTime: v.currentTime,
                    duration: v.duration,
                    season: movie?.mediaType === 'series' ? (movie.season || parseInt(new URLSearchParams(url.split('?')[1]).get('season'))) : undefined,
                    episode: movie?.mediaType === 'series' ? (movie.episode || parseInt(new URLSearchParams(url.split('?')[1]).get('episode'))) : undefined
                });
            }
        };
    }, [imdbId, title, movie, stream, url]);

    useEffect(() => {
        if (!url) return;
        setError(''); setLoading(true); setPlaying(false); setCurrentTime(0); setDuration(0);
    }, [url]);

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e) => {
            if (!videoRef.current) return;
            resetControlsTimer();
            switch (e.code) {
                case 'Space': case 'KeyK': e.preventDefault(); togglePlay(); break;
                case 'ArrowRight': videoRef.current.currentTime += 10; break;
                case 'ArrowLeft': videoRef.current.currentTime -= 10; break;
                case 'ArrowUp': e.preventDefault(); changeVolume(Math.min(1, volume + 0.1)); break;
                case 'ArrowDown': e.preventDefault(); changeVolume(Math.max(0, volume - 0.1)); break;
                case 'KeyM': toggleMute(); break;
                case 'KeyF': toggleFullscreen(); break;
                case 'Escape': if (!isFullscreen) onClose(); break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [playing, isFullscreen, volume]);

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
        else { v.pause(); setPlaying(false); }
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setMuted(v.muted);
    };

    const changeVolume = (val) => {
        const v = videoRef.current;
        if (v) v.volume = val;
        setVolume(val);
        if (val > 0 && muted) { if (v) v.muted = false; setMuted(false); }
    };

    const toggleFullscreen = async () => {
        const el = containerRef.current;
        if (!el) return;
        if (!document.fullscreenElement) await el.requestFullscreen().catch(() => {});
        else await document.exitFullscreen().catch(() => {});
    };

    const onTimeUpdate = () => {
        const v = videoRef.current;
        if (!v) return;
        setCurrentTime(v.currentTime);
        if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
    };

    const onSeek = (e) => {
        const v = videoRef.current;
        if (!v || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        v.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

    return (
        <div
            onClick={(e) => e.target === e.currentTarget && onClose()}
            style={{
                position: 'fixed', inset: 0, zIndex: 20000,
                background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: isFullscreen ? 0 : 20,
            }}
        >
            <motion.div
                ref={containerRef}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    width: '100%', maxWidth: 1100, background: '#000',
                    borderRadius: isFullscreen ? 0 : 12, overflow: 'hidden',
                    position: 'relative', boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
                    aspectRatio: '16/9',
                }}
                onMouseMove={resetControlsTimer}
                onMouseEnter={() => setShowControls(true)}
            >
                {/* Video element — WebTorrent's renderTo() sets src automatically for torrent streams */}
                <video
                    ref={videoRef}
                    src={url || undefined}
                    style={{ width: '100%', height: '100%', display: 'block', cursor: showControls ? 'default' : 'none' }}
                    onClick={togglePlay}
                    onTimeUpdate={onTimeUpdate}
                    onLoadedMetadata={() => { 
                        setDuration(videoRef.current?.duration || 0); 
                        setLoading(false); 
                        if (initialState) {
                            isSyncingRef.current = true;
                            videoRef.current.currentTime = initialState.currentTime;
                            if (initialState.paused) videoRef.current.pause();
                            else videoRef.current.play().catch(() => {});
                            setTimeout(() => { isSyncingRef.current = false; }, 500);
                            setInitialState(null);
                        } else if (lastSavedTimeRef.current > 0) {
                            videoRef.current.currentTime = lastSavedTimeRef.current;
                        }
                    }}
                    onPlaying={() => { setLoading(false); setPlaying(true); if (isInRoom && !isSyncingRef.current) emitSync('play'); }}
                    onPause={() => { setPlaying(false); if (isInRoom && !isSyncingRef.current) emitSync('pause'); }}
                    onSeeked={() => { if (isInRoom && !isSyncingRef.current) emitSync('seek'); }}
                    onWaiting={() => { setLoading(true); if (isInRoom && socketRef.current) socketRef.current.emit('room:buffer_start', { roomCode: roomId }); }}
                    onCanPlay={() => { setLoading(false); if (isInRoom && socketRef.current) socketRef.current.emit('room:buffer_end', { roomCode: roomId }); }}
                    onEnded={() => { setPlaying(false); setShowControls(true); }}
                    onError={() => { if (!isTorrent) { setError('Failed to load stream. Format may be unsupported or source unavailable.'); setLoading(false); } }}
                    preload="auto"
                />

                {/* Loading */}
                {loading && !error && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', gap: 16,
                        zIndex: 10,
                    }}>
                        <div style={{
                            width: 48, height: 48, border: '3px solid rgba(255,255,255,0.15)',
                            borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                        }} />
                        {torrentInfo && (
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', maxWidth: 360, textAlign: 'center', padding: '0 16px' }}>
                                {torrentInfo}
                            </p>
                        )}
                        {isTorrent && !torrentInfo && (
                            <p style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                Torrent streams can take 30–60 seconds to start
                            </p>
                        )}
                        {isLocalTorrentStream && (
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', maxWidth: 360, textAlign: 'center', padding: '0 16px' }}>
                                Connecting to torrent swarm… can take up to 60 seconds on first load
                            </p>
                        )}
                        {/* External player picker — shown while loading a local torrent stream */}
                        {IS_ELECTRON && isLocalTorrentStream && (
                            <PlayerPicker
                                mediaPlayers={mediaPlayers}
                                savedPlayer={savedPlayer}
                                showPicker={showPlayerPicker}
                                onTogglePicker={() => setShowPlayerPicker(p => !p)}
                                onSelect={openWithPlayer}
                            />
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 24, textAlign: 'center',
                        zIndex: 10,
                    }}>
                        <AlertTriangle size={40} color="#f59e0b" style={{ marginBottom: 16 }} />
                        <p style={{ color: '#fff', fontWeight: 600, marginBottom: 8 }}>Playback Error</p>
                        <p style={{ color: '#94a3b8', fontSize: '0.83rem', maxWidth: 420, lineHeight: 1.6, marginBottom: 20 }}>{error}</p>
                        {IS_ELECTRON && isLocalTorrentStream && (
                            <PlayerPicker
                                mediaPlayers={mediaPlayers}
                                savedPlayer={savedPlayer}
                                showPicker={showPlayerPicker}
                                onTogglePicker={() => setShowPlayerPicker(p => !p)}
                                onSelect={openWithPlayer}
                            />
                        )}
                    </div>
                )}

                {/* Controls overlay */}
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between', opacity: showControls ? 1 : 0,
                    transition: 'opacity 0.3s', pointerEvents: showControls ? 'auto' : 'none',
                }}>
                    <div style={{
                        padding: '16px 20px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                            {title}
                        </p>
                        <button onClick={onClose} style={iconBtnStyle}>
                            <X size={16} />
                        </button>
                    </div>

                    <div style={{ flex: 1 }} onClick={togglePlay} />

                    <div style={{ padding: '8px 16px 14px', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
                        <div onClick={onSeek} style={{
                            width: '100%', height: 4, background: 'rgba(255,255,255,0.2)',
                            borderRadius: 2, cursor: 'pointer', marginBottom: 10, position: 'relative', overflow: 'hidden',
                        }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${bufferedPct}%`, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progress}%`, background: '#a855f7', borderRadius: 2 }} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }} style={iconBtnStyle}><SkipBack size={16} /></button>
                            <button onClick={togglePlay} style={{ ...iconBtnStyle, width: 38, height: 38 }}>
                                {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                            </button>
                            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }} style={iconBtnStyle}><SkipForward size={16} /></button>
                            <span style={{ color: '#fff', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                                {fmt(currentTime)} / {fmt(duration)}
                            </span>
                            <div style={{ flex: 1 }} />
                            <button onClick={toggleMute} style={iconBtnStyle}>
                                {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </button>
                            <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                                onChange={e => changeVolume(parseFloat(e.target.value))}
                                style={{ width: 72, accentColor: '#a855f7', cursor: 'pointer' }} />

                            <div style={{ position: 'relative' }}>
                                <button 
                                    onClick={() => setShowSubMenu(!showSubMenu)} 
                                    style={{ ...iconBtnStyle, color: activeSub ? 'var(--accent)' : '#fff' }}
                                    title="Subtitles"
                                >
                                    <Subtitles size={16} />
                                </button>

                                {showSubMenu && (
                                    <div style={{
                                        position: 'absolute', bottom: '100%', right: 0, marginBottom: 10,
                                        background: 'rgba(11,9,28,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 8, padding: 8, minWidth: 160, maxHeight: 300, overflowY: 'auto',
                                        zIndex: 30000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                    }}>
                                        <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subtitles</p>
                                        <button 
                                            onClick={() => { setActiveSub(null); setShowSubMenu(false); }}
                                            style={{ ...subItemStyle, color: !activeSub ? 'var(--accent)' : 'inherit' }}
                                        >
                                            None
                                        </button>
                                        {subtitles.map((sub, i) => (
                                            <button 
                                                key={i}
                                                onClick={() => { setActiveSub(sub); setShowSubMenu(false); }}
                                                style={{ ...subItemStyle, color: activeSub === sub ? 'var(--accent)' : 'inherit' }}
                                            >
                                                {sub.lang || sub.id || 'Track'} <span style={{ opacity: 0.4, fontSize: '0.65rem' }}>({sub.addonName || 'Addon'})</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Stream Together Button */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={isInRoom ? () => setShowChat(!showChat) : startStreamTogether}
                                    style={{ ...iconBtnStyle, color: isInRoom ? '#a855f7' : '#fff', position: 'relative' }}
                                    title={isInRoom ? 'Toggle Chat' : 'Stream Together'}
                                >
                                    {isInRoom ? <MessageCircle size={16} /> : <Users size={16} />}
                                    {isInRoom && roomMembers.length > 0 && (
                                        <span style={{ position: 'absolute', top: -4, right: -4, background: '#a855f7', borderRadius: '50%', width: 14, height: 14, fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                                            {roomMembers.length}
                                        </span>
                                    )}
                                </button>

                                {/* Room Code banner */}
                                {isInRoom && showRoomPanel && (
                                    <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 8, background: 'rgba(11,9,28,0.97)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 10, padding: 12, minWidth: 200, zIndex: 30000 }}>
                                        <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room Code</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: '#a855f7', letterSpacing: 4 }}>{roomId}</span>
                                            <button onClick={copyRoomCode} style={{ ...iconBtnStyle, width: 26, height: 26 }}>
                                                {copied ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Share this code with friends to watch together</p>
                                    </div>
                                )}
                                {isInRoom && (
                                    <button onClick={() => setShowRoomPanel(!showRoomPanel)} style={{ position: 'absolute', bottom: '100%', left: -60, marginBottom: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                                        👥 {roomMembers.length} watching
                                    </button>
                                )}
                            </div>

                            <button onClick={toggleFullscreen} style={iconBtnStyle}>
                                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stream Together Chat Panel */}
            {isInRoom && showChat && (
                <div style={{
                    position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
                    width: 280, height: 420, background: 'rgba(11,9,28,0.95)',
                    border: '1px solid rgba(168,85,247,0.25)', borderRadius: 16,
                    display: 'flex', flexDirection: 'column', zIndex: 99999,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
                }}>
                    {/* Chat Header */}
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: 700 }}>🎬 Stream Together</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={copyRoomCode} style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 6, padding: '2px 8px', color: '#a855f7', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {copied ? <Check size={10} /> : <Copy size={10} />} {roomId}
                            </button>
                            <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>✕</button>
                        </div>
                    </div>

                    {/* Watchers */}
                    <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {roomMembers.map((m, i) => (
                            <span key={i} style={{ fontSize: '0.65rem', color: m.isHost ? '#a855f7' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                {m.isHost ? '👑' : '👤'} {m.username} {m.isBuffering ? '⏳' : ''}
                            </span>
                        ))}
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {chatMessages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                {msg.isReaction
                                    ? <span style={{ fontSize: '1.4rem', alignSelf: 'center' }}>{msg.message}</span>
                                    : <>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a855f7', flexShrink: 0 }}>{msg.username}:</span>
                                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>{msg.message}</span>
                                    </>
                                }
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                        <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {EMOJIS.map(e => (
                                <button key={e} onClick={() => sendEmoji(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 2 }}>{e}</button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                            <Smile size={16} />
                        </button>
                        <input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendChat()}
                            placeholder="Say something..."
                            style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: '0.78rem', outline: 'none' }}
                        />
                        <button onClick={sendChat} style={{ ...iconBtnStyle, background: '#a855f7', flexShrink: 0 }}>
                            <Send size={13} />
                        </button>
                    </div>
                </div>
            )}

            {!isFullscreen && (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.73rem', marginTop: 10, textAlign: 'center' }}>
                    Space/K: play · ←/→: seek 10s · ↑/↓: volume · M: mute · F: fullscreen
                </p>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

const iconBtnStyle = {
    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
    width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

const subItemStyle = {
    width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#fff',
    padding: '8px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    transition: 'background 0.2s',
};

export default VideoPlayerModal;
