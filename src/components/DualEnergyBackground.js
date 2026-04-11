import React, { useEffect, useRef } from 'react';

const DualEnergyBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let W, H, dpr;
    let t = 0;
    let animFrame;

    // ── MOUSE — raw target and smoothed position ─────────────────────────────────
    let mxRaw = 0, myRaw = 0;
    let mxSmooth = 0, mySmooth = 0;
    
    // ── SCROLL — raw and smoothed ──────────────────────────────────────────────────
    let scrollYRaw = window.scrollY || 0;
    let scrollYSmooth = scrollYRaw;

    const onScroll = () => {
      scrollYRaw = window.scrollY;
    };

    const onMouseMove = (e) => {
      mxRaw = e.clientX;
      myRaw = e.clientY;
    };

    const onTouchMove = (e) => {
      mxRaw = e.touches[0].clientX;
      myRaw = e.touches[0].clientY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchmove', onTouchMove, { passive: true });

    // ── STARS ────────────────────────────────────────────────────────────────────
    let stars = [];
    const buildStars = () => {
      stars = Array.from({ length: 420 }, () => ({
        ox: Math.random(),
        oy: Math.random(),
        r: Math.random() * 1.1 + 0.15,
        baseOp: Math.random() * 0.55 + 0.1,
        phase: Math.random() * Math.PI * 2,
        spd: Math.random() * 0.4 + 0.12,
        tint: Math.random() < 0.5 ? [255, 255, 255]
          : Math.random() < 0.5 ? [255, 210, 160]
            : [180, 160, 255],
        depth: Math.random(),
      }));
    };

    const drawStars = () => {
      // Snappier interpolation for tighter, faster cursor tracking
      mxSmooth += (mxRaw - mxSmooth) * 0.15;
      mySmooth += (myRaw - mySmooth) * 0.15;
      scrollYSmooth += (scrollYRaw - scrollYSmooth) * 0.055;

      const offX = (mxSmooth - W * 0.5) / (W * 0.5);
      const offY = (mySmooth - H * 0.5) / (H * 0.5);

      // Vastly increased shift magnitude to make the parallax clearly visible
      const MAX_SHIFT = 250;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      stars.forEach(s => {
        const layer = 0.15 + s.depth * 0.85;
        const shiftX = offX * MAX_SHIFT * layer;
        const shiftY = offY * MAX_SHIFT * layer;

        const sx = s.ox * W + shiftX;
        
        // Add scroll displacement, padded by 100px so wrapping is invisible off-screen
        let sy = s.oy * H + shiftY - scrollYSmooth * layer * 0.6;
        const pad = Math.max(100, s.r * 5);
        sy = ((sy + pad) % (H + pad * 2) + (H + pad * 2)) % (H + pad * 2) - pad;

        const fl = Math.sin(t * s.spd + s.phase) * 0.38 + 0.62;
        const op = s.baseOp * fl;
        const [r, g, b] = s.tint;

        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${op})`;
        ctx.fill();

        if (s.baseOp > 0.5) {
          const bloomR = s.r * 3.5;
          const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, bloomR);
          grd.addColorStop(0, `rgba(${r},${g},${b},${op * 0.35})`);
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.arc(sx, sy, bloomR, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }
      });
      ctx.restore();
    };

    // ── FLOATING PARTICLES ───────────────────────────────────────────────────────
    let particles = [];
    const buildParticles = () => {
      particles = Array.from({ length: 110 }, () => {
        const side = Math.random() < 0.5 ? 'orange' : 'purple';
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.6 + 0.4,
          vx: (Math.random() - 0.5) * 0.18,
          vy: -(Math.random() * 0.22 + 0.04),
          op: Math.random() * 0.7 + 0.2,
          phase: Math.random() * Math.PI * 2,
          spd: Math.random() * 0.3 + 0.1,
          side,
        };
      });
    };

    const drawParticles = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      particles.forEach(p => {
        // Base movement
        p.x += p.vx;
        p.y += p.vy;
        
        // Wrap base logically
        if (p.y < -50) p.y = H + 50;
        if (p.x < -50) p.x = W + 50;
        if (p.x > W + 50) p.x = -50;
        
        // Render position with scrolling and wrapping
        let py = p.y - scrollYSmooth * 0.8;
        py = ((py + 50) % (H + 100) + (H + 100)) % (H + 100) - 50;

        const fl = Math.sin(t * p.spd + p.phase) * 0.3 + 0.7;
        const op = p.op * fl * 0.65;
        const col = p.side === 'orange' ? `rgba(255,140,30,${op})` : `rgba(160,60,255,${op})`;
        ctx.beginPath();
        ctx.arc(p.x, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      });
      ctx.restore();
    };

    // ── DOT GRID ─────────────────────────────────────────────────────────────────
    let dots = [];
    const buildDotGrid = () => {
      dots = [];
      const cols = 28, rows = 18;
      const gx = W * 0.08, gy = H * 0.58;
      const gw = W * 0.38, gh = H * 0.38;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const fx = c / (cols - 1);
          const fy = r / (rows - 1);
          const fadeX = 1 - fx * 0.9;
          const fadeY = 1 - fy * 0.5;
          dots.push({
            x: gx + fx * gw,
            y: gy + fy * gh,
            op: fadeX * fadeY * 0.55,
            phase: Math.random() * Math.PI * 2,
            spd: Math.random() * 0.2 + 0.05,
          });
        }
      }
    };

    const drawDotGrid = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      dots.forEach(d => {
        let dy = d.y - scrollYSmooth * 0.2;
        // Dot grid looks better rigidly moving without wrap, or wrap gently if it exceeds
        // But since it's a fixed grid generated around the center, wrapping it creates an infinite matrix
        dy = ((dy % H) + H) % H;

        const fl = Math.sin(t * d.spd + d.phase) * 0.2 + 0.8;
        ctx.beginPath();
        ctx.arc(d.x, dy, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,130,40,${d.op * fl})`;
        ctx.fill();
      });
      ctx.restore();
    };

    // ── BACKGROUND BASE + NEBULA ──────────────────────────────────────────────────
    const drawBackground = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.9);
      bg.addColorStop(0, 'rgb(4,1,10)');
      bg.addColorStop(0.5, 'rgb(2,0,5)');
      bg.addColorStop(1, 'rgb(0,0,2)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      let g = ctx.createRadialGradient(W * 0.0, H * 0.45, 0, W * 0.0, H * 0.45, W * 0.82);
      g.addColorStop(0, `rgba(130,44,0,${0.18 + Math.sin(t * 0.12) * 0.02})`);
      g.addColorStop(0.28, `rgba(80,22,0,${0.09 + Math.sin(t * 0.09) * 0.015})`);
      g.addColorStop(0.6, 'rgba(35,7,0,0.03)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      g = ctx.createRadialGradient(W * 0.18, H * 0.62, 0, W * 0.18, H * 0.62, W * 0.55);
      g.addColorStop(0, `rgba(100,32,0,${0.10 + Math.sin(t * 0.14 + 1) * 0.015})`);
      g.addColorStop(0.5, 'rgba(45,10,0,0.025)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      g = ctx.createRadialGradient(W * 1.0, H * 0.45, 0, W * 1.0, H * 0.45, W * 0.82);
      g.addColorStop(0, `rgba(75,18,170,${0.16 + Math.sin(t * 0.11 + 2) * 0.02})`);
      g.addColorStop(0.28, `rgba(42,8,100,${0.08 + Math.sin(t * 0.08 + 3) * 0.015})`);
      g.addColorStop(0.6, 'rgba(14,2,35,0.025)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      g = ctx.createRadialGradient(W * 0.82, H * 0.62, 0, W * 0.82, H * 0.62, W * 0.5);
      g.addColorStop(0, `rgba(55,10,130,${0.09 + Math.sin(t * 0.13 + 4) * 0.015})`);
      g.addColorStop(0.5, 'rgba(20,3,50,0.02)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      g = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.28);
      g.addColorStop(0, 'rgba(2,0,6,0.88)');
      g.addColorStop(0.5, 'rgba(2,0,6,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillRect(0, 0, W, H);

      const patches = [
        { x: 0.25, y: 0.2, r: 0.22, col: 'rgba(90,28,0', a: 0.05, spd: 0.07, ph: 0 },
        { x: 0.08, y: 0.78, r: 0.18, col: 'rgba(110,35,0', a: 0.04, spd: 0.09, ph: 1.2 },
        { x: 0.72, y: 0.18, r: 0.20, col: 'rgba(50,12,120', a: 0.045, spd: 0.08, ph: 2.4 },
        { x: 0.88, y: 0.75, r: 0.19, col: 'rgba(60,15,140', a: 0.04, spd: 0.06, ph: 3.1 },
        { x: 0.42, y: 0.08, r: 0.16, col: 'rgba(70,20,0', a: 0.03, spd: 0.11, ph: 0.7 },
        { x: 0.6, y: 0.88, r: 0.17, col: 'rgba(40,8,100', a: 0.03, spd: 0.10, ph: 1.8 },
      ];
      ctx.globalCompositeOperation = 'lighter';
      patches.forEach(p => {
        const pulse = Math.sin(t * p.spd + p.ph) * 0.04;
        let gPatch = ctx.createRadialGradient(W * p.x, H * p.y, 0, W * p.x, H * p.y, W * p.r);
        gPatch.addColorStop(0, `${p.col},${p.a + pulse})`);
        gPatch.addColorStop(0.5, `${p.col},${(p.a * 0.3) + pulse * 0.5})`);
        gPatch.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gPatch; ctx.fillRect(0, 0, W, H);
      });

      ctx.restore();
    };

    // ── CUBIC BEZIER ─────────────────────────────────────────────────────────────
    const cBez = (p0, p1, p2, p3, u) => {
      const m = 1 - u;
      return m * m * m * p0 + 3 * m * m * u * p1 + 3 * m * u * u * p2 + u * u * u * p3;
    };

    // ── PLASMA STREAM ─────────────────────────────────────────────────────────────
    const plasmaStream = (x0, y0, cx1, cy1, cx2, cy2, x1, y1, R, G, B, steps, peakT, brightMult) => {
      const bm = brightMult || 1;
      const passes = [
        [22, 0.008 * bm],
        [10, 0.028 * bm],
        [4, 0.10 * bm],
        [1.4, 0.42 * bm],
        [0.5, 0.88 * bm],
      ];
      passes.forEach(([lw, baseA]) => {
        let lx = x0, ly = y0;
        for (let i = 1; i <= steps; i++) {
          const u = i / steps;
          const bx = cBez(x0, cx1, cx2, x1, u);
          const by = cBez(y0, cy1, cy2, y1, u);
          let intensity;
          if (u <= peakT) {
            const d = (peakT - u) / peakT;
            intensity = Math.exp(-d * d * 3.8);
          } else {
            const d = (u - peakT) / (1 - peakT + 0.001);
            intensity = Math.exp(-d * d * 22);
          }
          const op = Math.min(baseA * intensity, 1);
          if (op < 0.002) { lx = bx; ly = by; continue; }
          const wb = (lw < 1) ? intensity * 0.55 : 0;
          const cr = Math.round(R + (255 - R) * wb);
          const cg = Math.round(G + (255 - G) * wb);
          const cb = Math.round(B + (255 - B) * wb);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(bx, by);
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${op})`;
          ctx.lineWidth = lw;
          ctx.lineCap = 'round';
          ctx.stroke();
          lx = bx; ly = by;
        }
      });
    };

    // ── ENERGY ARC SYSTEM ─────────────────────────────────────────────────────────
    const drawArc = (orbX, orbY, orbR, R, G, B, side, streams) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      streams.forEach(s => {
        const drift = t * s.spd * (side === 1 ? 1 : -1) + s.phaseOff;
        const angle = s.angleBase + drift;
        const spread = Math.PI * (0.82 + s.arcLift * 0.25);

        const entryAngle = angle - spread * 0.5;
        const entryR = orbR * (2.0 + s.arcLift * 1.1);
        const ex = orbX + Math.cos(entryAngle) * entryR;
        const ey = orbY + Math.sin(entryAngle) * entryR * 0.42;

        const exitAngle = angle + spread * 0.5;
        const exitR = orbR * (1.7 + s.arcLift * 0.9);
        const fx = orbX + Math.cos(exitAngle) * exitR;
        const fy = orbY + Math.sin(exitAngle) * exitR * 0.42;

        const cp1x = orbX + Math.cos(entryAngle + 0.28) * orbR * 1.45;
        const cp1y = orbY + Math.sin(entryAngle + 0.28) * orbR * 0.48;
        const cp2x = orbX + Math.cos(exitAngle - 0.28) * orbR * 1.38;
        const cp2y = orbY + Math.sin(exitAngle - 0.28) * orbR * 0.48;

        plasmaStream(ex, ey, cp1x, cp1y, cp2x, cp2y, fx, fy, R, G, B, 120, s.peakT, s.bright || 1);
      });

      ctx.restore();
    };

    const drawOrbCorona = (orbX, orbY, orbR, R, G, B) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const layers = [
        { r: orbR * 2.8, a: 0.08 },
        { r: orbR * 1.8, a: 0.16 },
        { r: orbR * 1.1, a: 0.28 },
        { r: orbR * 0.6, a: 0.42 },
      ];
      layers.forEach(layer => {
        const grd = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, layer.r);
        grd.addColorStop(0, `rgba(${R},${G},${B},${layer.a})`);
        grd.addColorStop(0.35, `rgba(${R},${G},${B},${layer.a * 0.4})`);
        grd.addColorStop(0.7, `rgba(${Math.round(R * 0.6)},${Math.round(G * 0.3)},${Math.round(B * 0.6)},${layer.a * 0.1})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(orbX, orbY, layer.r, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });

      const hotCore = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, orbR * 0.45);
      hotCore.addColorStop(0, `rgba(255,255,255,0.55)`);
      hotCore.addColorStop(0.3, `rgba(${R},${G},${B},0.35)`);
      hotCore.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(orbX, orbY, orbR * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = hotCore;
      ctx.fill();

      ctx.restore();
    };

    const orangeStreams = [
      { angleBase: -0.10, swingIn: 0.70, arcLift: 0.60, spd: 0.010, phaseOff: 0.0, peakT: 0.70, bright: 1.0 },
      { angleBase: 0.22, swingIn: 0.58, arcLift: 0.75, spd: 0.008, phaseOff: 1.3, peakT: 0.67, bright: 0.9 },
      { angleBase: -0.28, swingIn: 0.85, arcLift: 0.40, spd: 0.013, phaseOff: 2.6, peakT: 0.74, bright: 0.85 },
      { angleBase: 0.42, swingIn: 0.48, arcLift: 0.85, spd: 0.007, phaseOff: 3.9, peakT: 0.63, bright: 0.8 },
      { angleBase: -0.42, swingIn: 0.92, arcLift: 0.32, spd: 0.015, phaseOff: 5.2, peakT: 0.78, bright: 0.75 },
      { angleBase: 0.62, swingIn: 0.62, arcLift: 0.55, spd: 0.009, phaseOff: 0.8, peakT: 0.71, bright: 0.7 },
    ];

    const purpleStreams = [
      { angleBase: 0.08, swingIn: 0.68, arcLift: 0.62, spd: 0.009, phaseOff: 0.6, peakT: 0.72, bright: 1.0 },
      { angleBase: -0.24, swingIn: 0.56, arcLift: 0.72, spd: 0.011, phaseOff: 1.8, peakT: 0.66, bright: 0.9 },
      { angleBase: 0.32, swingIn: 0.80, arcLift: 0.44, spd: 0.012, phaseOff: 3.1, peakT: 0.75, bright: 0.85 },
      { angleBase: -0.46, swingIn: 0.50, arcLift: 0.80, spd: 0.008, phaseOff: 4.4, peakT: 0.64, bright: 0.8 },
      { angleBase: 0.50, swingIn: 0.88, arcLift: 0.36, spd: 0.014, phaseOff: 5.8, peakT: 0.79, bright: 0.75 },
      { angleBase: -0.60, swingIn: 0.60, arcLift: 0.58, spd: 0.010, phaseOff: 1.4, peakT: 0.70, bright: 0.7 },
    ];

    // ── MAIN RENDER LOOP ──────────────────────────────────────────────────────────
    const frame = (ts) => {
      t = ts * 0.001;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#010005'; ctx.fillRect(0, 0, W, H);

      drawBackground();
      drawStars();
      drawParticles();
      drawDotGrid();

      const orbR = Math.min(W, H) * 0.42;
      const lOrbX = W * -0.04;
      const lOrbY = H * 0.50;

      // drawArc(lOrbX, lOrbY, orbR, 255, 82, 0, 1, orangeStreams);
      drawOrbCorona(lOrbX, lOrbY, orbR, 255, 82, 0);

      const rOrbX = W * 1.04;
      const rOrbY = H * 0.50;

      // drawArc(rOrbX, rOrbY, orbR, 128, 40, 255, -1, purpleStreams);
      drawOrbCorona(rOrbX, rOrbY, orbR, 128, 40, 255);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.18, W * 0.5, H * 0.5, Math.max(W, H) * 0.82);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(0.45, 'rgba(0,0,0,0)');
      vig.addColorStop(0.72, 'rgba(0,0,0,0.55)');
      vig.addColorStop(1, 'rgba(0,0,0,0.92)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      animFrame = requestAnimationFrame(frame);
    };

    // ── RESIZE ──────────────────────────────────────────────────────────────────
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      
      // We don't want to use style.width and style.height since it could conflict with CSS, but for density it's okay.
      // However we will manage density just by scaling the context
      
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      
      mxRaw = mxSmooth = W / 2;
      myRaw = mySmooth = H / 2;
      
      buildStars();
      buildParticles();
      buildDotGrid();
    };

    window.addEventListener('resize', resize);
    resize();
    animFrame = requestAnimationFrame(frame);

    // ── CLEANUP ─────────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('touchmove', onTouchMove);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block'
      }}
    />
  );
};

export default DualEnergyBackground;
