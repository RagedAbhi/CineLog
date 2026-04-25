import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipForward, SkipBack, AlertTriangle, Loader2 } from 'lucide-react';

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

const VideoPlayerModal = ({ url, stream, title, onClose }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const wtClientRef = useRef(null);
    const controlsTimer = useRef(null);

    const isTorrent = !url && stream && (stream.infoHash || stream.url?.startsWith('magnet:'));

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

    // Reset state when direct URL changes
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
                    onLoadedMetadata={() => { setDuration(videoRef.current?.duration || 0); setLoading(false); }}
                    onCanPlay={() => setLoading(false)}
                    onWaiting={() => setLoading(true)}
                    onPlaying={() => { setLoading(false); setPlaying(true); }}
                    onPause={() => setPlaying(false)}
                    onEnded={() => { setPlaying(false); setShowControls(true); }}
                    onError={() => {
                        if (!isTorrent) {
                            setError('Failed to load stream. Format may be unsupported or source unavailable.');
                            setLoading(false);
                        }
                    }}
                    preload="auto"
                    crossOrigin="anonymous"
                />

                {/* Loading */}
                {loading && !error && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', gap: 16,
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
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 24, textAlign: 'center',
                    }}>
                        <AlertTriangle size={40} color="#f59e0b" style={{ marginBottom: 16 }} />
                        <p style={{ color: '#fff', fontWeight: 600, marginBottom: 8 }}>Playback Error</p>
                        <p style={{ color: '#94a3b8', fontSize: '0.83rem', maxWidth: 420, lineHeight: 1.6 }}>{error}</p>
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
                            <button onClick={toggleFullscreen} style={iconBtnStyle}>
                                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

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

export default VideoPlayerModal;
