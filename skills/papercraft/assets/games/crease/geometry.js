// crease / geometry.js — the fold model, in card units (y up), no DOM, no canvas.
//
// State is an ordered list of fold ids. A fold takes the topmost face, splits it by the crease line, reflects the
// flap across the line and puts it on top. Every face carries an affine map M from the original card to its current
// position, so the print can be sampled back through the inverse chain. All folds are isometries: reflections only.

export const EPS = 1e-7;
export const TAU = Math.PI * 2;

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const vlen = (a) => Math.hypot(a[0], a[1]);
export const norm = (a) => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l]; };
export const leftNormal = (a, b) => norm([-(b[1] - a[1]), b[0] - a[0]]);
export const lerp = (a, b, t) => a + (b - a) * t;

export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distPointSeg(p, a, b) {
  const ab = sub(b, a), l2 = dot(ab, ab) || 1e-12;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return vlen(sub(p, add(a, mul(ab, t))));
}

export function distToPolyEdge(p, poly) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distPointSeg(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

export function pointInPolyOrOn(p, poly, tol = 1e-6) {
  if (pointInPoly(p, poly)) return true;
  return distToPolyEdge(p, poly) <= tol;
}

export function cleanPoly(poly) {
  const out = [];
  for (const p of poly) {
    const q = out[out.length - 1];
    if (!q || Math.abs(p[0] - q[0]) > 1e-9 || Math.abs(p[1] - q[1]) > 1e-9) out.push([p[0], p[1]]);
  }
  while (out.length > 1 && Math.abs(out[0][0] - out[out.length - 1][0]) < 1e-9 && Math.abs(out[0][1] - out[out.length - 1][1]) < 1e-9) out.pop();
  return out;
}

/**
 * Drop collinear points. Clipping a concave face can leave zero-area spikes along the clip line (a T's bar bottom
 * split off the stem); removing the collinear middle points turns those spikes back into the clean rectangle.
 */
export function simplifyPoly(poly) {
  const p = cleanPoly(poly);
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
      const ab = sub(b, a), bc = sub(c, b);
      const scale = (vlen(ab) + vlen(bc)) || 1;
      if (Math.abs(cross(ab, bc)) <= 1e-7 * scale) { p.splice(i, 1); changed = true; break; }
    }
  }
  return p;
}

/** Clip a polygon to the half-plane side*sideOf(a,b,p) >= 0. Works for convex and simple non-convex faces. */
export function clipHalf(poly, a, b, keepSign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = cross(sub(b, a), sub(p, a)) * keepSign;
    const sq = cross(sub(b, a), sub(q, a)) * keepSign;
    if (sp >= -EPS) out.push(p);
    if ((sp > EPS && sq < -EPS) || (sp < -EPS && sq > EPS)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  const c = simplifyPoly(out);
  return c.length >= 3 && Math.abs(polyArea(c)) > 1e-8 ? c : null;
}

export function reflectPoint(p, a, b) {
  const ab = sub(b, a), l2 = dot(ab, ab) || 1e-12;
  const t = dot(sub(p, a), ab) / l2;
  const foot = add(a, mul(ab, t));
  return [2 * foot[0] - p[0], 2 * foot[1] - p[1]];
}

export const IDENTITY = [1, 0, 0, 1, 0, 0];

/** canvas-order affine [a,b,c,d,e,f]: x' = a x + c y + e, y' = b x + d y + f. */
export function matApply(M, p) {
  return [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
}

/** A ∘ B (apply B first, then A). */
export function matMul(A, B) {
  return [
    A[0] * B[0] + A[2] * B[1],
    A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4],
    A[1] * B[4] + A[3] * B[5] + A[5],
  ];
}

export function matInv(M) {
  const det = M[0] * M[3] - M[1] * M[2] || 1e-12;
  return [
    M[3] / det,
    -M[1] / det,
    -M[2] / det,
    M[0] / det,
    (M[2] * M[5] - M[3] * M[4]) / det,
    (M[1] * M[4] - M[0] * M[5]) / det,
  ];
}

export function reflectMatrix(a, b) {
  const d = sub(b, a), l2 = dot(d, d) || 1e-12;
  const r00 = 2 * d[0] * d[0] / l2 - 1;
  const r01 = 2 * d[0] * d[1] / l2;
  const r11 = 2 * d[1] * d[1] / l2 - 1;
  const e = a[0] - (r00 * a[0] + r01 * a[1]);
  const f = a[1] - (r01 * a[0] + r11 * a[1]);
  return [r00, r01, r01, r11, e, f];
}

/**
 * The projection of a flap rotated about the crease by theta, seen straight down the page:
 * perpendicular extent is scaled by cos(theta), along the crease unchanged. At theta = PI it is the reflection.
 */
export function perpScaleMatrix(a, b, theta) {
  const n = leftNormal(a, b);
  const k = Math.cos(theta) - 1;
  const na = dot(n, a);
  return [
    1 + k * n[0] * n[0],
    k * n[0] * n[1],
    k * n[0] * n[1],
    1 + k * n[1] * n[1],
    -k * na * n[0],
    -k * na * n[1],
  ];
}

/** Split a face by the crease line; flapPoint is any point on the desired flap side (current coords). */
export function splitByCrease(poly, a, b, flapPoint) {
  const fs = Math.sign(cross(sub(b, a), sub(flapPoint, a)));
  if (!fs) return null;
  const flapBefore = clipHalf(poly, a, b, fs);
  const keep = clipHalf(poly, a, b, -fs);
  if (!flapBefore || !keep) return null;
  const flap = flapBefore.map((p) => reflectPoint(p, a, b));
  return { keep, flap, flapBefore, side: fs };
}

/** Derive all faces from the original card and an ordered list of fold ids. */
export function deriveState(level, foldIds) {
  const faces = [{ poly: level.sheet.map((p) => p.slice()), M: IDENTITY.slice(), side: 'front', from: null }];
  for (const id of foldIds) {
    const crease = level.creases.find((c) => c.id === id);
    if (!crease) return null;
    const top = faces[faces.length - 1];
    const ta = matApply(top.M, crease.a);
    const tb = matApply(top.M, crease.b);
    const n = leftNormal(crease.a, crease.b);
    const mid = mul(add(crease.a, crease.b), 0.5);
    const test = matApply(top.M, add(mid, mul(n, crease.side * 0.05)));
    const split = splitByCrease(top.poly, ta, tb, test);
    if (!split) return null;
    const R = reflectMatrix(ta, tb);
    const M2 = matMul(R, top.M);
    faces[faces.length - 1] = { ...top, poly: split.keep };
    faces.push({
      poly: split.flap,
      M: M2,
      side: top.side === 'front' ? 'back' : 'front',
      from: id,
      parent: faces.length - 1,
    });
  }
  return { faces, top: faces[faces.length - 1] };
}

/** All line/face boundary intersections, as parameters along the crease segment a->b. */
function chordRange(poly, a, b) {
  const d = sub(b, a), l2 = dot(d, d) || 1e-12;
  const ts = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = cross(sub(b, a), sub(p, a));
    const sq = cross(sub(b, a), sub(q, a));
    if (Math.abs(sp) <= 1e-8) ts.push(dot(sub(p, a), d) / l2);
    if (Math.abs(sq) <= 1e-8) ts.push(dot(sub(q, a), d) / l2);
    if ((sp > 1e-9 && sq < -1e-9) || (sp < -1e-9 && sq > 1e-9)) {
      const t = sp / (sp - sq);
      const hit = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      ts.push(dot(sub(hit, a), d) / l2);
    }
  }
  if (ts.length < 2) return null;
  return { min: Math.min(...ts), max: Math.max(...ts) };
}

/**
 * A crease is foldable when it spans the top face: the whole chord of the face along the crease line lies inside the
 * printed crease segment. A short interior score would tear, and a crease that continues under another layer is not
 * on the top face. Used creases are never available again.
 */
export function creaseOnTop(level, foldIds, crease) {
  if (foldIds.includes(crease.id)) return { available: false, reason: 'used' };
  const state = deriveState(level, foldIds);
  if (!state) return { available: false, reason: 'state' };
  const top = state.top;
  const ta = matApply(top.M, crease.a);
  const tb = matApply(top.M, crease.b);
  if (!pointInPolyOrOn(ta, top.poly, 1e-5) || !pointInPolyOrOn(tb, top.poly, 1e-5)) {
    return { available: false, reason: 'off-face', a: ta, b: tb };
  }
  const mid = mul(add(ta, tb), 0.5);
  if (!pointInPolyOrOn(mid, top.poly, 1e-5)) return { available: false, reason: 'off-face', a: ta, b: tb };
  const range = chordRange(top.poly, ta, tb);
  if (!range || range.min < -1e-6 || range.max > 1 + 1e-6 || range.max - range.min < 0.08) {
    return { available: false, reason: 'partial', a: ta, b: tb };
  }
  const n = leftNormal(crease.a, crease.b);
  const om = mul(add(crease.a, crease.b), 0.5);
  const test = matApply(top.M, add(om, mul(n, crease.side * 0.05)));
  const split = splitByCrease(top.poly, ta, tb, test);
  if (!split) return { available: false, reason: 'no-flap', a: ta, b: tb };
  return { available: true, a: ta, b: tb, top, split, side: split.side };
}

export function availableCreases(level, foldIds) {
  return level.creases.map((c) => {
    const r = creaseOnTop(level, foldIds, c);
    return { ...c, ...r };
  });
}

// Coverage points are generated once per level from a fixed seed; the grid lives in the target's bbox.
const sampleCache = new Map();

export function targetSamples(level) {
  const key = level.id;
  if (sampleCache.has(key)) return sampleCache.get(key);
  const b = bbox(level.target);
  let s = (level.seed >>> 0) || 0x9e3779b9;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pts = [];
  let tries = 0;
  while (pts.length < 4000 && tries < 120000) {
    const p = [b.x0 + rnd() * b.w, b.y0 + rnd() * b.h];
    if (pointInPoly(p, level.target)) pts.push(p);
    tries++;
  }
  sampleCache.set(key, pts);
  return pts;
}

export function faceBBox(face) { return bbox(face.poly); }

export function computeCoverage(level, faces) {
  const pts = targetSamples(level);
  if (!pts.length) return 0;
  const boxes = faces.map(faceBBox);
  let hit = 0;
  for (const p of pts) {
    for (let i = 0; i < faces.length; i++) {
      const b = boxes[i];
      if (p[0] < b.x0 - 1e-9 || p[0] > b.x1 + 1e-9 || p[1] < b.y0 - 1e-9 || p[1] > b.y1 + 1e-9) continue;
      if (pointInPoly(p, faces[i].poly)) { hit++; break; }
    }
  }
  return hit / pts.length;
}

/** How far any face reaches outside the target (0 when contained). Vertices and edge samples are enough. */
export function computeProtrusion(level, faces) {
  let worst = 0;
  const test = (p) => {
    if (pointInPoly(p, level.target)) return;
    const d = distToPolyEdge(p, level.target);
    if (d > worst) worst = d;
  };
  for (const f of faces) {
    for (let i = 0; i < f.poly.length; i++) {
      const p = f.poly[i], q = f.poly[(i + 1) % f.poly.length];
      test(p);
      for (let k = 1; k < 16; k++) test([p[0] + (q[0] - p[0]) * k / 16, p[1] + (q[1] - p[1]) * k / 16]);
    }
    // a few interior samples catch a face that crosses a concave notch between its own edges
    const b = bbox(f.poly);
    for (let j = 1; j < 8; j++) for (let i = 1; i < 8; i++) {
      const p = [b.x0 + b.w * i / 8, b.y0 + b.h * j / 8];
      if (pointInPoly(p, f.poly)) test(p);
    }
  }
  return worst;
}

export function evaluate(level, foldIds) {
  const state = deriveState(level, foldIds);
  if (!state) return { coverage: 0, protrusion: Infinity, solved: false, faces: [] };
  const coverage = computeCoverage(level, state.faces);
  const protrusion = computeProtrusion(level, state.faces);
  return {
    coverage,
    protrusion,
    solved: coverage >= 0.97 && protrusion <= 0.02,
    faces: state.faces,
  };
}
