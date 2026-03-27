import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Clock, User } from 'lucide-react';
import './SocialPulse.css';

const SocialPulse = () => {
    const recommendations = useSelector(state => state.auth.recommendations) || [];
    const navigate = useNavigate();

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

    return (
        <div className="social-pulse-container glass-panel">
            <div className="pulse-header">
                <Clock size={16} />
                <span>Recent Activity</span>
            </div>
            <div className="pulse-list">
                {recommendations.slice(0, 5).map((rec) => (
                    <div 
                        key={rec._id} 
                        className="pulse-item"
                        onClick={() => navigate(`/movies/${rec.imdbID || rec._id}?external=true`)}
                    >
                        <div className="pulse-avatar">
                            {rec.sender.avatar ? (
                                <img src={rec.sender.avatar} alt={rec.sender.name} />
                            ) : (
                                <User size={14} />
                            )}
                        </div>
                        <div className="pulse-info">
                            <p className="pulse-text">
                                <strong>{rec.sender.name}</strong> recommended 
                                <span> {rec.mediaTitle}</span>
                            </p>
                            <span className="pulse-time">{formatTime(rec.createdAt)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SocialPulse;
