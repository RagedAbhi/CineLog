import React from 'react';

/**
 * CueratesTitle — renders the "CUERATES" wordmark + optional subtitle/rule.
 *
 * Props:
 *   titleSize   — font-size (px) for the main wordmark. Default 42.
 *   showSubtitle — show "YOUR MOVIE JOURNAL" + separator line. Default true.
 *   style       — extra styles on the outer wrapper.
 */
const CueratesTitle = ({ titleSize = 42, showSubtitle = true, style = {} }) => {
  const subtitleSize = titleSize * 0.27;
  const lineWidth = titleSize * 4.6;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Main wordmark */}
      <span
        style={{
          fontFamily: "'Josefin Sans', 'DM Sans', sans-serif",
          fontWeight: 200,
          fontSize: `${titleSize}px`,
          letterSpacing: '0.38em',
          paddingLeft: '0.38em',
          color: '#FFFFFF',
          textTransform: 'uppercase',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        CUERATES
      </span>

      {showSubtitle && (
        <>
          {/* Subtitle */}
          <span
            style={{
              fontFamily: "'Josefin Sans', 'DM Sans', sans-serif",
              fontWeight: 300,
              fontSize: `${subtitleSize}px`,
              letterSpacing: '0.46em',
              paddingLeft: '0.46em',
              color: 'rgba(255,255,255,0.52)',
              textTransform: 'uppercase',
              marginTop: `${titleSize * 0.19}px`,
              whiteSpace: 'nowrap',
            }}
          >
            YOUR MOVIE JOURNAL
          </span>

          {/* Separator line */}
          <div
            style={{
              width: `${lineWidth}px`,
              height: '1px',
              background:
                'linear-gradient(90deg, transparent 0%, rgba(129,140,248,0.55) 30%, rgba(192,132,252,0.7) 50%, rgba(129,140,248,0.55) 70%, transparent 100%)',
              marginTop: `${titleSize * 0.22}px`,
            }}
          />
        </>
      )}
    </div>
  );
};

export default CueratesTitle;
