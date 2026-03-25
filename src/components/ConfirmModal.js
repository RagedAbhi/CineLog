import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/global.css';

const ConfirmModal = ({ visible, title, message, onConfirm, onClose }) => {
  return (
    <AnimatePresence>
      {visible && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} style={{ zIndex: 3000 }}>
          <motion.div 
            className="modal" 
            style={{ maxWidth: '400px', textAlign: 'center' }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="modal-header" style={{ justifyContent: 'center' }}>
              <h3>{title || 'Confirm Action'}</h3>
            </div>
            <div className="modal-body" style={{ padding: '20px 0 30px 0' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.6' }}>
                {message || 'Are you sure you want to proceed?'}
              </p>
            </div>
            <div className="form-actions" style={{ justifyContent: 'center', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={onClose} style={{ minWidth: '100px' }}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  if (onConfirm) onConfirm();
                  onClose();
                }}
                style={{ minWidth: '100px', background: 'rgba(255, 59, 48, 0.2)', border: '1px solid rgba(255, 59, 48, 0.3)', color: '#ff453a' }}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
