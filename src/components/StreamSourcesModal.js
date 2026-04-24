import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Puzzle, AlertTriangle, Play, Loader2, ExternalLink } from 'lucide-react';
import { fetchStreams, parseStreamQuality, parseSeeders, buildTorrentStreamUrl } from '../services/addonService';
import { useNavigate } from 'react-router-dom';

const QUALITY_COLORS = {
    '4K': { bg: 'rgba(124,58,237,0.2)', border: 'rgba(124,58,237,0.5)', color: '#c4b5fd' },
    '1080p': { bg: 'rgba(37,99,235,0.2)', border: 'rgba(37,99,235,0.5)', color: '#93c5fd' },
    '720p': { bg: 'rgba(5,150,105,0.2)', border: 'rgba(5,150,105,0.5)', color: '#6ee7b7' },
    '480p': { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', color: '#fcd34d' },
    'Unknown': { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)', color: '#94a3b8' },
};

const QualityBadge = ({ quality }) => {
    const style = QUALITY_COLORS[quality] || QUALITY_COLORS['Unknown'];
    return (
        <span style={{
            fontSize: '0.68rem', padding: '2px 7px', borderRadius: 999, fontWeight: 700,
            background: style.bg, border: `1px solid ${style.border}`, color: style.color,
        }}>
            {quality}
        </span>
    );
};

const isMagnetOrHash = (stream) =>
    (stream.url && (stream.url.startsWith('magnet:') || stream.url.startsWith('magnet%3A'))) ||
    !!stream.infoHash;

const resolveStreamUrl = (stream) => {
    if (isMagnetOrHash(stream)) {
        const magnet = stream.url?.startsWith('magnet:') ? stream.url : null;
        return buildTorrentStreamUrl({
            magnet,
            infoHash: stream.infoHash || null,
            fileIdx: stream.fileIdx ?? null,
        });
    }
    return stream.url || null;
};

const StreamSourcesModal = ({ movie, onClose, onWatch }) => {
    const [streams, setStreams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [noAddons, setNoAddons] = useState(false);
    const [season, setSeason] = useState(1);
    const [episode, setEpisode] = useState(1);
    const [installedCount, setInstalledCount] = useState(0);
    const [resolvedImdbId, setResolvedImdbId] = useState('');
    const navigate = useNavigate();

    const isSeries = movie?.mediaType === 'series';

    useEffect(() => {
        if (movie) {
            setResolvedImdbId(''); // Reset ID to prevent 'leaks' from previous movies
            loadStreams();
        }
    }, [movie, season, episode]);

    const loadStreams = async () => {
        setLoading(true);
        setError('');
        setStreams([]);
        try {
            // ROBUST ID EXTRACTION: Look in every possible field
            const rawImdb = movie.imdbID || movie.imdb_id;
            const rawTmdb = movie.tmdbId || movie.tmdb_id || (typeof movie.id === 'number' || /^\d+$/.test(movie.id) ? movie.id : null);

            let idToUse = rawImdb;
            // If imdbID is a number, treat it as a TMDB ID
            if (idToUse && !String(idToUse).startsWith('tt')) {
                idToUse = null; 
            }

            const data = await fetchStreams({
                imdbId: idToUse,
                tmdbId: rawTmdb,
                type: isSeries ? 'series' : 'movie',
                season: isSeries ? season : undefined,
                episode: isSeries ? episode : undefined,
            });
            
            if (data.noAddons) {
                setNoAddons(true);
            } else {
                setNoAddons(false);
                setStreams(data.streams || []);
                setResolvedImdbId(data.imdbId || '');
                if (data.addons) setInstalledCount(data.addons.length);
            }
        } catch (e) {
            const msg = e.response?.data?.error || e.message || 'Failed to fetch streams';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Group streams by addon
    const grouped = streams.reduce((acc, stream) => {
        const key = stream.addonName || 'Unknown Addon';
        if (!acc[key]) acc[key] = [];
        acc[key].push(stream);
        return acc;
    }, {});

    const handleWatch = (stream) => {
        const url = resolveStreamUrl(stream);
        if (!url) return;
        onWatch(url, movie.title, stream);
    };

    return (
        <div
            onClick={(e) => e.target === e.currentTarget && onClose()}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24,
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                style={{
                    background: '#0b091c',
                    border: '1px solid rgba(168,85,247,0.25)',
                    borderRadius: 18,
                    width: '100%',
                    maxWidth: 620,
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 40px rgba(168,85,247,0.1)',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0,
                }}>
                    <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, marginBottom: 2 }}>
                            STREAM SOURCES
                        </p>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)' }}>
                            {movie?.title}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
                            width: 36, height: 36, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Season/Episode picker for series */}
                {isSeries && (
                    <div style={{
                        padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0,
                    }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>Season</label>
                        <input
                            type="number" min={1} value={season}
                            onChange={e => setSeason(Number(e.target.value))}
                            style={{
                                width: 60, padding: '5px 8px', borderRadius: 6,
                                background: 'var(--input)', border: '1px solid var(--border)',
                                color: 'var(--foreground)', fontSize: '0.85rem',
                            }}
                        />
                        <label style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>Episode</label>
                        <input
                            type="number" min={1} value={episode}
                            onChange={e => setEpisode(Number(e.target.value))}
                            style={{
                                width: 60, padding: '5px 8px', borderRadius: 6,
                                background: 'var(--input)', border: '1px solid var(--border)',
                                color: 'var(--foreground)', fontSize: '0.85rem',
                            }}
                        />
                        <button
                            onClick={loadStreams}
                            style={{
                                padding: '5px 14px', borderRadius: 6,
                                background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
                                color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8rem',
                            }}
                        >
                            Load
                        </button>
                    </div>
                )}

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

                    {/* No addons installed */}
                    {noAddons && (
                        <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--muted-foreground)' }}>
                            <Puzzle size={40} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
                            <p style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: 8 }}>No Addons Installed</p>
                            <p style={{ fontSize: '0.83rem', marginBottom: 20 }}>
                                Install Stremio addons to get stream sources for this title.
                            </p>
                            <button
                                onClick={() => { onClose(); navigate('/addons'); }}
                                style={{
                                    padding: '10px 20px', borderRadius: 8, border: 'none',
                                    background: 'var(--accent-gradient)', color: '#fff',
                                    cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                                }}
                            >
                                Go to Addons
                            </button>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && !noAddons && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            gap: 16, padding: '48px 0', color: 'var(--muted-foreground)',
                        }}>
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                            <p style={{ fontSize: '0.85rem' }}>Fetching streams from your addons...</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && !loading && (
                        <div style={{
                            padding: '16px', borderRadius: 10, marginBottom: 16,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                            color: '#ef4444', fontSize: '0.85rem', display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}>
                            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* No results */}
                    {!loading && !error && !noAddons && streams.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted-foreground)' }}>
                            <p style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>No Streams Found</p>
                            <p style={{ fontSize: '0.82rem' }}>Your addons returned no streams for this title.</p>
                        </div>
                    )}

                    {/* Streams grouped by addon */}
                    {!loading && !noAddons && Object.entries(grouped).map(([addonName, addonStreams]) => (
                        <div key={addonName} style={{ marginBottom: 24 }}>
                            <p style={{
                                fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
                                color: 'var(--muted-foreground)', marginBottom: 10, textTransform: 'uppercase',
                            }}>
                                {addonName}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {addonStreams.map((stream, idx) => {
                                    const quality = parseStreamQuality(stream);
                                    const seeders = parseSeeders(stream);
                                    const isTorrent = isMagnetOrHash(stream);
                                    const title = stream.title || stream.name || 'Stream';
                                    const cleanTitle = title.split('\n').filter(Boolean).slice(0, 2).join(' · ');

                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.07)',
                                                borderRadius: 10, padding: '12px 14px',
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                transition: 'border-color 0.2s, background 0.2s',
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.borderColor = 'rgba(168,85,247,0.35)';
                                                e.currentTarget.style.background = 'rgba(168,85,247,0.05)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                            }}
                                        >
                                            {/* Quality badge */}
                                            <div style={{ flexShrink: 0 }}>
                                                <QualityBadge quality={quality} />
                                            </div>

                                            {/* Stream info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontSize: '0.82rem', color: 'var(--foreground)',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>
                                                    {cleanTitle}
                                                </p>
                                                <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                                                    {isTorrent && (
                                                        <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>
                                                            ⚡ Torrent
                                                        </span>
                                                    )}
                                                    {seeders !== null && (
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                                                            👤 {seeders.toLocaleString()} seeders
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Watch button */}
                                            <button
                                                onClick={() => handleWatch(stream)}
                                                style={{
                                                    padding: '7px 14px', borderRadius: 8, border: 'none',
                                                    background: 'rgba(168,85,247,0.15)', color: 'var(--accent)',
                                                    cursor: 'pointer', flexShrink: 0, fontWeight: 600,
                                                    fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5,
                                                    transition: 'background 0.2s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,85,247,0.3)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(168,85,247,0.15)'}
                                            >
                                                <Play size={13} fill="currentColor" /> Watch
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer disclaimer */}
                <div style={{
                    padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.06)',
                    flexShrink: 0,
                }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                        Streams are provided by third-party addons. CineLog does not host or distribute content.
                        Torrent streams are proxied through the local server for playback.
                    </p>
                    {/* Debug Info */}
                    <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
                        Debug: SearchID: {resolvedImdbId || 'Pending...'} | Installed: {installedCount} | Results: {streams.length}
                    </p>
                </div>
            </motion.div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default StreamSourcesModal;
