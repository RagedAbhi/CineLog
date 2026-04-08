import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { hideTrailerModal } from '../store/actions';

const TrailerModal = () => {
    const dispatch = useDispatch();
    const { visible, youtubeId } = useSelector(state => state.ui.trailer);

    const onClose = () => dispatch(hideTrailerModal());

    const modalVariants = {
        hidden: { opacity: 0, scale: 0.95, y: 30 },
        visible: { 
            opacity: 1, 
            scale: 1, 
            y: 0,
            transition: { type: 'spring', damping: 25, stiffness: 300 }
        },
        exit: { opacity: 0, scale: 0.95, y: 30, transition: { duration: 0.2 } }
    };

    return (
        <AnimatePresence>
            {visible && youtubeId && (
                <div 
                    className="modal-overlay" 
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                    style={{ 
                        zIndex: 10000, 
                        backgroundColor: 'rgba(0, 0, 0, 0.92)',
                        backdropFilter: 'blur(15px)',
                        padding: '20px'
                    }}
                >
                    <motion.div 
                        className="trailer-modal-content"
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{
                            width: '100%',
                            maxWidth: '1200px',
                            position: 'relative',
                            aspectRatio: '16/9',
                            background: '#000',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(129, 140, 248, 0.2)'
                        }}
                    >
                        {/* Header/Close bar */}
                        <div style={{
                            position: 'absolute',
                            top: '0',
                            left: '0',
                            right: '0',
                            padding: '15px 20px',
                            zIndex: 10,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
                            opacity: 0,
                            transition: 'opacity 0.3s'
                        }} className="trailer-header">
                             <button 
                                onClick={onClose}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    color: '#fff',
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    backdropFilter: 'blur(5px)'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* YouTube Embed */}
                        <iframe
                            width="100%"
                            height="100%"
                            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&modestbranding=1&rel=0`}
                            title="Movie Trailer"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ border: 'none' }}
                        ></iframe>

                        {/* Top corner separate close button for easy access during full overlay */}
                        <button 
                            onClick={onClose}
                            style={{
                                position: 'absolute',
                                top: '-50px',
                                right: '0',
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: '14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px'
                            }}
                        >
                            <X size={20} /> Close
                        </button>
                    </motion.div>

                    <style>{`
                        .trailer-modal-content:hover .trailer-header {
                            opacity: 1 !important;
                        }
                        @media (max-width: 768px) {
                            .trailer-modal-content {
                                aspectRatio: 16/9;
                            }
                        }
                    `}</style>
                </div>
            )}
        </AnimatePresence>
    );
};

export default TrailerModal;
