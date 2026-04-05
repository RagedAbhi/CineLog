import React from 'react';

/**
 * CueratesLogo — renders the premium bio-luminescent wordmark and icon.
 * 
 * Props:
 *   layout — 'horizontal' (navbar) or 'vertical' (login). Default 'vertical'.
 *   size   — base scale for the logo icon. Default 56.
 */
export const CueratesLogo = ({ layout = 'vertical', size = 56 }) => {
  const isVertical = layout === 'vertical';
  
  return (
    <div className={`flex ${isVertical ? 'flex-col items-center gap-1 p-2' : 'flex-row items-center gap-4'}`}>
      {/* Logo Container */}
      <div className="relative">
        {/* Subtle Glow Effect (only in vertical/login mode) */}
        {isVertical && (
          <div className="absolute inset-0 blur-3xl opacity-40">
            <div className="absolute top-0 left-0 w-32 h-32 bg-pink-500/30 rounded-full" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/30 rounded-full" />
            <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-purple-500/20 rounded-full -translate-x-1/2" />
          </div>
        )}
        
        {/* Main Logo Wrapper */}
        <div className={`relative flex ${isVertical ? 'flex-col items-center gap-2' : 'flex-row items-center gap-3'}`}>
          {/* Minimalist Film Icon */}
          <svg 
            width={isVertical ? size : size * 0.7} 
            height={isVertical ? size : size * 0.7} 
            viewBox="0 0 56 56" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-2xl"
          >
            <circle cx="28" cy="28" r="26" stroke="url(#glowGradient)" strokeWidth="1.5" opacity="0.6" />
            <circle cx="28" cy="28" r="20" stroke="url(#mainGradient)" strokeWidth="2" />
            <circle cx="28" cy="28" r="8" fill="url(#centerGradient)" opacity="0.9" />
            <circle cx="28" cy="12" r="2.5" fill="url(#holeGradient)" />
            <circle cx="28" cy="44" r="2.5" fill="url(#holeGradient)" />
            <circle cx="12" cy="28" r="2.5" fill="url(#holeGradient)" />
            <circle cx="44" cy="28" r="2.5" fill="url(#holeGradient)" />
            <circle cx="18" cy="18" r="2.5" fill="url(#holeGradient)" />
            <circle cx="38" cy="38" r="2.5" fill="url(#holeGradient)" />
            <circle cx="38" cy="18" r="2.5" fill="url(#holeGradient)" />
            <circle cx="18" cy="38" r="2.5" fill="url(#holeGradient)" />
            
            <defs>
              <linearGradient id="glowGradient" x1="0" y1="0" x2="56" y2="56">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="mainGradient" x1="8" y1="8" x2="48" y2="48">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="33%" stopColor="#e879f9" />
                <stop offset="66%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
              <radialGradient id="centerGradient" cx="28" cy="28" r="8">
                <stop offset="0%" stopColor="#d946ef" />
                <stop offset="100%" stopColor="#a855f7" />
              </radialGradient>
              <linearGradient id="holeGradient" x1="0" y1="0" x2="56" y2="56">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Text Logo */}
          <div className="flex flex-col">
            <h1 className={`${isVertical ? 'text-7xl' : 'text-2xl'} tracking-tight`} style={{ 
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #f472b6 0%, #e879f9 25%, #a855f7 60%, #60a5fa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.03em',
              textShadow: isVertical ? '0 0 40px rgba(168, 85, 247, 0.3)' : 'none'
            }}>
              Cuerates
            </h1>
          </div>
        </div>
      </div>
      
      {/* Tagline and Accent (only in vertical mode) */}
      {isVertical && (
        <>
          <p className="text-gray-400 tracking-widest uppercase text-center" style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 300,
            fontSize: '0.875rem',
            letterSpacing: '0.25em',
            textShadow: '0 0 20px rgba(168, 85, 247, 0.4)'
          }}>
            Your Cinematic Journal
          </p>
          
          <div className="w-64 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" 
               style={{
                 boxShadow: '0 0 10px rgba(168, 85, 247, 0.5)'
               }} 
          />
        </>
      )}
    </div>
  );
};

export default CueratesLogo;
