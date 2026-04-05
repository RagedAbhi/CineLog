import React from 'react';

const CinelogLogo = ({ size = 80, style = {} }) => {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const outerR = s * 0.44;
  const innerR = s * 0.36;
  const holeR = s * 0.056;
  const holeD = s * 0.25;
  const hubR = s * 0.12;

  // 6 perforations evenly spaced, starting from top
  const holes = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60 - 90) * (Math.PI / 180);
    return {
      x: cx + holeD * Math.cos(angle),
      y: cy + holeD * Math.sin(angle),
    };
  });

  const uid = `cl-${Math.round(s)}`;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, ...style }}
    >
      <defs>
        <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={s * 0.028} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-strong`} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation={s * 0.06} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-flare`} x="-200%" y="-400%" width="500%" height="900%">
          <feGaussianBlur stdDeviation={s * 0.022} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id={`${uid}-ring`} cx="58%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="40%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#3B1F8C" stopOpacity="0.35" />
        </radialGradient>
        <radialGradient id={`${uid}-hub`} cx="35%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#EDE9FE" />
          <stop offset="55%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#5B21B6" />
        </radialGradient>
        <radialGradient id={`${uid}-hole`} cx="38%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#5B21B6" />
        </radialGradient>
        <radialGradient id={`${uid}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#818CF8" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer halo glow */}
      <circle cx={cx} cy={cy} r={outerR * 1.45} fill={`url(#${uid}-halo)`} />

      {/* Outer ring */}
      <circle
        cx={cx} cy={cy} r={outerR}
        fill="none"
        stroke={`url(#${uid}-ring)`}
        strokeWidth={s * 0.014}
        filter={`url(#${uid}-glow)`}
      />

      {/* Reel body — dark fill */}
      <circle cx={cx} cy={cy} r={outerR - s * 0.018} fill="#06060f" />

      {/* Inner dashed ring */}
      <circle
        cx={cx} cy={cy} r={innerR}
        fill="none"
        stroke="#7C3AED"
        strokeWidth={s * 0.008}
        strokeDasharray={`${s * 0.026} ${s * 0.026}`}
        opacity="0.55"
      />

      {/* 6 perforations */}
      {holes.map((h, i) => (
        <circle
          key={i}
          cx={h.x} cy={h.y} r={holeR}
          fill={`url(#${uid}-hole)`}
          filter={`url(#${uid}-glow)`}
          opacity="0.88"
        />
      ))}

      {/* Central hub */}
      <circle
        cx={cx} cy={cy} r={hubR}
        fill={`url(#${uid}-hub)`}
        filter={`url(#${uid}-strong)`}
      />

      {/* Bottom lens flare streak */}
      <ellipse
        cx={cx}
        cy={cy + outerR * 0.97}
        rx={outerR * 0.38}
        ry={s * 0.013}
        fill="#A78BFA"
        opacity="0.65"
        filter={`url(#${uid}-flare)`}
      />
    </svg>
  );
};

export default CinelogLogo;
