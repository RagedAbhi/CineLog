import React, { useState } from 'react';
import { X, Download, CheckCircle, Chrome } from 'lucide-react';
import CueratesLogo from '../assets/CueratesLogo';

const EXTENSION_DOWNLOAD_URL = 'https://cinelog-wdaj.onrender.com/extension/cuerates-extension.zip';
const EXTENSION_STORE_URL = ''; // Fill in once published to Chrome Web Store

/**
 * ExtensionPromptModal
 * Props:
 *   onClose     — dismiss the modal
 *   onInstalled — optional callback when user confirms installation
 */
const ExtensionPromptModal = ({ onClose, onInstalled }) => {
    const [step, setStep] = useState('prompt'); // 'prompt' | 'instructions'

    const handleDownload = () => {
        const url = EXTENSION_STORE_URL || EXTENSION_DOWNLOAD_URL;
        window.open(url, '_blank');
        setStep('instructions');
    };

    const handleDone = () => {
        localStorage.setItem('extensionPromptSeen', 'true');
        onInstalled?.();
        onClose();
    };

    const handleSkip = () => {
        localStorage.setItem('extensionPromptSeen', 'true');
        onClose();
    };

    return (
        <div className="wt-overlay" onClick={(e) => e.target === e.currentTarget && handleSkip()}>
            <div className="ext-modal">
                <button className="wt-close ext-close" onClick={handleSkip}><X size={18} /></button>

                {step === 'prompt' && (
                    <>
                        <div className="ext-logo-wrap">
                            <CueratesLogo size={88} />
                        </div>

                        <h2 className="ext-title">Watch Together</h2>
                        <p className="ext-desc">
                            Install the <strong>Cuerates Extension</strong> to watch Netflix in perfect sync with your friends — straight from your browser.
                        </p>

                        <div className="ext-features">
                            <div className="ext-feature">
                                <span className="ext-feature-icon">🔄</span>
                                <span>Auto-syncs play, pause &amp; seek</span>
                            </div>
                            <div className="ext-feature">
                                <span className="ext-feature-icon">💬</span>
                                <span>Live chat overlay while watching</span>
                            </div>
                            <div className="ext-feature">
                                <span className="ext-feature-icon">👥</span>
                                <span>See who's watching with you</span>
                            </div>
                        </div>

                        <button className="btn btn-primary ext-install-btn" onClick={handleDownload}>
                            <Chrome size={18} />
                            Install Extension
                        </button>
                        <button className="ext-skip-btn" onClick={handleSkip}>
                            Maybe later
                        </button>
                    </>
                )}

                {step === 'instructions' && (
                    <>
                        <div className="ext-logo-wrap">
                            <CheckCircle size={48} color="var(--accent)" />
                        </div>

                        <h2 className="ext-title">Installing the Extension</h2>

                        <div className="ext-steps">
                            <div className="ext-step">
                                <span className="ext-step-num">1</span>
                                <span>Open <strong>chrome://extensions</strong> in a new tab</span>
                            </div>
                            <div className="ext-step">
                                <span className="ext-step-num">2</span>
                                <span>Enable <strong>Developer mode</strong> (top-right toggle)</span>
                            </div>
                            <div className="ext-step">
                                <span className="ext-step-num">3</span>
                                <span>Unzip the downloaded file, then click <strong>Load unpacked</strong> and select the folder</span>
                            </div>
                            <div className="ext-step">
                                <span className="ext-step-num">4</span>
                                <span>Pin the <strong>Cuerates</strong> icon to your toolbar and click it to log in</span>
                            </div>
                        </div>

                        <button className="btn btn-primary ext-install-btn" onClick={handleDone}>
                            <Download size={16} />
                            I've installed it
                        </button>
                        <button className="ext-skip-btn" onClick={handleSkip}>
                            I'll do this later
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ExtensionPromptModal;
