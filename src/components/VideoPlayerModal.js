import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
    SkipForward, SkipBack, AlertTriangle,
} from 'lucide-react';

const fmt = (secs) => {
    if (!isFinite(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
};

const VideoPlayerModal = ({ url, title, onClose }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const controlsTimer = useRef(null);

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

    // Show controls momentarily, then hide
    const resetControlsTimer = useCallback(() => {
        setShowControls(true);
        clearTimeout(controlsTimer.current);
        controlsTimer.current = setTimeout(() => {
            if (playing) setShowControls(false);
        }, 3000);
    }, [playing]);

    useEffect(() => {
        resetControlsTimer();
        return () => clearTimeout(controlsTimer.current);
    }, [playing]);

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e) => {
            if (!videoRef.current) return;
            resetControlsTimer();
            switch (e.code) {
                case 'Space': case 'KeyK': e.preventDefault(); togglePlay(); break;
                case 'ArrowRight': videoRef.current.currentTime += 10; break;
                case 'ArrowLeft': videoRef.current.currentTime -= 10; break;
                case 'ArrowUp': e.preventDefault(); setVolume(v => { const nv = Math.min(1, v + 0.1); videoRef.current.volume = nv; return nv; }); break;
                case 'ArrowDown': e.preventDefault(); setVolume(v => { const nv = Math.max(0, v - 0.1); videoRef.current.volume = nv; return nv; }); break;
                case 'KeyM': toggleMute(); break;
                case 'KeyF': toggleFullscreen(); break;
                case 'Escape': if (!isFullscreen) onClose(); break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [playing, isFullscreen, onClose]);

    // Fullscreen change listener
    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    // Load new URL
    useEffect(() => {
        setError('');
        setLoading(true);
        setPlaying(false);
        setCurrentTime(0);
        setDuration(0);
    }, [url]);

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

    const toggleFullscreen = async () => {
        const el = containerRef.current;
        if (!el) return;
        if (!document.fullscreenElement) {
            await el.requestFullscreen().catch(() => {});
        } else {
            await document.exitFullscreen().catch(() => {});
        }
    };

    const onTimeUpdate = () => {
        const v = videoRef.current;
        if (!v) return;
        setCurrentTime(v.currentTime);
        if (v.buffered.length > 0) {
            setBuffered(v.buffered.end(v.buffered.length - 1));
        }
    };

    const onSeek = (e) => {
        const v = videoRef.current;
        if (!v || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        v.currentTime = ratio * duration;
    };

    const onVolumeChange = (e) => {
        const v = videoRef.current;
        const val = parseFloat(e.target.value);
        if (v) v.volume = val;
        setVolume(val);
        if (val > 0 && muted) { if (v) v.muted = false; setMuted(false); }
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
                    width: '100%', maxWidth: 1100,
                    background: '#000', borderRadius: isFullscreen ? 0 : 12,
                    overflow: 'hidden', position: 'relative',
                    boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
                    aspectRatio: '16/9',
                }}
                onMouseMove={resetControlsTimer}
                onMouseEnter={() => setShowControls(true)}
            >
                {/* Video element */}
                <video
                    ref={videoRef}
                    src={url}
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
                        setError('Failed to load this stream. The format may be unsupported or the source is unavailable.');
                        setLoading(false);
                    }}
                    volume={volume}
                    preload="auto"
                    crossOrigin="anonymous"
                />

                {/* Loading spinner */}
                {loading && !error && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.4)',
                    }}>
                        <div style={{
                            width: 48, height: 48, border: '3px solid rgba(255,255,255,0.15)',
                            borderTopColor: '#a855f7', borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                    </div>
                )}

                {/* Error overlay */}
                {error && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.85)', padding: 24, textAlign: 'center',
                    }}>
                        <AlertTriangle size={40} color="#f59e0b" style={{ marginBottom: 16 }} />
                        <p style={{ color: '#fff', fontWeight: 600, marginBottom: 8 }}>Playback Error</p>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: 400, lineHeight: 1.6 }}>{error}</p>
                        <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 12 }}>
                            MKV files may not play in all browsers. Try a different stream source.
                        </p>
                    </div>
                )}

                {/* Controls overlay */}
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between',
                    opacity: showControls ? 1 : 0,
                    transition: 'opacity 0.3s',
                    pointerEvents: showControls ? 'auto' : 'none',
                }}>
                    {/* Top bar */}
                    <div style={{
                        padding: '16px 20px',
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                            {title}
                        </p>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                                width: 34, height: 34, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', backdropFilter: 'blur(4px)',
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Center play indicator */}
                    <div style={{ flex: 1 }} onClick={togglePlay} />

                    {/* Bottom controls */}
                    <div style={{
                        padding: '8px 16px 14px',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                    }}>
                        {/* Progress bar */}
                        <div
                            onClick={onSeek}
                            style={{
                                width: '100%', height: 4, background: 'rgba(255,255,255,0.2)',
                                borderRadius: 2, cursor: 'pointer', marginBottom: 10,
                                position: 'relative', overflow: 'hidden',
                            }}
                        >
                            {/* Buffered */}
                            <div style={{
                                position: 'absolute', left: 0, top: 0, height: '100%',
                                width: `${bufferedPct}%`, background: 'rgba(255,255,255,0.3)',
                                borderRadius: 2, transition: 'width 0.3s',
                            }} />
                            {/* Played */}
                            <div style={{
                                position: 'absolute', left: 0, top: 0, height: '100%',
                                width: `${progress}%`, background: '#a855f7',
                                borderRadius: 2,
                            }} />
                        </div>

                        {/* Control row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* Skip back 10s */}
                            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }} style={btnStyle}>
                                <SkipBack size={16} />
                            </button>

                            {/* Play/Pause */}
                            <button onClick={togglePlay} style={{ ...btnStyle, width: 38, height: 38 }}>
                                {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                            </button>

                            {/* Skip forward 10s */}
                            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }} style={btnStyle}>
                                <SkipForward size={16} />
                            </button>

                            {/* Time */}
                            <span style={{ color: '#fff', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                                {fmt(currentTime)} / {fmt(duration)}
                            </span>

                            <div style={{ flex: 1 }} />

                            {/* Volume */}
                            <button onClick={toggleMute} style={btnStyle}>
                                {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </button>
                            <input
                                type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                                onChange={onVolumeChange}
                                style={{ width: 72, accentColor: '#a855f7', cursor: 'pointer' }}
                            />

                            {/* Fullscreen */}
                            <button onClick={toggleFullscreen} style={btnStyle}>
                                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Title below player (outside fullscreen) */}
            {!isFullscreen && (
                <p style={{
                    color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: 12,
                    textAlign: 'center',
                }}>
                    Space/K: play · ←/→: seek 10s · ↑/↓: volume · M: mute · F: fullscreen
                </p>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

const btnStyle = {
    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
    width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
};

export default VideoPlayerModal;
