/**
 * cuerates-logo.js
 * Exports drawCueratesLogo(canvas, size) — renders the premium Cuerates
 * camera-reel logo onto any HTMLCanvasElement.
 *
 * size: 'hero' | 'logo' | 'navbar' | 'icon'
 */

// ─── Gradient helpers ─────────────────────────────────────────────────────────
function rg(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  return g;
}

function lg(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  return g;
}

// ─── Size presets ─────────────────────────────────────────────────────────────
const SIZE_PRESETS = {
  hero:     { W: 1080, H: 420, camX: 38,  camY: 18, camS: 0.92,  showText: true,  textX: 510, textY: 210, fontSize: 88, tagSize: 17, iconOnly: false },
  logo:     { W: 600,  H: 200, camX: 10,  camY: 8,  camS: 0.42,  showText: true,  textX: 228, textY: 104, fontSize: 44, tagSize: 10, iconOnly: false },
  // navbar-lg: wider canvas with bigger camS so text and reel render visibly
  navbar:   { W: 640,  H: 120, camX: 8,   camY: 6,  camS: 0.265, showText: true,  textX: 152, textY: 62,  fontSize: 33, tagSize: 8,  iconOnly: false },
  icon:     { W: 120,  H: 120, camX: 8,   camY: 8,  camS: 0.26,  showText: false, iconOnly: true },
};

// ─── Core drawing engine ──────────────────────────────────────────────────────
function drawScene(cv, opts) {
  const { W, H, camX, camY, camS, showText, textX, textY, fontSize, tagSize, iconOnly } = opts;

  cv.width  = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  // Background
  ctx.fillStyle = lg(ctx, 0, 0, W, H, [[0, '#060010'], [0.5, '#0a0018'], [1, '#000000']]);
  ctx.fillRect(0, 0, W, H);
  if (!iconOnly) {
    ctx.fillStyle = rg(ctx, W * 0.32, H * 0.5, 40, W * 0.55, [[0, 'rgba(40,5,80,0.0)'], [0.6, 'rgba(10,0,25,0.35)'], [1, 'rgba(0,0,0,0.85)']]);
    ctx.fillRect(0, 0, W, H);
  }

  const ox = camX, oy = camY, s = camS;
  function x(v) { return ox + v * s; }
  function y(v) { return oy + v * s; }
  function r(v) { return v * s; }

  // Glow aura
  if (!iconOnly) {
    ctx.fillStyle = rg(ctx, x(200), y(200), 10, r(280), [[0, 'rgba(160,50,255,0.18)'], [0.4, 'rgba(255,80,20,0.08)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, W, H);
  }

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = r(28); ctx.shadowOffsetX = r(8); ctx.shadowOffsetY = r(12);
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.beginPath(); ctx.rect(x(60), y(148), r(278), r(185)); ctx.fill();
  ctx.beginPath(); ctx.arc(x(130), y(88), r(68), 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x(248), y(78), r(76), 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Body
  ctx.beginPath(); ctx.roundRect(x(60), y(148), r(278), r(185), r(7));
  ctx.fillStyle = lg(ctx, x(60), y(148), x(60), y(333), [[0, '#2c1158'], [0.3, '#1e0c40'], [0.65, '#16093a'], [1, '#0e0628']]);
  ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x(60), y(148), r(278), r(185), r(7)); ctx.clip();
  ctx.fillStyle = lg(ctx, x(60), y(148), x(60), y(210), [[0, 'rgba(160,70,255,0.18)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(x(60), y(148), r(278), r(62));
  ctx.fillStyle = lg(ctx, x(60), y(148), x(92), y(148), [[0, 'rgba(190,90,255,0.12)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(x(60), y(148), r(32), r(185));
  ctx.restore();
  // Body border glow
  ctx.save();
  ctx.shadowColor = 'rgba(180,60,255,0.55)'; ctx.shadowBlur = r(12);
  ctx.beginPath(); ctx.roundRect(x(60), y(148), r(278), r(185), r(7));
  ctx.strokeStyle = lg(ctx, x(60), y(148), x(338), y(333), [[0, 'rgba(220,110,255,0.95)'], [0.4, 'rgba(255,150,40,0.6)'], [1, 'rgba(120,30,220,0.4)']]);
  ctx.lineWidth = r(1.8); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = 'rgba(255,100,20,0.35)'; ctx.shadowBlur = r(18);
  ctx.beginPath(); ctx.roundRect(x(60), y(148), r(278), r(185), r(7));
  ctx.strokeStyle = 'rgba(255,120,30,0.25)'; ctx.lineWidth = r(3); ctx.stroke();
  ctx.restore();

  // Seams
  ctx.beginPath(); ctx.moveTo(x(68), y(215)); ctx.lineTo(x(330), y(215));
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = r(2.5); ctx.stroke();
  ctx.beginPath(); ctx.rect(x(68), y(215), r(262), r(5));
  ctx.fillStyle = lg(ctx, x(68), 0, x(330), 0, [[0, 'rgba(255,115,18,0.85)'], [1, 'rgba(200,55,0,0.18)']]);
  ctx.fill();
  ctx.beginPath(); ctx.moveTo(x(68), y(295)); ctx.lineTo(x(330), y(295));
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = r(2); ctx.stroke();

  // Viewfinder
  ctx.beginPath(); ctx.roundRect(x(72), y(95), r(95), r(58), r(6));
  ctx.fillStyle = lg(ctx, x(72), y(95), x(72), y(153), [[0, '#30115a'], [1, '#18093e']]);
  ctx.fill();
  ctx.save(); ctx.shadowColor = 'rgba(180,60,255,0.5)'; ctx.shadowBlur = r(10);
  ctx.beginPath(); ctx.roundRect(x(72), y(95), r(95), r(58), r(6));
  ctx.strokeStyle = 'rgba(200,80,255,0.9)'; ctx.lineWidth = r(1.3); ctx.stroke();
  ctx.restore();
  // VF window
  ctx.beginPath(); ctx.roundRect(x(82), y(108), r(52), r(30), r(4));
  ctx.fillStyle = '#03000e'; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x(82), y(108), r(52), r(30), r(4)); ctx.clip();
  ctx.fillStyle = lg(ctx, x(82), y(108), x(134), y(138), [[0, 'rgba(115,45,215,0.42)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(x(82), y(108), r(52), r(30));
  ctx.strokeStyle = 'rgba(190,75,255,0.2)'; ctx.lineWidth = r(0.7);
  ctx.beginPath(); ctx.moveTo(x(108), y(110)); ctx.lineTo(x(108), y(136)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x(84), y(123)); ctx.lineTo(x(132), y(123)); ctx.stroke();
  [[x(86), y(111), r(6)], [x(132), y(111), r(-6)], [x(86), y(136), r(6)], [x(132), y(136), r(-6)]].forEach(([cx, cy, d]) => {
    ctx.beginPath(); ctx.moveTo(cx + d, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + d);
    ctx.strokeStyle = 'rgba(255,112,36,0.5)'; ctx.lineWidth = r(1); ctx.stroke();
  });
  ctx.restore();
  ctx.save(); ctx.shadowColor = 'rgba(255,100,20,0.4)'; ctx.shadowBlur = r(8);
  ctx.beginPath(); ctx.roundRect(x(82), y(108), r(52), r(30), r(4));
  ctx.strokeStyle = 'rgba(255,96,16,0.75)'; ctx.lineWidth = r(1.1); ctx.stroke();
  ctx.restore();

  // Lens cone
  ctx.beginPath();
  ctx.moveTo(x(338), y(175)); ctx.lineTo(x(428), y(140));
  ctx.lineTo(x(428), y(325)); ctx.lineTo(x(338), y(288));
  ctx.closePath();
  ctx.fillStyle = lg(ctx, x(338), y(175), x(428), y(232), [[0, '#22104a'], [1, '#100830']]);
  ctx.fill();
  ctx.save(); ctx.shadowColor = 'rgba(255,100,30,0.5)'; ctx.shadowBlur = r(14);
  ctx.beginPath();
  ctx.moveTo(x(338), y(175)); ctx.lineTo(x(428), y(140));
  ctx.lineTo(x(428), y(325)); ctx.lineTo(x(338), y(288));
  ctx.closePath();
  ctx.strokeStyle = lg(ctx, x(338), y(175), x(428), y(325), [[0, 'rgba(255,140,30,0.85)'], [0.5, 'rgba(180,60,255,0.55)'], [1, 'rgba(255,90,10,0.4)']]);
  ctx.lineWidth = r(1.8); ctx.stroke();
  ctx.restore();

  // Main lens
  const LCX = 190, LCY = 242, LR = 60;
  [[LR, r(3), '#ff9933', '#7722cc'], [LR - 10, r(1.5), '#2a1055', '#0e0428'], [LR - 20, r(1.3), '#cc5500', '#551199'], [LR - 30, r(1.1), '#1a0840', '#08021a']].forEach(([lr, lw, s0, s1], i) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = r(6 + i * 3); ctx.shadowOffsetX = r(2); ctx.shadowOffsetY = r(3);
    ctx.beginPath(); ctx.arc(x(LCX), y(LCY), r(lr), 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(x(LCX), y(LCY), r(lr), 0, Math.PI * 2);
    ctx.fillStyle = rg(ctx, x(LCX - lr * 0.3), y(LCY - lr * 0.33), 1, r(lr), [[0, i === 0 ? '#341460' : '#1e0c40'], [0.45, i === 0 ? '#1a0840' : '#100830'], [1, '#070218']]);
    ctx.fill();
    if (i === 0) {
      ctx.save(); ctx.shadowColor = 'rgba(255,120,30,0.65)'; ctx.shadowBlur = r(16);
      ctx.beginPath(); ctx.arc(x(LCX), y(LCY), r(lr), 0, Math.PI * 2);
      ctx.strokeStyle = lg(ctx, x(LCX - lr), y(LCY - lr), x(LCX + lr), y(LCY + lr), [[0, s0 + 'ff'], [0.45, s1 + 'bb'], [1, s0 + '77']]);
      ctx.lineWidth = lw; ctx.stroke(); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(x(LCX), y(LCY), r(lr), 0, Math.PI * 2);
      ctx.strokeStyle = lg(ctx, x(LCX - lr), y(LCY - lr), x(LCX + lr), y(LCY + lr), [[0, s0 + 'dd'], [0.45, s1 + '99'], [1, s0 + '44']]);
      ctx.lineWidth = lw; ctx.stroke();
    }
    if (i < 2) {
      const nt = i === 0 ? 22 : 14;
      for (let t = 0; t < nt; t++) {
        const a = (Math.PI * 2 / nt) * t, len = t % 4 === 0 ? r(6) : r(3);
        ctx.beginPath(); ctx.moveTo(x(LCX) + Math.cos(a) * r(lr - 2), y(LCY) + Math.sin(a) * r(lr - 2));
        ctx.lineTo(x(LCX) + Math.cos(a) * (r(lr - 2) - len), y(LCY) + Math.sin(a) * (r(lr - 2) - len));
        ctx.strokeStyle = t % 4 === 0 ? 'rgba(255,130,33,0.72)' : 'rgba(172,60,255,0.42)'; ctx.lineWidth = r(1); ctx.stroke();
      }
    }
  });
  ctx.beginPath(); ctx.arc(x(LCX), y(LCY), r(LR - 30), 0, Math.PI * 2);
  ctx.fillStyle = rg(ctx, x(LCX - 7), y(LCY - 9), 2, r(LR - 30), [[0, '#1a0862'], [0.25, '#0e0442'], [0.55, '#07022c'], [0.85, '#030116'], [1, '#01000a']]);
  ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x(LCX), y(LCY), r(LR - 30), 0, Math.PI * 2); ctx.clip();
  ctx.beginPath(); ctx.arc(x(LCX - 4), y(LCY - 6), r(LR - 42), Math.PI * 1.08, Math.PI * 1.6);
  ctx.strokeStyle = 'rgba(202,122,255,0.38)'; ctx.lineWidth = r(3.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(x(LCX - 11), y(LCY - 13), r(4), 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x(LCX - 10), y(LCY - 12), r(2), 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  ctx.restore();

  // Film reels
  function drawReel(cx, cy, R) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = r(20); ctx.shadowOffsetX = r(7); ctx.shadowOffsetY = r(9);
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R), 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R), 0, Math.PI * 2);
    ctx.fillStyle = rg(ctx, x(cx - R * 0.3), y(cy - R * 0.34), 3, r(R), [[0, '#2c1258'], [0.42, '#190940'], [0.82, '#0e062a'], [1, '#07031a']]);
    ctx.fill();
    ctx.save(); ctx.shadowColor = 'rgba(255,130,30,0.7)'; ctx.shadowBlur = r(18);
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R), 0, Math.PI * 2);
    ctx.strokeStyle = lg(ctx, x(cx - R), y(cy - R), x(cx + R), y(cy + R), [[0, 'rgba(255,160,40,1)'], [0.35, 'rgba(210,70,255,0.8)'], [0.7, 'rgba(255,110,20,0.6)'], [1, 'rgba(100,20,200,0.3)']]);
    ctx.lineWidth = r(3); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.shadowColor = 'rgba(200,60,255,0.5)'; ctx.shadowBlur = r(22);
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180,50,255,0.2)'; ctx.lineWidth = r(5); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R) - r(1.5), Math.PI * 1.15, Math.PI * 1.88);
    ctx.strokeStyle = 'rgba(255,200,60,0.75)'; ctx.lineWidth = r(2.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * 0.91), 0, Math.PI * 2); ctx.fillStyle = '#050118'; ctx.fill();
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * 0.91), 0, Math.PI * 2); ctx.strokeStyle = 'rgba(78,18,158,0.42)'; ctx.lineWidth = r(1.2); ctx.stroke();
    const nP = 18;
    for (let i = 0; i < nP; i++) {
      const a = (Math.PI * 2 / nP) * i, px = x(cx + Math.cos(a) * R * 0.955), py = y(cy + Math.sin(a) * R * 0.955);
      ctx.save(); ctx.translate(px, py); ctx.rotate(a + Math.PI / 2);
      const pw = r(R * 0.056), ph = r(R * 0.038);
      ctx.beginPath(); ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 2); ctx.fillStyle = '#010006'; ctx.fill();
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,98,18,0.7)' : 'rgba(152,42,255,0.7)'; ctx.lineWidth = r(0.9); ctx.stroke(); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * 0.82), 0, Math.PI * 2);
    ctx.fillStyle = rg(ctx, x(cx - R * 0.18), y(cy - R * 0.2), 2, r(R * 0.82), [[0, '#1e0c42'], [0.5, '#120830'], [1, '#0a0520']]);
    ctx.fill();
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * 0.82), 0, Math.PI * 2); ctx.strokeStyle = 'rgba(88,20,188,0.32)'; ctx.lineWidth = r(1.2); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const mid = (Math.PI * 2 / 5) * i + Math.PI / 2, half = (Math.PI * 2 / 5) * 0.42;
      ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * 0.78), mid - half, mid + half, false);
      ctx.arc(x(cx), y(cy), r(R * 0.22), mid + half, mid - half, true); ctx.closePath();
      ctx.fillStyle = '#02000a'; ctx.fill();
      ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * 0.78), mid - half, mid + half, false);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,93,13,0.42)' : 'rgba(142,40,255,0.42)'; ctx.lineWidth = r(1.4); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * 0.21), 0, Math.PI * 2);
    ctx.fillStyle = rg(ctx, x(cx - R * 0.09), y(cy - R * 0.11), 1, r(R * 0.21), [[0, '#3e1a72'], [0.5, '#1e0c42'], [1, '#0d0622']]);
    ctx.fill();
    ctx.save(); ctx.shadowColor = 'rgba(255,108,18,0.55)'; ctx.shadowBlur = r(9);
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * 0.20), 0, Math.PI * 2);
    ctx.strokeStyle = lg(ctx, x(cx - R * 0.21), y(cy - R * 0.21), x(cx + R * 0.21), y(cy + R * 0.21), [[0, 'rgba(255,172,48,1)'], [0.4, 'rgba(198,72,255,0.78)'], [1, 'rgba(255,98,26,0.4)']]);
    ctx.lineWidth = r(2.5); ctx.stroke(); ctx.restore();
    [0.14, 0.10].forEach(rv => { ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * rv), 0, Math.PI * 2); ctx.strokeStyle = 'rgba(68,16,142,0.36)'; ctx.lineWidth = r(0.9); ctx.stroke(); });
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * 0.07), 0, Math.PI * 2); ctx.fillStyle = '#01000b'; ctx.fill();
    ctx.beginPath(); ctx.arc(x(cx), y(cy), r(R * 0.07), 0, Math.PI * 2);
    ctx.strokeStyle = lg(ctx, x(cx - 5), y(cy - 5), x(cx + 5), y(cy + 5), [[0, 'rgba(255,198,78,0.85)'], [0.5, 'rgba(192,92,255,0.65)'], [1, 'rgba(255,93,23,0.35)']]);
    ctx.lineWidth = r(1.8); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x(cx - R * 0.038), y(cy - R * 0.042), r(R * 0.028), r(R * 0.019), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.52)'; ctx.fill();
  }
  drawReel(130, 88, 68);
  drawReel(248, 78, 76);

  // Wordmark
  if (showText) {
    const tg = ctx.createLinearGradient(textX, 0, textX + 400, 0);
    tg.addColorStop(0, '#FF7A2F'); tg.addColorStop(0.45, '#DD44FF'); tg.addColorStop(1, '#8B2FFF');
    ctx.save();
    ctx.shadowColor = 'rgba(180,50,255,0.38)'; ctx.shadowBlur = 28;
    ctx.font = `bold ${fontSize}px Georgia,'Times New Roman',serif`;
    ctx.fillStyle = tg;
    const tw = ctx.measureText('CUERATES').width;
    ctx.fillText('CUERATES', textX, textY);
    ctx.restore();
    // Divider rule
    const ruleMid = textX + tw / 2;
    const rule = ctx.createLinearGradient(ruleMid - tw * 0.55, 0, ruleMid + tw * 0.55, 0);
    rule.addColorStop(0, 'rgba(255,255,255,0)'); rule.addColorStop(0.2, 'rgba(255,110,20,0.65)');
    rule.addColorStop(0.8, 'rgba(140,40,255,0.5)'); rule.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = rule; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(ruleMid - tw * 0.55, textY + 16); ctx.lineTo(ruleMid + tw * 0.55, textY + 16); ctx.stroke();
    // Tagline
    ctx.font = `500 ${tagSize}px 'Courier New',monospace`;
    const tag = 'YOUR MOVIE JOURNAL';
    const tagW = ctx.measureText(tag).width + (tag.length - 1) * 3;
    ctx.fillStyle = 'rgba(195,135,255,0.85)';
    ctx.fillText(tag, textX + (tw - tagW) / 2, textY + 16 + tagSize + 6);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Renders the Cuerates logo onto the supplied canvas element.
 * @param {HTMLCanvasElement} canvas  — target canvas element
 * @param {'hero'|'logo'|'navbar'|'icon'} size — preset to use
 */
export function drawCueratesLogo(canvas, size = 'logo') {
  const preset = SIZE_PRESETS[size];
  if (!preset) {
    console.warn(`[drawCueratesLogo] Unknown size "${size}". Use: hero | logo | navbar | icon`);
    return;
  }
  drawScene(canvas, preset);
}

/**
 * Returns a PNG dataURL of the icon-sized logo, rendered on an offscreen canvas.
 * Suitable for injecting as the page favicon.
 */
export function getCueratesIconDataURL() {
  const offscreen = document.createElement('canvas');
  drawScene(offscreen, SIZE_PRESETS.icon);
  return offscreen.toDataURL('image/png');
}
