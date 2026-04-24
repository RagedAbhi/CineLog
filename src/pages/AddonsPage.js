import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Download, CheckCircle, AlertTriangle, ExternalLink, Puzzle, X } from 'lucide-react';
import { getInstalledAddons, installAddon, uninstallAddon } from '../services/addonService';

const QUALITY_BADGE = {
    '4K': { bg: '#7c3aed', label: '4K' },
    '1080p': { bg: '#2563eb', label: 'HD' },
    '720p': { bg: '#059669', label: '720p' },
};

const AddonCard = ({ addon, installed, onInstall, onUninstall, loading }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
            background: 'var(--bg-card)',
            border: `1px solid ${installed ? 'rgba(168,85,247,0.4)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start',
            backdropFilter: 'blur(12px)',
            transition: 'border-color 0.3s',
        }}
    >
        {/* Logo */}
        <div style={{
            width: 52, height: 52, borderRadius: 10,
            background: 'rgba(168,85,247,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden',
        }}>
            {addon.logo ? (
                <img
                    src={addon.logo}
                    alt={addon.name}
                    onError={e => { e.target.style.display = 'none'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }}
                />
            ) : (
                <Puzzle size={24} color="var(--accent)" />
            )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--foreground)' }}>{addon.name}</span>
                {installed && (
                    <span style={{
                        fontSize: '0.7rem', padding: '2px 8px',
                        background: 'rgba(168,85,247,0.15)', color: 'var(--accent)',
                        borderRadius: 999, border: '1px solid rgba(168,85,247,0.3)',
                    }}>Installed</span>
                )}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginTop: 4, lineHeight: 1.5 }}>
                {addon.description}
            </p>
            {addon.baseUrl && (
                <a
                    href={`${addon.baseUrl}/manifest.json`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}
                >
                    <ExternalLink size={11} /> View Manifest
                </a>
            )}
        </div>

        {/* Action */}
        <div style={{ flexShrink: 0 }}>
            {installed ? (
                <button
                    onClick={() => onUninstall(addon.id)}
                    disabled={loading}
                    style={{
                        padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
                        background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                        cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.82rem',
                        display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1,
                    }}
                >
                    <Trash2 size={14} /> Uninstall
                </button>
            ) : (
                <button
                    onClick={() => onInstall(addon)}
                    disabled={loading}
                    style={{
                        padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(168,85,247,0.4)',
                        background: 'rgba(168,85,247,0.1)', color: 'var(--accent)',
                        cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.82rem',
                        display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1,
                    }}
                >
                    <Download size={14} /> Install
                </button>
            )}
        </div>
    </motion.div>
);

const AddonsPage = () => {
    const [featuredAddons, setFeaturedAddons] = useState([]);
    const [installedAddons, setInstalledAddons] = useState([]);
    const [customUrl, setCustomUrl] = useState('');
    const [loadingId, setLoadingId] = useState(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showDisclaimer, setShowDisclaimer] = useState(false);
    const [pendingInstall, setPendingInstall] = useState(null); // addon object waiting for disclaimer accept

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setPageLoading(true);
        try {
            const data = await getInstalledAddons();
            setFeaturedAddons(data.featuredAddons || []);
            setInstalledAddons(data.installedAddons || []);
        } catch (e) {
            setError('Failed to load addons');
        } finally {
            setPageLoading(false);
        }
    };

    const flash = (msg, isError = false) => {
        if (isError) setError(msg);
        else setSuccessMsg(msg);
        setTimeout(() => { setError(''); setSuccessMsg(''); }, 4000);
    };

    const doInstall = async (addon) => {
        const manifestUrl = addon.manifestUrl || `${addon.baseUrl}/manifest.json`;
        setLoadingId(addon.id || manifestUrl);
        setError('');
        try {
            const result = await installAddon(manifestUrl);
            setInstalledAddons(prev => {
                const exists = prev.find(a => a.id === result.addon.id);
                if (exists) return prev.map(a => a.id === result.addon.id ? result.addon : a);
                return [...prev, result.addon];
            });
            flash(`${result.addon.name} installed successfully!`);
            setCustomUrl('');
        } catch (e) {
            flash(e.response?.data?.error || 'Failed to install addon', true);
        } finally {
            setLoadingId(null);
            setPendingInstall(null);
        }
    };

    const handleInstallClick = (addon) => {
        setPendingInstall(addon);
        setShowDisclaimer(true);
    };

    const handleCustomInstall = () => {
        if (!customUrl.trim()) return;
        const url = customUrl.trim();
        const manifestUrl = url.endsWith('/manifest.json') ? url : `${url}/manifest.json`;
        handleInstallClick({ id: manifestUrl, name: 'Custom Addon', baseUrl: url, manifestUrl });
    };

    const handleUninstall = async (addonId) => {
        setLoadingId(addonId);
        try {
            await uninstallAddon(addonId);
            setInstalledAddons(prev => prev.filter(a => a.id !== addonId));
            flash('Addon uninstalled');
        } catch (e) {
            flash('Failed to uninstall addon', true);
        } finally {
            setLoadingId(null);
        }
    };

    const isInstalled = (addonId) => installedAddons.some(a => a.id === addonId);

    const allFeaturedIds = new Set(featuredAddons.map(a => a.id));
    const userCustomAddons = installedAddons.filter(a => !allFeaturedIds.has(a.id));

    return (
        <div style={{ minHeight: '100vh', padding: '40px 24px', maxWidth: 800, margin: '0 auto' }}>
            <Helmet>
                <title>Addons | Cuerates</title>
            </Helmet>

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
                <h1 style={{
                    fontSize: '2rem', fontWeight: 700,
                    background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    marginBottom: 8,
                }}>
                    Addons
                </h1>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    Install Stremio-compatible addons to stream movies and TV shows directly in Cuerates.
                    Cuerates does not provide or host any content — all streams come from third-party addons you choose.
                </p>
            </motion.div>

            {/* Status messages */}
            <AnimatePresence>
                {successMsg && (
                    <motion.div key="success" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{
                            padding: '12px 16px', borderRadius: 10, marginBottom: 16,
                            background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.3)',
                            color: '#10b981', display: 'flex', alignItems: 'center', gap: 10,
                        }}
                    >
                        <CheckCircle size={16} /> {successMsg}
                    </motion.div>
                )}
                {error && (
                    <motion.div key="error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{
                            padding: '12px 16px', borderRadius: 10, marginBottom: 16,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444', display: 'flex', alignItems: 'center', gap: 10,
                        }}
                    >
                        <AlertTriangle size={16} /> {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Custom URL installer */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: 32,
                    backdropFilter: 'blur(12px)',
                }}
            >
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>
                    Install a Custom Addon
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <input
                        type="url"
                        placeholder="Paste Stremio addon URL (e.g. https://torrentio.strem.fun)"
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCustomInstall()}
                        style={{
                            flex: 1, padding: '10px 14px', borderRadius: 8,
                            background: 'var(--input)', border: '1px solid var(--border)',
                            color: 'var(--foreground)', fontSize: '0.85rem', outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleCustomInstall}
                        disabled={!customUrl.trim() || !!loadingId}
                        style={{
                            padding: '10px 18px', borderRadius: 8, border: 'none',
                            background: 'var(--accent-gradient)', color: '#fff',
                            cursor: (!customUrl.trim() || !!loadingId) ? 'not-allowed' : 'pointer',
                            fontWeight: 600, fontSize: '0.85rem', opacity: (!customUrl.trim() || !!loadingId) ? 0.5 : 1,
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        <Plus size={16} /> Install
                    </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 8 }}>
                    Accepts any Stremio-compatible manifest URL. The manifest is fetched and validated automatically.
                </p>
            </motion.div>

            {/* Featured Addons */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: 14 }}>
                    Featured Addons
                </h2>
                {pageLoading ? (
                    <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 32 }}>Loading...</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {featuredAddons.map(addon => (
                            <AddonCard
                                key={addon.id}
                                addon={addon}
                                installed={isInstalled(addon.id)}
                                onInstall={handleInstallClick}
                                onUninstall={handleUninstall}
                                loading={loadingId === addon.id}
                            />
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Installed Addons (non-featured) */}
            {userCustomAddons.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: 14 }}>
                        Your Custom Addons
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {userCustomAddons.map(addon => (
                            <AddonCard
                                key={addon.id}
                                addon={addon}
                                installed={true}
                                onInstall={handleInstallClick}
                                onUninstall={handleUninstall}
                                loading={loadingId === addon.id}
                            />
                        ))}
                    </div>
                </motion.div>
            )}

            {installedAddons.length === 0 && !pageLoading && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{
                        textAlign: 'center', padding: '32px 24px',
                        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                        border: '1px dashed var(--border)', color: 'var(--muted-foreground)',
                    }}
                >
                    <Puzzle size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <p style={{ fontWeight: 500 }}>No addons installed yet</p>
                    <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Install a featured addon above to start streaming.</p>
                </motion.div>
            )}

            {/* Disclaimer Modal */}
            <AnimatePresence>
                {showDisclaimer && pendingInstall && (
                    <div
                        onClick={() => { setShowDisclaimer(false); setPendingInstall(null); }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 10000,
                            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 24,
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#0e0c1e', border: '1px solid rgba(168,85,247,0.3)',
                                borderRadius: 16, padding: 32, maxWidth: 480, width: '100%',
                                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <AlertTriangle size={28} color="#f59e0b" />
                                <button onClick={() => { setShowDisclaimer(false); setPendingInstall(null); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>
                                Third-Party Addon Disclaimer
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.7, marginBottom: 20 }}>
                                <strong style={{ color: 'var(--foreground)' }}>{pendingInstall.name}</strong> is a third-party addon
                                and is not affiliated with, endorsed by, or operated by Cuerates or Anthropic.
                                <br /><br />
                                By installing this addon, you accept <strong>full responsibility</strong> for the content it provides
                                and any actions you take with that content. Cuerates does not host, index, or distribute any media.
                                <br /><br />
                                Ensure you comply with the laws of your country before using third-party streaming addons.
                            </p>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    onClick={() => { setShowDisclaimer(false); setPendingInstall(null); }}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: 8,
                                        border: '1px solid var(--border)', background: 'transparent',
                                        color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: '0.85rem',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { setShowDisclaimer(false); doInstall(pendingInstall); }}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                                        background: 'var(--accent-gradient)', color: '#fff',
                                        cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                                    }}
                                >
                                    I Understand, Install
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AddonsPage;
