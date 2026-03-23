import React, { useState, useRef, useEffect } from 'react';

const CineSelect = ({ options, value, onChange, placeholder = 'Select option...', label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="cine-select-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {label && <label className="form-label">{label}</label>}
            <div 
                className={`form-input cine-select-trigger ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: 'rgba(255, 255, 255, 0.02)',
                    backdropFilter: 'blur(20px)',
                    border: isOpen ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)'
                }}
            >
                <span style={{ color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span style={{ 
                    transition: 'transform 0.3s ease',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0)'
                }}>
                    ▼
                </span>
            </div>

            {isOpen && (
                <div 
                    className="cine-select-dropdown"
                    data-lenis-prevent
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        background: 'rgba(15, 23, 42, 0.95)', /* Darker solid-ish background to prevent text bleed */
                        backdropFilter: 'blur(30px)',
                        WebkitBackdropFilter: 'blur(30px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '16px',
                        zIndex: 9999, /* Very high to stay on top */
                        maxHeight: '260px',
                        overflowY: 'auto',
                        padding: '10px',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)',
                        animation: 'cineSelectFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                >
                    {options.map((option) => (
                        <div
                            key={option.value}
                            className={`cine-select-option ${value === option.value ? 'active' : ''}`}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '12px 16px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                color: value === option.value ? '#fff' : 'var(--text-secondary)',
                                background: value === option.value ? 'var(--accent)' : 'transparent',
                                marginBottom: '4px'
                            }}
                            onMouseEnter={(e) => {
                                if (value !== option.value) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.color = '#fff';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (value !== option.value) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                }
                            }}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CineSelect;
