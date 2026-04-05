import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Clock, User, Trash2 } from 'lucide-react';
import { clearRecentActivity } from '../store/thunks';
import './SocialPulse.css';

const SocialPulse = () => {
    const recommendations = useSelector(state => state.auth.recommendations) || [];
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [showAll, setShowAll] = React.useState(false);
    const limit = 3;

    const handleClearAll = () => {
        if (window.confirm('Clear all recent activity?')) {
            dispatch(clearRecentActivity());
        }
    };

    const formatTime = (date) => {
        const diff = Date.now() - new Date(date).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    if (recommendations.length === 0) {
        return (
            <div className="social-pulse-empty">
                <MessageSquare size={24} />
                <p>No recent friend activity</p>
            </div>
        );
    }

    const groupedRecs = React.useMemo(() => {
        const grouped = {};
        recommendations.forEach(rec => {
            const key = `${rec.mediaTitle?.toLowerCase().trim()}-${rec.mediaType}`;
            if (!grouped[key]) {
                grouped[key] = { ...rec, allSenders: [rec.sender], count: 1 };
            } else {
                grouped[key].count += 1;
                const senderId = (rec.sender?._id || rec.sender)?.toString();
                if (!grouped[key].allSenders.some(s => (s?._id || s)?.toString() === senderId)) {
                    grouped[key].allSenders.push(rec.sender);
                }
                // Keep the most recent timestamp
                if (new Date(rec.createdAt) > new Date(grouped[key].createdAt)) {
                    grouped[key].createdAt = rec.createdAt;
                }
            }
        });
        return Object.values(grouped).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [recommendations]);

    const displayedRecs = showAll ? groupedRecs : groupedRecs.slice(0, limit);

    return (
        <div className="social-pulse-container glass-panel">
            <div className="pulse-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="status-pulse-dot"></div>
                    <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', color: 'var(--accent)' }}>LIVE FEED</span>
                </div>
                <button 
                    className="btn-clear-pulse" 
                    onClick={handleClearAll}
                    title="Clear all activity"
                    style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'rgba(255, 255, 255, 0.3)', 
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Trash2 size={14} />
                </button>
            </div>
            <div className="pulse-list">
                {displayedRecs.map((rec) => (
                    <div 
                        key={rec._id} 
                        className="pulse-item"
                        onClick={() => navigate(`/movies/${rec.imdbID}?external=true&type=${rec.mediaType || 'movie'}`)}
                    >
                        <div className="pulse-avatar">
                            {rec.allSenders[0]?.profilePicture ? (
                                <img src={rec.allSenders[0].profilePicture} alt="" />
                            ) : (
                                <User size={14} />
                            )}
                        </div>
                        <div className="pulse-info">
                            <p className="pulse-text">
                                <strong>{rec.allSenders[0]?.name || rec.allSenders[0]?.username || 'Unknown'}</strong>
                                {rec.allSenders.length > 1 ? (
                                    <span 
                                        className="others-trigger"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {` and ${rec.allSenders.length - 1} others`}
                                        <span className="others-tooltip">
                                            <span className="tooltip-header">Recommended by:</span>
                                            {rec.allSenders.map((s, i) => (
                                                <span key={i} className="tooltip-user">
                                                    {s.name || s.username || 'Unknown User'}
                                                </span>
                                            ))}
                                        </span>
                                    </span>
                                ) : ''} recommended 
                                <span className="pulse-media-title"> {rec.mediaTitle}</span>
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                { (Date.now() - new Date(rec.createdAt).getTime() < 300000) && (
                                    <span className="new-badge-tiny">NEW</span>
                                )}
                                <span className="pulse-time">{formatTime(rec.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {groupedRecs.length > limit && (
                <button 
                    className="pulse-see-more-btn"
                    onClick={() => setShowAll(!showAll)}
                >
                    {showAll ? 'Show less' : `See more (${groupedRecs.length - limit} more)`}
                </button>
            )}
        </div>
    );
};

export default SocialPulse;
