import React, { useEffect, useRef } from 'react';
import { drawCueratesLogo } from '../utils/cuerates-logo';

/**
 * CueratesLogo — renders the premium camera-reel logo using the HTML5 canvas engine.
 *
 * Props:
 *   layout — 'horizontal' (navbar) | 'vertical' (login/hero). Default: 'vertical'.
 *   size   — ignored (canvas presets are fixed by layout). Kept for API compatibility.
 */
const CueratesLogo = ({ layout = 'vertical' }) => {
  const canvasRef = useRef(null);
  const isNavbar = layout === 'horizontal';

  useEffect(() => {
    if (canvasRef.current) {
      drawCueratesLogo(canvasRef.current, isNavbar ? 'navbar' : 'hero');
    }
  }, [isNavbar]);

  if (isNavbar) {
    // Navbar: fixed height, fades on all 4 edges via compound mask
    return (
      <div style={{
        height: '77px',
        flexShrink: 0,
        lineHeight: 0,
        display: 'flex',
        alignItems: 'center',
        // Horizontal: left edge fades in over first 5%, right edge fades out 37%→70%
        // Vertical:   top + bottom fade over first/last 12%
        // mask-composite: intersect means BOTH must be opaque for the pixel to show
        WebkitMaskImage: `
          linear-gradient(to right,  transparent 0%, black 5%, black 37%, transparent 70%),
          linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)
        `,
        maskImage: `
          linear-gradient(to right,  transparent 0%, black 5%, black 37%, transparent 70%),
          linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)
        `,
        WebkitMaskComposite: 'destination-in',
        maskComposite: 'intersect',
        marginLeft: '-8px',
        marginRight: '-280px',
      }}>
        <canvas
          ref={canvasRef}
          width={640}
          height={120}
          style={{ height: '100%', width: 'auto', display: 'block' }}
        />
      </div>
    );
  }

  // Vertical / hero: 1080×420 canvas scaled responsively
  return (
    <div style={{ width: '100%', maxWidth: '540px', margin: '0 auto', lineHeight: 0 }}>
      <canvas
        ref={canvasRef}
        width={1080}
        height={420}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </div>
  );
};

export default CueratesLogo;
