// crease / prints.js — the ten card prints and their kraft backs.
//
// Every front is a layered paper collage: a mounted card, 3+ value steps, a contrasting accent, a lip and a short
// shadow on each cut layer, one quiet fibre, an ornament, and registration crosses on the fold lines. The back is kraft
// with a faint mirrored ghost of the front, a pre-mirrored specimen stamp (so it reads after the fold) and its own
// registration marks.

import { printCard, shade, rgba, mix, fillLeaf, fillLimb } from 'papercraft/lib/paperkit-2d.js';
import { clipHalf, bbox } from './geometry.js';

const TAU = Math.PI * 2;

function path(pts) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

function rrPath(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else {
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
}

function regMark(P, x, y, s = 0.045, alpha = 0.52) {
  P.draw((g) => {
    g.strokeStyle = rgba('#3a2718', alpha);
    g.lineWidth = 0.006;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - s, y); g.lineTo(x + s, y);
    g.moveTo(x, y - s); g.lineTo(x, y + s);
    g.stroke();
    g.fillStyle = rgba('#b9553a', alpha * 0.9);
    g.beginPath(); g.arc(x, y, 0.009, 0, TAU); g.fill();
  });
}

function scoreLine(P, a, b) {
  P.draw((g) => {
    g.save();
    g.lineCap = 'round';
    g.setLineDash([0.032, 0.025]);
    g.lineWidth = 0.012;
    g.strokeStyle = rgba('#f8e9c8', 0.34);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.lineWidth = 0.0045;
    g.strokeStyle = rgba('#4a2c1a', 0.26);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.restore();
  });
}

function plateLabel(P, text, x, y, size = 0.072, alpha = 0.55) {
  P.draw((g) => {
    g.fillStyle = rgba('#3a2718', alpha);
    g.font = `600 ${size}px Georgia, 'Times New Roman', serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (g.letterSpacing !== undefined) g.letterSpacing = `${size * 0.16}px`;
    g.fillText(text, x, y);
  });
}

function cornerTicks(P, x, y, w, h, alpha = 0.32) {
  P.draw((g) => {
    g.strokeStyle = rgba('#3a2718', alpha);
    g.lineWidth = 0.007;
    g.lineCap = 'round';
    const k = Math.min(w, h) * 0.07;
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1]]) {
      g.beginPath(); g.moveTo(cx + sx * k, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + sy * k); g.stroke();
    }
  });
}

function mount(P, x, y, w, h, color, inner) {
  P.layer((g) => {
    rrPath(g, x, y, w, h, 0.04);
    g.fillStyle = color;
    g.fill();
  }, color, { rim: 0.65, lip: 0.55, shade: 0.45, shadow: 0.55, depth: 0.65 });
  P.layer((g) => {
    rrPath(g, x + 0.055, y + 0.055, w - 0.11, h - 0.11, 0.025);
    g.fillStyle = inner;
    g.fill();
  }, inner, { rim: 0.35, lip: 0.45, shade: 0.35, shadow: 0.45, depth: 0.5 });
  cornerTicks(P, x + 0.09, y + 0.09, w - 0.18, h - 0.18);
}

// ---------------------------------------------------------------------------------------------------------------
// I. the moth — ochre wings, moss bands, coral eyespots
// ---------------------------------------------------------------------------------------------------------------
function paintMoth(P, level) {
  const b = P.box;
  P.gradient(shade('#e6cfa0', 0.10), shade('#d5b982', -0.12), 0.55);
  P.felt(0.34);
  mount(P, b.x0 + 0.07, b.y0 + 0.07, b.w - 0.14, b.h - 0.14, '#b9a06a', '#e8d7ae');

  const ochre = '#c48c3f', ochreDark = '#9a6a2f', moss = '#5d6a3a', coral = '#b9553a', cream = '#f2e1b9', ink = '#3a2718';
  const wing = (mirror) => (g) => {
    g.save();
    if (mirror) { g.translate(0.2, 0); g.scale(-0.84, 1); g.translate(-0.2, 0); }
    g.beginPath();
    g.moveTo(0.19, 0.52);
    g.bezierCurveTo(-0.22, 0.96, -1.05, 1.02, -1.55, 0.62);
    g.bezierCurveTo(-1.36, 0.26, -1.0, 0.03, -0.62, 0.02);
    g.bezierCurveTo(-1.02, -0.2, -1.3, -0.55, -1.32, -0.88);
    g.bezierCurveTo(-0.78, -0.82, -0.24, -0.56, 0.19, -0.44);
    g.closePath();
    g.fillStyle = ochre;
    g.fill();
    g.restore();
  };
  for (const m of [false, true]) {
    P.layer(wing(m), ochre, { rim: 0.72, lip: 0.9, shade: 0.6, shadow: 0.75, depth: 1.25 });
  }
  // a darker band laid insets the wing
  const band = (mirror) => (g) => {
    g.save();
    if (mirror) { g.translate(0.2, 0); g.scale(-0.84, 1); g.translate(-0.2, 0); }
    g.beginPath();
    g.moveTo(0.05, 0.44);
    g.bezierCurveTo(-0.32, 0.74, -0.92, 0.78, -1.32, 0.56);
    g.bezierCurveTo(-1.12, 0.3, -0.84, 0.16, -0.53, 0.13);
    g.bezierCurveTo(-0.86, -0.06, -1.04, -0.28, -1.08, -0.55);
    g.bezierCurveTo(-0.68, -0.52, -0.26, -0.36, 0.06, -0.26);
    g.closePath();
    g.fillStyle = moss;
    g.fill();
    g.restore();
  };
  for (const m of [false, true]) P.layer(band(m), moss, { rim: 0.35, lip: 0.6, shade: 0.4, shadow: 0.55, depth: 0.85 });

  // eyespots
  for (const m of [false, true]) {
    const ex = m ? 1.28 : -1.28, ey = 0.42;
    P.layer((g) => { g.fillStyle = coral; g.beginPath(); g.arc(ex, ey, 0.2, 0, TAU); g.fill(); }, coral, { rim: 0.5, lip: 0.7, shadow: 0.55, depth: 0.8 });
    P.layer((g) => { g.fillStyle = cream; g.beginPath(); g.arc(ex, ey, 0.125, 0, TAU); g.fill(); }, cream, { lip: 0.6, shadow: 0.4, depth: 0.7 });
    P.draw((g) => {
      g.strokeStyle = rgba(ink, 0.68); g.lineWidth = 0.018; g.beginPath(); g.arc(ex, ey, 0.075, 0, TAU); g.stroke();
      g.fillStyle = rgba(ink, 0.78); g.beginPath(); g.arc(ex, ey, 0.026, 0, TAU); g.fill();
    });
  }

  // body, head, antennae, legs
  P.layer((g) => {
    g.beginPath();
    g.moveTo(0.19, 0.66);
    g.bezierCurveTo(0.32, 0.46, 0.3, 0.06, 0.29, -0.24);
    g.bezierCurveTo(0.28, -0.48, 0.22, -0.62, 0.16, -0.7);
    g.bezierCurveTo(0.08, -0.58, 0.07, -0.42, 0.07, -0.2);
    g.bezierCurveTo(0.07, 0.12, 0.09, 0.46, 0.19, 0.66);
    g.closePath();
    g.fillStyle = ochreDark;
    g.fill();
  }, ochreDark, { rim: 0.55, lip: 0.75, shadow: 0.7, depth: 1.15 });
  P.draw((g) => {
    g.fillStyle = rgba(cream, 0.62);
    for (let k = 0; k < 5; k++) {
      const y = 0.46 - k * 0.19;
      g.beginPath(); g.ellipse(0.18, y, 0.085, 0.026, 0, 0, TAU); g.fill();
    }
    g.strokeStyle = rgba(ink, 0.72); g.lineWidth = 0.014; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0.16, 0.66); g.bezierCurveTo(0.0, 0.82, -0.14, 0.92, -0.28, 0.96); g.stroke();
    g.beginPath(); g.moveTo(0.22, 0.66); g.bezierCurveTo(0.36, 0.84, 0.5, 0.92, 0.64, 0.94); g.stroke();
    for (let k = 0; k < 3; k++) {
      const y = 0.34 - k * 0.2;
      g.beginPath(); g.moveTo(0.09, y); g.lineTo(-0.14, y - 0.1); g.stroke();
      g.beginPath(); g.moveTo(0.27, y); g.lineTo(0.5, y - 0.1); g.stroke();
    }
    // wing veins and flecks
    g.strokeStyle = rgba(ink, 0.28); g.lineWidth = 0.009;
    for (let k = 0; k < 5; k++) {
      const x = -0.55 - k * 0.19;
      g.beginPath(); g.moveTo(0.02, 0.24); g.quadraticCurveTo(x * 0.7, 0.6, x, 0.74 - k * 0.03); g.stroke();
      g.beginPath(); g.moveTo(0.02, -0.2); g.quadraticCurveTo(x * 0.7, -0.52, x, -0.66 + k * 0.03); g.stroke();
    }
    g.fillStyle = rgba(cream, 0.55);
    for (let k = 0; k < 9; k++) {
      const a = 0.3 + k * 0.11, rr = 1.12 + (k % 2) * 0.12;
      g.beginPath(); g.arc(Math.cos(a + Math.PI) * rr, Math.sin(a) * 0.7, 0.02, 0, TAU); g.fill();
      g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * 0.7, 0.02, 0, TAU); g.fill();
    }
  });
  P.marks('dot', { color: rgba(ink, 0.5), alpha: 0.22, size: 0.012, density: 0.45 });

  for (const c of level.creases) scoreLine(P, c.a, c.b);
  for (const c of level.creases) { regMark(P, c.a[0], c.a[1]); regMark(P, c.b[0], c.b[1]); }
  regMark(P, 0.2, 0);
  plateLabel(P, 'PL. I', b.x0 + 0.3, b.y0 + 0.2, 0.068, 0.52);
  plateLabel(P, 'MOTH', b.x1 - 0.32, b.y0 + 0.2, 0.058, 0.4);
  P.innerShade(shade('#5a3a22', -0.1), { alpha: 0.22, blurPx: 10, dx: 0.01, dy: -0.012 });
}

// ---------------------------------------------------------------------------------------------------------------
// II. the dragonfly — moss body, teal wings, coral eyes
// ---------------------------------------------------------------------------------------------------------------
function paintDragonfly(P, level) {
  const b = P.box;
  P.gradient(shade('#dfc99a', 0.10), shade('#c9ae78', -0.12), 0.5);
  P.felt(0.34);
  // the T-shaped mount: one field on the wing bar, one on the body
  P.layer((g) => { rrPath(g, -1.62, 0.42, 3.24, 0.66, 0.035); g.fillStyle = '#cdb47c'; g.fill(); }, '#cdb47c', { rim: 0.6, lip: 0.5, shadow: 0.5, depth: 0.6 });
  P.layer((g) => { rrPath(g, -0.52, -1.27, 1.04, 1.62, 0.03); g.fillStyle = '#d8c18d'; g.fill(); }, '#d8c18d', { rim: 0.5, lip: 0.45, shadow: 0.45, depth: 0.6 });
  P.draw((g) => {
    g.strokeStyle = rgba('#3a2718', 0.32); g.lineWidth = 0.008;
    g.strokeRect(-1.53, 0.51, 3.06, 0.48);
    g.strokeRect(-0.44, -1.18, 0.88, 1.44);
  });

  const moss = '#5c6a3c', mossDark = '#45502e', teal = '#4f807b', tealDark = '#3c625f', ochre = '#c79a45', coral = '#b9553a', cream = '#f0e0b8', ink = '#3a2718';

  // four wings, each its own cut layer
  const wings = [
    { x: 0, y: 0.83, L: 1.55, a: Math.PI - 0.18, wf: 0.19, tone: teal },
    { x: 0, y: 0.7, L: 1.48, a: Math.PI + 0.12, wf: 0.17, tone: tealDark },
    { x: 0, y: 0.83, L: 1.55, a: 0.18, wf: 0.19, tone: teal },
    { x: 0, y: 0.7, L: 1.48, a: -0.12, wf: 0.17, tone: tealDark },
  ];
  for (const w of wings) {
    P.layer((g) => { g.fillStyle = w.tone; fillLeaf(g, w.x, w.y, w.L, w.a, w.wf); }, w.tone, { rim: 0.55, lip: 0.8, shade: 0.55, shadow: 0.6, depth: 0.95 });
  }
  // wing veins: a midrib and short cross ribs
  P.draw((g) => {
    g.strokeStyle = rgba(cream, 0.5); g.lineWidth = 0.011; g.lineCap = 'round';
    for (const w of wings) {
      const ex = w.x + Math.cos(w.a) * w.L, ey = w.y + Math.sin(w.a) * w.L;
      g.beginPath(); g.moveTo(w.x, w.y); g.quadraticCurveTo(w.x + Math.cos(w.a) * w.L * 0.5, w.y + Math.sin(w.a) * w.L * 0.5 + 0.04, ex, ey); g.stroke();
      for (let k = 1; k <= 5; k++) {
        const t = k / 6, cx = w.x + Math.cos(w.a) * w.L * t, cy = w.y + Math.sin(w.a) * w.L * t;
        const nx = -Math.sin(w.a), ny = Math.cos(w.a);
        g.lineWidth = 0.007;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + nx * 0.16, cy + ny * 0.16); g.stroke();
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - nx * 0.16, cy - ny * 0.16); g.stroke();
      }
    }
  });
  // body along the stem
  P.layer((g) => {
    g.fillStyle = moss;
    fillLimb(g, 0, -1.2, 0.03, -0.25, 0.0, 0.78, 0.11, 0.24, 18);
  }, moss, { rim: 0.55, lip: 0.8, shadow: 0.7, depth: 1.0 });
  P.layer((g) => {
    g.fillStyle = mossDark;
    fillLimb(g, 0, -1.0, 0.02, -0.1, 0.0, 0.62, 0.05, 0.13, 14);
  }, mossDark, { lip: 0.4, shadow: 0.4, depth: 0.6 });
  P.layer((g) => { g.fillStyle = coral; g.beginPath(); g.arc(0, 0.83, 0.15, 0, TAU); g.fill(); }, coral, { rim: 0.55, lip: 0.8, shadow: 0.6, depth: 0.9 });
  P.draw((g) => {
    g.strokeStyle = rgba(ink, 0.5); g.lineWidth = 0.008;
    for (let k = 0; k < 7; k++) {
      const y = 0.55 - k * 0.24;
      g.beginPath(); g.moveTo(-0.12, y); g.quadraticCurveTo(0, y - 0.04, 0.12, y); g.stroke();
    }
    g.strokeStyle = rgba(cream, 0.55); g.lineWidth = 0.012;
    g.beginPath(); g.moveTo(0, 0.66); g.quadraticCurveTo(0.02, 0.1, 0, -1.1); g.stroke();
    // eyes
    g.fillStyle = rgba(cream, 0.8);
    g.beginPath(); g.arc(-0.055, 0.86, 0.035, 0, TAU); g.fill();
    g.beginPath(); g.arc(0.055, 0.86, 0.035, 0, TAU); g.fill();
    g.fillStyle = rgba(ink, 0.8);
    g.beginPath(); g.arc(-0.055, 0.86, 0.016, 0, TAU); g.fill();
    g.beginPath(); g.arc(0.055, 0.86, 0.016, 0, TAU); g.fill();
  });
  P.marks('dot', { color: rgba(cream, 0.5), alpha: 0.3, size: 0.015, density: 0.5, region: { x0: -1.4, y0: 0.5, x1: 1.4, y1: 1.0 } });
  P.marks('dot', { color: rgba(ink, 0.45), alpha: 0.2, size: 0.012, density: 0.3 });

  for (const c of level.creases) scoreLine(P, c.a, c.b);
  for (const c of level.creases) { regMark(P, c.a[0], c.a[1]); regMark(P, c.b[0], c.b[1]); }
  regMark(P, 0, 0.35);
  plateLabel(P, 'PL. II', b.x0 + 0.32, b.y0 + 0.18, 0.066, 0.52);
  plateLabel(P, 'DRAGONFLY', b.x1 - 0.44, b.y0 + 0.18, 0.052, 0.4);
  P.innerShade(shade('#5a3a22', -0.1), { alpha: 0.22, blurPx: 10, dx: 0.01, dy: -0.012 });
}

// ---------------------------------------------------------------------------------------------------------------
// III. the leaf — a botanical plate on the diagonal
// ---------------------------------------------------------------------------------------------------------------
function paintLeaf(P, level) {
  const b = P.box;
  P.gradient(shade('#e7d2a6', 0.10), shade('#d3b77e', -0.12), 0.5);
  P.felt(0.34);
  mount(P, b.x0 + 0.08, b.y0 + 0.08, b.w - 0.16, b.h - 0.16, '#b39a63', '#ead9b1');

  const A = level.creases[0].a, C = level.creases[0].b;
  const dx = C[0] - A[0], dy = C[1] - A[1], len = Math.hypot(dx, dy);
  const d = [dx / len, dy / len], n = [-d[1], d[0]];
  const start = [A[0] + d[0] * 0.14, A[1] + d[1] * 0.14];
  const L = len - 0.24;
  const left = [], right = [];
  const N = 70;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const c = [start[0] + d[0] * L * u, start[1] + d[1] * L * u];
    const w = 0.6 * Math.pow(Math.sin(Math.PI * u), 0.62) * (1 - 0.16 * u) + 0.012;
    left.push([c[0] + n[0] * w, c[1] + n[1] * w]);
    right.push([c[0] - n[0] * w, c[1] - n[1] * w]);
  }
  const outline = left.concat(right.reverse());

  const moss = '#5e6b3d', mossLight = '#7f8c50', mossDark = '#4c5832', ochre = '#c69a46', coral = '#b9553a', cream = '#f1e1b9', ink = '#3a2718';

  // stem
  P.layer((g) => {
    g.strokeStyle = ochre; g.lineWidth = 0.055; g.lineCap = 'round';
    g.beginPath(); g.moveTo(A[0], A[1]); g.quadraticCurveTo(A[0] + d[0] * 0.1, A[1] + d[1] * 0.1, start[0], start[1]); g.stroke();
  }, ochre, { lip: 0.5, shadow: 0.4, depth: 0.7 });
  // leaf body
  P.layer(path(outline), moss, { rim: 0.7, lip: 0.85, shade: 0.5, shadow: 0.7, depth: 1.15 });
  // the upper-left half as its own darker cut layer (the flap)
  const upper = clipHalf(outline, A, C, 1);
  if (upper) P.layer(path(upper), mossLight, { rim: 0.3, lip: 0.55, shade: 0.35, shadow: 0.45, depth: 0.75 });
  // veins
  P.draw((g) => {
    g.strokeStyle = rgba(cream, 0.55); g.lineWidth = 0.012; g.lineCap = 'round';
    g.beginPath(); g.moveTo(start[0], start[1]); g.lineTo(start[0] + d[0] * L, start[1] + d[1] * L); g.stroke();
    for (let k = 1; k <= 8; k++) {
      const u = k / 9;
      const c = [start[0] + d[0] * L * u, start[1] + d[1] * L * u];
      const w = 0.6 * Math.pow(Math.sin(Math.PI * u), 0.62) * (1 - 0.16 * u) + 0.012;
      g.lineWidth = 0.008;
      g.beginPath();
      g.moveTo(c[0], c[1]);
      g.quadraticCurveTo(c[0] + n[0] * w * 0.55 + d[0] * 0.08, c[1] + n[1] * w * 0.55 + d[1] * 0.08, c[0] + n[0] * w * 0.92, c[1] + n[1] * w * 0.92);
      g.stroke();
      g.beginPath();
      g.moveTo(c[0], c[1]);
      g.quadraticCurveTo(c[0] - n[0] * w * 0.55 + d[0] * 0.08, c[1] - n[1] * w * 0.55 + d[1] * 0.08, c[0] - n[0] * w * 0.92, c[1] - n[1] * w * 0.92);
      g.stroke();
    }
    g.strokeStyle = rgba(ink, 0.35); g.lineWidth = 0.006;
    g.beginPath(); g.moveTo(start[0], start[1]); g.lineTo(start[0] + d[0] * L, start[1] + d[1] * L); g.stroke();
  });
  // berries near the base
  for (let k = 0; k < 4; k++) {
    const t = 0.16 + k * 0.06;
    const c = [start[0] + d[0] * L * t + n[0] * (0.16 + k * 0.07), start[1] + d[1] * L * t + n[1] * (0.16 + k * 0.07)];
    P.layer((g) => { g.fillStyle = coral; g.beginPath(); g.arc(c[0], c[1], 0.07, 0, TAU); g.fill(); }, coral, { rim: 0.45, lip: 0.7, shadow: 0.5, depth: 0.65 });
    P.draw((g) => { g.fillStyle = rgba(cream, 0.75); g.beginPath(); g.arc(c[0] - 0.018, c[1] + 0.018, 0.022, 0, TAU); g.fill(); });
  }
  // a small ochre flower ornament on the lower half
  {
    const c = [start[0] + d[0] * L * 0.5 - n[0] * 0.2, start[1] + d[1] * L * 0.5 - n[1] * 0.2];
    P.layer((g) => {
      g.fillStyle = ochre;
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * TAU + 0.3;
        g.beginPath(); g.ellipse(c[0] + Math.cos(a) * 0.06, c[1] + Math.sin(a) * 0.06, 0.075, 0.042, a, 0, TAU); g.fill();
      }
    }, ochre, { lip: 0.7, shadow: 0.5, depth: 0.7 });
    P.draw((g) => { g.fillStyle = rgba(ink, 0.75); g.beginPath(); g.arc(c[0], c[1], 0.032, 0, TAU); g.fill(); });
  }
  P.marks('dot', { color: rgba(ink, 0.45), alpha: 0.18, size: 0.012, density: 0.35 });

  for (const c of level.creases) scoreLine(P, c.a, c.b);
  for (const c of level.creases) { regMark(P, c.a[0], c.a[1]); regMark(P, c.b[0], c.b[1]); }
  regMark(P, 0, 0);
  plateLabel(P, 'PL. III', b.x0 + 0.34, b.y0 + 0.2, 0.066, 0.52);
  plateLabel(P, 'FOLDED LEAF', b.x1 - 0.48, b.y0 + 0.2, 0.05, 0.4);
  P.innerShade(shade('#5a3a22', -0.1), { alpha: 0.22, blurPx: 10, dx: 0.01, dy: -0.012 });
}

// ---------------------------------------------------------------------------------------------------------------
// shared helpers for the later plates
// ---------------------------------------------------------------------------------------------------------------
const INKC = '#3a2718';
const CREAMC = '#f4e6c8';

function tbox(level) { return bbox(level.target); }
function tshape(level) { return path(level.target); }
function disc(P, x, y, r, color, opts = {}) {
  P.layer((g) => { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }, color, opts);
}
function shape(P, pts, color, opts = {}) { P.layer(path(pts), color, opts); }
function starPoly(cx, cy, ro, ri, n = 4, rot = Math.PI / 2) {
  const pts = [];
  for (let k = 0; k < n * 2; k++) {
    const a = rot + k * Math.PI / n;
    const r = k % 2 ? ri : ro;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
function finishPlate(P, level, lx, ly, s = 0.055) {
  for (const c of level.creases) scoreLine(P, c.a, c.b);
  for (const c of level.creases) { regMark(P, c.a[0], c.a[1]); regMark(P, c.b[0], c.b[1]); }
  plateLabel(P, `PL. ${level.page}`, lx, ly, s, 0.55);
  P.innerShade(shade('#5a3a22', -0.1), { alpha: 0.22, blurPx: 10, dx: 0.01, dy: -0.012 });
}

// ---------------------------------------------------------------------------------------------------------------
// IV. the heron — a dawn marsh, a pale bird, a moss wing
// ---------------------------------------------------------------------------------------------------------------
function paintHeron(P, level) {
  const b = P.box, tb = tbox(level);
  P.gradient(shade('#d8ddc6', 0.10), shade('#b7c3a8', -0.12), 0.45);
  P.felt(0.38);

  disc(P, tb.cx - 0.12, tb.cy + 0.55, 1.06, '#d9c088', { rim: 0.35, lip: 0.55, shade: 0.4, shadow: 0.35, depth: 0.7 });
  disc(P, tb.cx - 0.12, tb.cy + 0.55, 0.86, '#e7d5a7', { lip: 0.4, shadow: 0.3, depth: 0.5 });

  P.draw((g) => {
    g.strokeStyle = rgba('#416a68', 0.42);
    g.lineWidth = 0.018;
    g.lineCap = 'round';
    const x0 = tb.x0 - 0.55, x1 = tb.x1 + 0.4;
    for (let k = 0; k < 7; k++) {
      const y = tb.y0 + 0.06 + k * 0.105;
      g.beginPath();
      g.moveTo(x0, y);
      for (let x = x0; x <= x1; x += 0.2) g.quadraticCurveTo(x + 0.05, y + 0.05, x + 0.1, y);
      g.stroke();
    }
    g.strokeStyle = rgba('#6d7c46', 0.62);
    g.lineWidth = 0.016;
    for (let k = 0; k < 5; k++) {
      const x = tb.x0 - 0.18 + k * 0.16;
      g.beginPath();
      g.moveTo(x, tb.y0 + 0.06);
      g.quadraticCurveTo(x - 0.07, tb.y0 + 0.55, x + 0.02, tb.y0 + 0.95);
      g.stroke();
      g.fillStyle = rgba('#7d6a3b', 0.6);
      g.beginPath(); g.ellipse(x + 0.03, tb.y0 + 0.97, 0.035, 0.075, -0.2, 0, TAU); g.fill();
    }
  });

  shape(P, level.target, '#c8b375', { rim: 0.7, lip: 0.85, shade: 0.5, shadow: 0.7, depth: 1.1 });
  // a darker back and crown give the long neck its Heron read
  shape(P, [[0.38, 0.58], [0.22, 1.2], [0.08, 1.17], [0.16, 0.5]], '#a08048', { lip: 0.4, shadow: 0.4, depth: 0.6 });
  shape(P, [[-0.48, 1.28], [0.02, 1.4], [0.05, 1.2], [-0.4, 1.12]], '#9a7b45', { lip: 0.4, shadow: 0.35, depth: 0.55 });
  P.layer((g) => {
    g.beginPath();
    g.moveTo(0.05, -0.2);
    g.bezierCurveTo(0.3, -0.1, 0.62, -0.25, 0.72, -0.6);
    g.bezierCurveTo(0.78, -0.95, 0.55, -1.15, 0.28, -1.18);
    g.bezierCurveTo(0.02, -1.2, -0.15, -0.85, -0.08, -0.55);
    g.bezierCurveTo(-0.04, -0.4, 0, -0.28, 0.05, -0.2);
    g.closePath();
    g.fillStyle = '#77864b';
    g.fill();
  }, '#77864b', { rim: 0.4, lip: 0.6, shade: 0.4, shadow: 0.55, depth: 0.85 });
  shape(P, [[-0.52, 1.28], [-0.98, 1.06], [-0.46, 0.9]], '#b9553a', { rim: 0.4, lip: 0.55, shadow: 0.4, depth: 0.55 });

  P.draw((g) => {
    // neck stripe and throat
    g.strokeStyle = rgba('#f3e4bd', 0.62);
    g.lineWidth = 0.045;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(-0.05, 0.45); g.quadraticCurveTo(-0.02, 0.95, -0.18, 1.22); g.stroke();
    // wing feathers
    g.lineWidth = 0.010;
    g.strokeStyle = rgba('#3a2718', 0.3);
    for (let k = 0; k < 5; k++) {
      const y = -1.05 + k * 0.16;
      g.beginPath(); g.moveTo(-0.1, y); g.quadraticCurveTo(0.25, y - 0.08, 0.55, y - 0.02); g.stroke();
    }
    // eye and brow
    g.fillStyle = rgba('#f7edd4', 0.9);
    g.beginPath(); g.arc(-0.27, 1.15, 0.055, 0, TAU); g.fill();
    g.fillStyle = rgba('#2f2116', 0.9);
    g.beginPath(); g.arc(-0.27, 1.15, 0.026, 0, TAU); g.fill();
    // beak line
    g.strokeStyle = rgba('#3a2718', 0.5);
    g.lineWidth = 0.012;
    g.beginPath(); g.moveTo(-0.48, 1.21); g.lineTo(-0.93, 1.06); g.stroke();
    // the dark back of the neck
    g.strokeStyle = rgba('#5a4326', 0.42);
    g.lineWidth = 0.022;
    g.beginPath(); g.moveTo(0.33, 0.58); g.quadraticCurveTo(0.26, 0.95, 0.14, 1.3); g.stroke();
    // tail feathers
    g.strokeStyle = rgba('#5a4326', 0.34);
    g.lineWidth = 0.009;
    for (let k = 0; k < 4; k++) {
      g.beginPath(); g.moveTo(0.55, -0.9 + k * 0.12); g.lineTo(0.88, -0.98 + k * 0.12); g.stroke();
    }
    // breast flecks
    g.fillStyle = rgba('#f3e4bd', 0.55);
    for (let k = 0; k < 5; k++) {
      g.beginPath(); g.arc(-0.42 + k * 0.09, -0.2 - k * 0.16, 0.018, 0, TAU); g.fill();
    }
  });

  // the wing tab: a small fish, printed where the fold happens
  P.draw((g) => {
    g.strokeStyle = rgba('#3a2718', 0.4);
    g.lineWidth = 0.009;
    g.beginPath();
    g.moveTo(1.02, -0.86);
    g.quadraticCurveTo(1.25, -0.78, 1.42, -0.88);
    g.quadraticCurveTo(1.28, -1.02, 1.02, -0.86);
    g.stroke();
    g.fillStyle = rgba('#b9553a', 0.55);
    g.beginPath(); g.arc(1.34, -0.87, 0.014, 0, TAU); g.fill();
  });

  finishPlate(P, level, -0.42, -1.2, 0.04);
  plateLabel(P, 'HERON', tb.x1 - 0.34, -1.24, 0.036, 0.4);
}

// ---------------------------------------------------------------------------------------------------------------
// V. the house — warm clay, a moss roof, a coral door
// ---------------------------------------------------------------------------------------------------------------
function paintHouse(P, level) {
  const b = P.box, tb = tbox(level);
  P.gradient(shade('#e7cfa4', 0.10), shade('#cdb17a', -0.12), 0.5);
  P.felt(0.36);

  shape(P, level.target, '#cfa163', { rim: 0.7, lip: 0.85, shade: 0.5, shadow: 0.7, depth: 1.15 });
  shape(P, [[-1.12, 0.32], [1.12, 0.32], [0, 1.12]], '#667243', { rim: 0.45, lip: 0.7, shade: 0.4, shadow: 0.5, depth: 0.8 });
  P.marks('scallop', { color: rgba('#efe0c2', 0.5), alpha: 0.4, size: 0.055, density: 0.9, region: { x0: -0.9, y0: 0.42, x1: 0.9, y1: 1.0 }, width: 1.0 });

  // door and windows
  shape(P, [[-0.2, -1.0], [-0.2, -0.3], [0.2, -0.3], [0.2, -1.0]], '#b9553a', { rim: 0.4, lip: 0.65, shadow: 0.45, depth: 0.7 });
  P.draw((g) => {
    g.fillStyle = rgba('#3a2718', 0.65);
    g.beginPath(); g.arc(0.11, -0.62, 0.02, 0, TAU); g.fill();
    g.strokeStyle = rgba('#f0e0b8', 0.55);
    g.lineWidth = 0.012;
    g.strokeRect(-0.76, -0.62, 0.3, 0.3);
    g.strokeRect(0.46, -0.62, 0.3, 0.3);
    g.beginPath();
    g.moveTo(-0.61, -0.62); g.lineTo(-0.61, -0.32);
    g.moveTo(-0.76, -0.47); g.lineTo(-0.46, -0.47);
    g.moveTo(0.61, -0.62); g.lineTo(0.61, -0.32);
    g.moveTo(0.46, -0.47); g.lineTo(0.76, -0.47);
    g.stroke();
    g.strokeStyle = rgba('#3a2718', 0.35);
    g.lineWidth = 0.01;
    g.beginPath(); g.moveTo(-1.14, -0.86); g.quadraticCurveTo(0, -0.96, 1.14, -0.86); g.stroke();
  });

  // chimney on the fold tab, and its smoke
  shape(P, [[0.1022, 1.3014], [-0.0831, 1.6246], [-0.36, 0.96], [0, 1.2]], '#a8603e', { rim: 0.4, lip: 0.6, shadow: 0.45, depth: 0.65 });
  P.marks('brick', { color: rgba('#f0e0b8', 0.45), alpha: 0.45, size: 0.035, density: 1.1, region: { x0: -0.34, y0: 1.0, x1: 0.08, y1: 1.58 } });
  P.draw((g) => {
    g.strokeStyle = rgba('#5a4a32', 0.35);
    g.lineWidth = 0.012;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(-0.16, 1.62); g.bezierCurveTo(-0.38, 1.82, 0.06, 1.92, -0.2, 2.14); g.stroke();
    g.beginPath(); g.moveTo(0.02, 1.6); g.bezierCurveTo(0.24, 1.78, -0.02, 1.94, 0.16, 2.1); g.stroke();
    // garden sprigs at the foot
    g.strokeStyle = rgba('#5d6a3a', 0.6);
    g.lineWidth = 0.012;
    for (let k = 0; k < 6; k++) {
      const x = -1.0 + k * 0.4;
      g.beginPath(); g.moveTo(x, -1.0); g.quadraticCurveTo(x - 0.04, -0.82, x + 0.02, -0.68); g.stroke();
    }
  });

  finishPlate(P, level, -1.02, -0.2, 0.05);
  plateLabel(P, 'HOUSE', 0.55, -0.2, 0.04, 0.4);
}

// ---------------------------------------------------------------------------------------------------------------
// VI. the boat — a sea-green plate, ochre planks, a rope coil
// ---------------------------------------------------------------------------------------------------------------
function paintBoat(P, level) {
  const b = P.box, tb = tbox(level);
  P.gradient(shade('#d9e0cf', 0.10), shade('#aabdb2', -0.14), 0.45);
  P.felt(0.38);

  P.layer((g) => { g.fillStyle = '#8fb0a8'; g.fillRect(b.x0 - 1, tb.y0 - 0.5, b.w + 2, 1.3); }, '#8fb0a8', { lip: 0.25, shadow: 0.25, depth: 0.4 });
  P.marks('wave', { color: rgba('#f2e6c9', 0.5), alpha: 0.42, size: 0.075, density: 0.9, region: { x0: b.x0, y0: tb.y0 - 0.35, x1: b.x1, y1: tb.y0 + 0.55 }, width: 1.0 });
  disc(P, tb.cx + 0.7, tb.cy + 0.9, 0.28, '#e7cf96', { rim: 0.35, lip: 0.5, shadow: 0.35, depth: 0.6 });

  shape(P, level.target, '#c58f4b', { rim: 0.7, lip: 0.85, shade: 0.5, shadow: 0.7, depth: 1.1 });
  P.draw((g) => {
    g.save();
    g.clip(tshape(level));
    g.strokeStyle = rgba('#4f361f', 0.42);
    g.lineWidth = 0.014;
    for (let k = 0; k < 4; k++) {
      const y = -0.9 + k * 0.28;
      g.beginPath(); g.moveTo(-1.5, y); g.quadraticCurveTo(0, y + 0.06, 1.5, y); g.stroke();
    }
    g.strokeStyle = rgba('#f4e6c8', 0.5);
    g.lineWidth = 0.02;
    g.beginPath(); g.moveTo(-1.25, 0.82); g.lineTo(1.25, 0.82); g.stroke();
    g.restore();
    // rope coil
    g.strokeStyle = rgba('#6d5936', 0.7);
    g.lineWidth = 0.012;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0.85, -0.3, 0.1 + k * 0.035, 0, TAU); g.stroke(); }
    // small compass
    g.strokeStyle = rgba('#3a2718', 0.55);
    g.lineWidth = 0.01;
    g.beginPath(); g.arc(-0.82, -0.28, 0.14, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(-0.82, -0.4); g.lineTo(-0.76, -0.28); g.lineTo(-0.82, -0.16); g.lineTo(-0.88, -0.28); g.closePath(); g.stroke();
    // gulls
    g.strokeStyle = rgba('#3a2718', 0.55);
    g.lineWidth = 0.012;
    for (const [x, y] of [[-1.0, 0.9], [-0.6, 1.05], [1.2, 0.55]]) {
      g.beginPath(); g.moveTo(x - 0.09, y); g.quadraticCurveTo(x - 0.04, y + 0.06, x, y); g.quadraticCurveTo(x + 0.04, y + 0.06, x + 0.09, y); g.stroke();
    }
  });
  // the rudder tab
  shape(P, [[-1.0, -0.7], [-1.2682, -0.7045], [-1.6966, -1.1414], [-1.35, -1.1]], '#a8603e', { rim: 0.4, lip: 0.6, shadow: 0.45, depth: 0.65 });

  finishPlate(P, level, -1.2, 0.68, 0.05);
  plateLabel(P, 'BOAT', 0.48, 0.68, 0.04, 0.42);
}

// ---------------------------------------------------------------------------------------------------------------
// VII. the arrow — a dark teal field and a pale shaft
// ---------------------------------------------------------------------------------------------------------------
function paintArrow(P, level) {
  const b = P.box, tb = tbox(level);
  P.gradient(shade('#2a4e51', 0.03), shade('#173538', -0.10), 0.55);
  P.felt(0.3);
  P.marks('dot', { color: rgba('#d9c89e', 0.6), alpha: 0.32, size: 0.02, density: 0.6 });
  P.draw((g) => {
    g.strokeStyle = rgba('#d9c89e', 0.16);
    g.lineWidth = 0.008;
    for (let k = 0; k < 7; k++) {
      const y = b.y0 + 0.2 + k * 0.26;
      g.beginPath(); g.moveTo(b.x0 + 0.2, y); g.lineTo(b.x1 - 0.2, y + 0.16); g.stroke();
    }
  });

  shape(P, level.target, '#e7d8b2', { rim: 0.75, lip: 0.9, shade: 0.5, shadow: 0.75, depth: 1.2 });
  P.draw((g) => {
    g.save();
    g.clip(tshape(level));
    // the head is cut from a darker paper
    g.fillStyle = 'rgba(62,102,100,0.92)';
    g.beginPath(); g.moveTo(-1.7, 0); g.lineTo(0.2, 1.2); g.lineTo(0.2, -1.2); g.closePath(); g.fill();
    g.strokeStyle = rgba('#3a2718', 0.5);
    g.lineWidth = 0.014;
    g.beginPath(); g.moveTo(0.2, 1.2); g.lineTo(0.2, -1.2); g.stroke();
    g.strokeStyle = rgba('#b9553a', 0.8);
    g.lineWidth = 0.03;
    for (let k = 0; k < 3; k++) {
      const x = 1.24 + k * 0.13;
      g.beginPath(); g.moveTo(x, 0.46); g.quadraticCurveTo(x + 0.1, 0.2, x, -0.06); g.stroke();
    }
    g.fillStyle = rgba('#3a2718', 0.55);
    g.beginPath(); g.arc(0.62, 0, 0.035, 0, TAU); g.fill();
    g.restore();
  });
  // the fletching tab
  shape(P, [[1.7, -0.5], [1.8125, -0.8], [1.925, -0.5], [1.7, 0.1]], '#b9553a', { rim: 0.4, lip: 0.6, shadow: 0.45, depth: 0.6 });
  P.draw((g) => {
    g.strokeStyle = rgba('#f4e6c8', 0.6);
    g.lineWidth = 0.01;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(1.72, -0.42 + k * 0.17); g.lineTo(1.87, -0.42 + k * 0.17); g.stroke(); }
  });

  finishPlate(P, level, 0.55, -0.28, 0.045);
  plateLabel(P, 'ARROW', 1.02, 0.28, 0.036, 0.42);
}

// ---------------------------------------------------------------------------------------------------------------
// VIII. the fox — rust paper, cream cheeks, coral ears
// ---------------------------------------------------------------------------------------------------------------
function paintFox(P, level) {
  const b = P.box, tb = tbox(level);
  P.gradient(shade('#e5c99b', 0.10), shade('#cba774', -0.12), 0.5);
  P.felt(0.4);
  disc(P, tb.cx - 0.55, tb.cy + 0.35, 0.62, '#d8bd88', { rim: 0.3, lip: 0.5, shadow: 0.3, depth: 0.6 });

  shape(P, level.target, '#c8823f', { rim: 0.7, lip: 0.85, shade: 0.5, shadow: 0.7, depth: 1.1 });
  // inner ears
  shape(P, [[-0.86, 0.82], [-0.6, 0.5], [-0.76, 0.12]], '#b9553a', { lip: 0.5, shadow: 0.35, depth: 0.55 });
  shape(P, [[0.86, 0.82], [0.6, 0.5], [0.76, 0.12]], '#b9553a', { lip: 0.5, shadow: 0.35, depth: 0.55 });
  // cheeks
  shape(P, [[-0.72, -0.16], [-0.16, -0.34], [-0.38, -0.78], [-0.56, -0.52]], '#efdfba', { lip: 0.6, shadow: 0.4, depth: 0.6 });
  shape(P, [[0.72, -0.16], [0.16, -0.34], [0.38, -0.78], [0.56, -0.52]], '#efdfba', { lip: 0.6, shadow: 0.4, depth: 0.6 });
  // muzzle and nose
  shape(P, [[-0.2, -0.42], [0.2, -0.42], [0, -0.74]], '#e8d6ac', { lip: 0.55, shadow: 0.35, depth: 0.55 });
  P.draw((g) => {
    g.fillStyle = rgba('#2f2116', 0.9);
    g.beginPath(); g.arc(-0.36, 0.12, 0.045, 0, TAU); g.fill();
    g.beginPath(); g.arc(0.36, 0.12, 0.045, 0, TAU); g.fill();
    g.fillStyle = rgba('#f7edd4', 0.75);
    g.beginPath(); g.arc(-0.35, 0.14, 0.016, 0, TAU); g.fill();
    g.beginPath(); g.arc(0.37, 0.14, 0.016, 0, TAU); g.fill();
    g.fillStyle = rgba('#2f2116', 0.88);
    g.beginPath(); g.moveTo(-0.07, -0.48); g.lineTo(0.07, -0.48); g.lineTo(0, -0.58); g.closePath(); g.fill();
    // whisker lines
    g.strokeStyle = rgba('#3a2718', 0.35);
    g.lineWidth = 0.008;
    g.beginPath(); g.moveTo(-0.16, -0.55); g.lineTo(-0.52, -0.62); g.moveTo(0.16, -0.55); g.lineTo(0.52, -0.62); g.stroke();
    // leaf sprigs
    g.strokeStyle = rgba('#5d6a3a', 0.65);
    g.lineWidth = 0.01;
    g.beginPath(); g.moveTo(-1.05, -0.55); g.quadraticCurveTo(-1.3, -0.3, -1.28, 0.05); g.stroke();
    for (let k = 0; k < 3; k++) {
      g.fillStyle = rgba('#6f7c4c', 0.6);
      g.beginPath(); g.ellipse(-1.22 + k * 0.02, -0.3 + k * 0.15, 0.06, 0.028, -0.6, 0, TAU); g.fill();
    }
  });

  finishPlate(P, level, -0.62, -0.2, 0.045);
  plateLabel(P, 'FOX', 0.3, -0.2, 0.038, 0.42);
}

// ---------------------------------------------------------------------------------------------------------------
// IX. the compass — a midnight plate with a gold rose
// ---------------------------------------------------------------------------------------------------------------
function paintCompass(P, level) {
  const b = P.box, tb = tbox(level);
  P.gradient(shade('#25464a', 0.04), shade('#132c30', -0.12), 0.55);
  P.felt(0.3);
  P.marks('dot', { color: rgba('#d9c89e', 0.7), alpha: 0.4, size: 0.018, density: 0.7 });

  shape(P, level.target, '#1f4247', { rim: 0.75, lip: 0.9, shade: 0.45, shadow: 0.7, depth: 1.15 });
  P.draw((g) => {
    g.strokeStyle = rgba('#d9c89e', 0.35);
    g.lineWidth = 0.012;
    g.beginPath(); g.arc(0, 0, 0.78, 0, TAU); g.stroke();
    g.strokeStyle = rgba('#d9c89e', 0.22);
    g.lineWidth = 0.008;
    g.beginPath(); g.arc(0, 0, 0.66, 0, TAU); g.stroke();
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * TAU;
      const r0 = k % 3 === 0 ? 0.66 : 0.71, r1 = 0.78;
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.stroke();
    }
  });
  shape(P, starPoly(0, 0, 0.82, 0.2, 4, Math.PI / 2), '#c9a24a', { rim: 0.45, lip: 0.65, shade: 0.35, shadow: 0.4, depth: 0.7 });
  shape(P, starPoly(0, 0, 0.58, 0.15, 4, Math.PI / 4), '#e7d8b2', { rim: 0.3, lip: 0.5, shade: 0.3, shadow: 0.35, depth: 0.55 });
  disc(P, 0, 0, 0.11, '#b9553a', { rim: 0.4, lip: 0.6, shadow: 0.4, depth: 0.5 });
  P.draw((g) => {
    g.fillStyle = rgba('#e7d8b2', 0.8);
    g.beginPath(); g.arc(0, 0, 0.035, 0, TAU); g.fill();
    // cardinal letters
    g.fillStyle = rgba('#e7d8b2', 0.6);
    g.font = `600 0.075px Georgia, 'Times New Roman', serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', 0, 1.08);
    g.fillText('S', 0, -1.12);
    // wake lines from the needle
    g.strokeStyle = rgba('#d9c89e', 0.25);
    g.lineWidth = 0.008;
    for (let k = 0; k < 3; k++) {
      g.beginPath(); g.moveTo(-0.35 + k * 0.25, -1.58); g.lineTo(-0.2 + k * 0.25, -1.38); g.stroke();
    }
  });
  // the needle tab
  shape(P, [[0, -1.45], [0.0284, -1.5881], [0.1686, -1.5517], [0.17, -1.25]], '#c9a24a', { rim: 0.4, lip: 0.6, shadow: 0.4, depth: 0.6 });

  finishPlate(P, level, -0.42, -0.88, 0.04);
}

// ---------------------------------------------------------------------------------------------------------------
// X. the crest — the menagerie's shield, a moth, a coral ribbon
// ---------------------------------------------------------------------------------------------------------------
function paintCrest(P, level) {
  const b = P.box, tb = tbox(level);
  P.gradient(shade('#e8d4a8', 0.10), shade('#d3b77e', -0.12), 0.5);
  P.felt(0.36);

  shape(P, level.target, '#5d6a3a', { rim: 0.75, lip: 0.9, shade: 0.5, shadow: 0.7, depth: 1.2 });
  // inset cream rule on the shield
  const inset = level.target.map(([x, y]) => [x * 0.88, 0.08 + (y - 0.08) * 0.88]);
  P.draw((g) => {
    g.strokeStyle = rgba('#efe0c2', 0.55);
    g.lineWidth = 0.014;
    g.beginPath();
    inset.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath(); g.stroke();
  });
  // a moth emblem: wings, body, antennae
  shape(P, [[-0.04, 0.36], [-0.58, 0.64], [-0.72, 0.2], [-0.5, -0.02], [-0.04, 0.08]], '#c89a48', { rim: 0.45, lip: 0.65, shadow: 0.5, depth: 0.75 });
  shape(P, [[0.04, 0.36], [0.58, 0.64], [0.72, 0.2], [0.5, -0.02], [0.04, 0.08]], '#c89a48', { rim: 0.45, lip: 0.65, shadow: 0.5, depth: 0.75 });
  shape(P, [[-0.04, 0.4], [0.04, 0.4], [0.06, -0.38], [-0.06, -0.38]], '#efe0c2', { lip: 0.5, shadow: 0.35, depth: 0.55 });
  P.draw((g) => {
    g.strokeStyle = rgba('#3a2718', 0.6);
    g.lineWidth = 0.012;
    g.beginPath(); g.moveTo(-0.02, 0.4); g.quadraticCurveTo(-0.16, 0.58, -0.3, 0.62); g.stroke();
    g.beginPath(); g.moveTo(0.02, 0.4); g.quadraticCurveTo(0.16, 0.58, 0.3, 0.62); g.stroke();
    g.fillStyle = rgba('#b9553a', 0.85);
    g.beginPath(); g.arc(-0.35, 0.28, 0.06, 0, TAU); g.fill();
    g.beginPath(); g.arc(0.35, 0.28, 0.06, 0, TAU); g.fill();
    // wing veins
    g.strokeStyle = rgba('#3a2718', 0.3);
    g.lineWidth = 0.008;
    for (let k = 0; k < 3; k++) {
      g.beginPath(); g.moveTo(-0.08, 0.24 - k * 0.1); g.lineTo(-0.55, 0.4 - k * 0.16); g.stroke();
      g.beginPath(); g.moveTo(0.08, 0.24 - k * 0.1); g.lineTo(0.55, 0.4 - k * 0.16); g.stroke();
    }
  });
  // ribbon across the lower shield
  shape(P, [[-0.56, -0.62], [0.56, -0.62], [0.64, -0.38], [-0.64, -0.38]], '#b9553a', { rim: 0.4, lip: 0.65, shadow: 0.45, depth: 0.65 });
  plateLabel(P, 'MENAGERIE', 0, -0.5, 0.052, 0.85);
  // the ribbon tail on the fold tab
  shape(P, [[0.8, -0.7], [0.7928, -0.945], [0.8614, -1.2969], [0.8525, -0.58]], '#b9553a', { rim: 0.4, lip: 0.6, shadow: 0.45, depth: 0.65 });
  P.draw((g) => {
    // laurel sprigs
    g.strokeStyle = rgba('#c9a24a', 0.7);
    g.lineWidth = 0.01;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 0.8, -0.55); g.quadraticCurveTo(s * 1.02, 0.1, s * 0.82, 0.7); g.stroke();
      for (let k = 0; k < 5; k++) {
        const y = -0.42 + k * 0.22;
        g.fillStyle = rgba('#c9a24a', 0.55);
        g.beginPath(); g.ellipse(s * (0.86 + k * 0.005), y, 0.09, 0.035, s * -0.6, 0, TAU); g.fill();
      }
    }
    // little stars
    g.fillStyle = rgba('#efe0c2', 0.55);
    for (const [x, y] of [[-0.78, 0.82], [0.78, 0.82], [-0.9, 0.2], [0.9, 0.2]]) {
      g.beginPath(); g.arc(x, y, 0.025, 0, TAU); g.fill();
    }
  });

  finishPlate(P, level, -0.92, 0.78, 0.045);
  plateLabel(P, 'CREST', 0.72, 0.78, 0.036, 0.42);
}

const PAINTERS = { moth: paintMoth, dragonfly: paintDragonfly, leaf: paintLeaf, heron: paintHeron, house: paintHouse, boat: paintBoat, arrow: paintArrow, fox: paintFox, compass: paintCompass, crest: paintCrest };

// ---------------------------------------------------------------------------------------------------------------
// the kraft back
// ---------------------------------------------------------------------------------------------------------------
function makeBack(front, level, { backSheet, seed }) {
  const W = front.canvas.width, H = front.canvas.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#c7a16b';
  g.fillRect(0, 0, W, H);
  if (backSheet) {
    const pat = g.createPattern(backSheet, 'repeat');
    g.fillStyle = pat;
    g.fillRect(0, 0, W, H);
  }
  let s = (seed >>> 0) || 7;
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // the pulp: broad mottle and long warm fibres, so the kraft has a body, not a gradient
  g.save();
  for (let i = 0; i < 34; i++) {
    const x = rnd() * W, y = rnd() * H, r = 22 + rnd() * 90;
    g.fillStyle = rnd() < 0.55 ? 'rgba(233,206,163,0.05)' : 'rgba(122,86,48,0.045)';
    g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, TAU); g.fill();
  }
  g.restore();

  // a faint mirrored ghost of the front, so the folded back keeps the print's memory
  g.save();
  g.setTransform(-1, 0, 0, 1, W, 0);
  g.globalAlpha = 0.13;
  g.drawImage(front.canvas, 0, 0);
  g.restore();
  // a kraft veil keeps the ghost quiet without erasing it
  g.save();
  g.globalAlpha = 0.22;
  g.fillStyle = '#c7a16b';
  g.fillRect(0, 0, W, H);
  g.restore();

  // card fibres: a few lighter, a few darker, all matte
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < 190; i++) {
    const x = rnd() * W, y = rnd() * H, len = 4 + rnd() * 26, a = rnd() * Math.PI;
    g.strokeStyle = rnd() < 0.58 ? `rgba(241,218,177,${0.10 + rnd() * 0.12})` : `rgba(104,70,38,${0.08 + rnd() * 0.10})`;
    g.lineWidth = 0.6 + rnd() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rnd() - 0.5) * 5, y + Math.sin(a) * len * 0.5 + (rnd() - 0.5) * 5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  for (let i = 0; i < 110; i++) {
    g.fillStyle = rnd() < 0.62 ? `rgba(108,73,40,${0.10 + rnd() * 0.16})` : `rgba(244,224,186,${0.12 + rnd() * 0.14})`;
    g.beginPath();
    g.ellipse(rnd() * W, rnd() * H, 0.5 + rnd() * 1.1, 0.4 + rnd() * 0.8, rnd() * 3, 0, TAU);
    g.fill();
  }
  g.restore();

  // the stamp and marks, in card units (pre-mirrored so they read after the fold)
  const { box, pxPerUnit: ppu } = front;
  g.save();
  g.setTransform(ppu, 0, 0, -ppu, -box.x0 * ppu, box.y1 * ppu);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const ink = '#573a23';
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const inset = (k) => level.sheet.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  // thin printed border, doubled
  for (const [k, wdt, al] of [[0.94, 0.008, 0.28], [0.905, 0.0055, 0.14]]) {
    const pts = inset(k);
    g.strokeStyle = rgba(ink, al);
    g.lineWidth = wdt;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath(); g.stroke();
  }
  // two registration crosses on the main crease ends
  const main = level.creases[0];
  for (const [x, y] of [main.a, main.b]) {
    g.strokeStyle = rgba(ink, 0.4);
    g.lineWidth = 0.007;
    g.beginPath();
    g.moveTo(x - 0.055, y); g.lineTo(x + 0.055, y);
    g.moveTo(x, y - 0.055); g.lineTo(x, y + 0.055);
    g.stroke();
    g.fillStyle = 'rgba(185,85,58,0.5)';
    g.beginPath(); g.arc(x, y, 0.012, 0, TAU); g.fill();
  }

  // the specimen stamp: larger, double-ruled, the plate roman beneath FOLDED
  // (III's authored spot lands under the tucked tip, so its impression moves to the visible back)
  let [sx, sy] = level.stampAt;
  if (level.id === 3) { sx = 1.0; sy = 0.9; }
  g.save();
  g.translate(sx, sy);
  g.scale(-1, 1);
  g.globalAlpha = 0.72;
  g.strokeStyle = ink;
  g.lineWidth = 0.013;
  g.beginPath(); g.ellipse(0, 0, 0.60, 0.33, -0.09, 0, TAU); g.stroke();
  g.lineWidth = 0.006;
  g.beginPath(); g.ellipse(0, 0, 0.545, 0.282, -0.09, 0, TAU); g.stroke();
  g.fillStyle = ink;
  g.font = `600 0.080px Georgia, 'Times New Roman', serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (g.letterSpacing !== undefined) g.letterSpacing = '0.016px';
  g.fillText('FOLDED', 0, -0.088);
  g.font = `italic 0.062px Georgia, 'Times New Roman', serif`;
  g.fillText(`PL. ${level.page}`, 0, 0.095);
  g.fillStyle = 'rgba(185,85,58,0.62)';
  g.beginPath(); g.arc(0.47, -0.19, 0.022, 0, TAU); g.fill();
  g.restore();

  // a small line of type on the back, and the plate number
  g.save();
  g.translate(box.x0 + 0.3, box.y0 + 0.2);
  g.scale(-1, 1);
  g.globalAlpha = 0.62;
  g.fillStyle = ink;
  g.font = `italic 0.052px Georgia, 'Times New Roman', serif`;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  if (g.letterSpacing !== undefined) g.letterSpacing = '0.008px';
  g.fillText('folded specimen', 0, 0);
  g.restore();
  g.restore();
  return c;
}

export function buildCardArt(level, { frontSheet, backSheet, seed = 7, pxPerUnit = 300 } = {}) {
  const front = printCard(level.sheet, {
    pxPerUnit,
    sheet: frontSheet,
    seed: (seed + level.id * 101) >>> 0,
    paint: (P) => (PAINTERS[level.print] || paintMoth)(P, level),
  });
  const back = makeBack(front, level, { backSheet, seed: (seed + level.id * 211) >>> 0 });
  return {
    front: front.canvas,
    back,
    box: front.box,
    pxPerUnit: front.pxPerUnit,
    mean: front.mean,
  };
}
