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

    const displayedRecs = showAll ? recommendations : recommendations.slice(0, limit);

    return (
        <div className="social-pulse-container glass-panel">
            <div className="pulse-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} />
                    <span>Recent Activity</span>
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
                        // Use imdbID specifically for recommendations. 
                        // rec._id is a Recommendation record ID, NOT a movie ID.
                        onClick={() => navigate(`/movies/${rec.imdbID}?external=true&type=${rec.mediaType || 'movie'}`)}
                    >
                        <div className="pulse-avatar">
                            {rec.sender?.avatar ? (
                                <img src={rec.sender.avatar} alt={rec.sender?.name || ''} />
                            ) : (
                                <User size={14} />
                            )}
                        </div>
                        <div className="pulse-info">
                            <p className="pulse-text">
                                <strong>{rec.sender?.name || 'Unknown User'}</strong> recommended 
                                <span> {rec.mediaTitle}</span>
                            </p>
                            <span className="pulse-time">{formatTime(rec.createdAt)}</span>
                        </div>
                    </div>
                ))}
            </div>
            {recommendations.length > limit && (
                <button 
                    className="pulse-see-more-btn"
                    onClick={() => setShowAll(!showAll)}
                >
                    {showAll ? 'Show less' : `See more (${recommendations.length - limit} more)`}
                </button>
            )}
        </div>
    );
};

export default SocialPulse;
