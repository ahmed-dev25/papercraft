// crease / solve.js — dev-only verifier. Not loaded by the page.
//
//   node solve.js            solve and verify all ten plates
//   node solve.js 7          one plate
//   node solve.js 7 --faces  dump the folded faces and the reachable union for its solution
//
// For every plate it enumerates every legal fold sequence up to MAX_DEPTH (only creases that are actually available on
// the current top face), records every solved sequence, and reports:
//   * the par (shortest solution) and every sequence at that par,
//   * whether the authored solution is one of them,
//   * whether any shorter unintended solution exists,
//   * coverage / protrusion / target-vs-union area for the authored solution.
// Exit code is 1 if any plate fails, so the file can be used as a check.

import * as G from './geometry.js';
import { LEVELS } from './levels.js';

const MAX_DEPTH = 6;
const only = Number(process.argv[2]) || null;
const showFaces = process.argv.includes('--faces');

function segInt(a, b, c, d) {
  const r = G.sub(b, a), s = G.sub(d, c);
  const den = G.cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const qp = G.sub(c, a);
  const t = G.cross(qp, s) / den;
  const u = G.cross(qp, r) / den;
  if (t > -1e-9 && t < 1 + 1e-9 && u > -1e-9 && u < 1 + 1e-9) return { t, u };
  return null;
}
function pointOnSeg(p, a, b) {
  return G.distPointSeg(p, a, b) < 1e-7
    && G.dot(G.sub(p, a), G.sub(b, a)) > -1e-9
    && G.dot(G.sub(p, b), G.sub(a, b)) > -1e-9;
}
function insideUnion(p, polys) {
  for (const poly of polys) if (G.pointInPoly(p, poly)) return true;
  return false;
}

/** The exact boundary of a union of simple polygons (used to prove the authored target is the settled silhouette). */
export function unionPoly(polys) {
  const segs = [];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (G.vlen(G.sub(b, a)) < 1e-9) continue;
      const ts = [0, 1];
      for (const other of polys) {
        for (let j = 0; j < other.length; j++) {
          const c = other[j], d = other[(j + 1) % other.length];
          const hit = segInt(a, b, c, d);
          if (hit && hit.t > 1e-7 && hit.t < 1 - 1e-7) ts.push(hit.t);
          for (const q of [c, d]) {
            if (pointOnSeg(q, a, b)) {
              const t = G.dot(G.sub(q, a), G.sub(b, a)) / G.dot(G.sub(b, a), G.sub(b, a));
              if (t > 1e-7 && t < 1 - 1e-7) ts.push(t);
            }
          }
        }
      }
      ts.sort((x, y) => x - y);
      for (let k = 0; k < ts.length - 1; k++) {
        const t0 = ts[k], t1 = ts[k + 1];
        if (t1 - t0 < 1e-7) continue;
        const p = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
        const q = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
        if (G.vlen(G.sub(q, p)) > 1e-7) segs.push([p, q]);
      }
    }
  }
  const eps = 2e-5;
  const edges = [];
  const seen = new Set();
  const key = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
  for (const [p, q] of segs) {
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const n = G.leftNormal(p, q);
    const l = insideUnion([m[0] + n[0] * eps, m[1] + n[1] * eps], polys);
    const r = insideUnion([m[0] - n[0] * eps, m[1] - n[1] * eps], polys);
    let e = null;
    if (l && !r) e = [p, q];
    else if (r && !l) e = [q, p];
    if (!e) continue;
    const k = `${key(e[0])}|${key(e[1])}`;
    if (seen.has(k)) continue;
    seen.add(k);
    edges.push(e);
  }
  const byStart = new Map();
  for (const e of edges) {
    const k = key(e[0]);
    if (!byStart.has(k)) byStart.set(k, []);
    byStart.get(k).push(e);
  }
  const loops = [];
  const used = new Set();
  for (const start of edges) {
    if (used.has(start)) continue;
    const loop = [];
    let cur = start, guard = 0;
    while (cur && guard++ < 500) {
      used.add(cur);
      loop.push(cur[0]);
      const nxt = (byStart.get(key(cur[1])) || []).find((e) => !used.has(e));
      cur = nxt || null;
      if (cur && key(cur[0]) === key(loop[0])) break;
    }
    if (loop.length >= 3) loops.push(G.simplifyPoly(loop));
  }
  loops.sort((a, b) => Math.abs(G.polyArea(b)) - Math.abs(G.polyArea(a)));
  return loops;
}

function solveAll(level) {
  const solutions = [];
  const walk = (ids) => {
    const ev = G.evaluate(level, ids);
    if (ev.solved) { solutions.push(ids.slice()); return; }
    if (ids.length >= MAX_DEPTH) return;
    for (const c of G.availableCreases(level, ids)) {
      if (c.available) walk([...ids, c.id]);
    }
  };
  walk([]);
  solutions.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
  return solutions;
}

function fmt(p) { return `(${p[0].toFixed(3)}, ${p[1].toFixed(3)})`; }

let failures = 0;
let totalSolutions = 0;
const rows = [];

for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  const solutions = solveAll(level);
  totalSolutions += solutions.length;
  const par = solutions.length ? solutions[0].length : Infinity;
  const atPar = solutions.filter((s) => s.length === par);
  const authored = level.solution.join(' ');
  const authoredOk = solutions.some((s) => s.join(' ') === authored);
  const shorter = solutions.filter((s) => s.length < level.solution.length);
  const state = G.deriveState(level, level.solution);
  const ev = G.evaluate(level, level.solution);
  let unionArea = null, targetArea = Math.abs(G.polyArea(level.target));
  if (state) {
    const loops = unionPoly(state.faces.map((f) => f.poly));
    unionArea = loops.reduce((a, l) => a + Math.abs(G.polyArea(l)), 0);
  }
  const ok = authoredOk && ev.solved && par === level.solution.length && shorter.length === 0 && Math.abs(unionArea - targetArea) < 1e-3;
  if (!ok) failures++;

  console.log(`\nplate ${level.page}  ${level.title}`);
  console.log(`  authored solution : ${authored}   par ${level.par}`);
  console.log(`  solved            : ${ev.solved}  coverage ${ev.coverage.toFixed(4)}  protrusion ${ev.protrusion.toFixed(5)}`);
  console.log(`  target / union    : ${targetArea.toFixed(5)} / ${unionArea == null ? 'n/a' : unionArea.toFixed(5)}`);
  console.log(`  legal solutions   : ${solutions.length} (up to depth ${MAX_DEPTH}); par ${par}; ${atPar.length} at par`);
  for (const s of solutions) console.log(`    d${s.length}: ${s.join(' ')}${s.length === par ? '  <- par' : ''}`);
  console.log(`  authored is a par solution : ${authoredOk}`);
  console.log(`  shorter unintended        : ${shorter.length ? shorter.map((s) => s.join(' ')).join(' | ') : 'none'}`);
  console.log(`  ${ok ? 'OK' : 'FAIL'}`);

  if (showFaces && state) {
    state.faces.forEach((f, i) => console.log(`    face ${i} ${f.side}: ${f.poly.map(fmt).join(' ')}`));
    const loops = unionPoly(state.faces.map((f) => f.poly));
    for (const l of loops) console.log(`    union: ${l.map(fmt).join(' ')}`);
  }
  rows.push({ page: level.page, title: level.title, par, atPar: atPar.length, solutions: solutions.length, ok });
}

if (!only) {
  console.log('\nsummary');
  for (const r of rows) console.log(`  ${r.page.padEnd(4)} ${r.title.padEnd(14)} par ${r.par}  at-par ${r.atPar}  solutions ${r.solutions}  ${r.ok ? 'ok' : 'FAIL'}`);
  console.log(`  ${failures === 0 ? 'ALL PLATES OK' : `${failures} FAILURE(S)`}  (${totalSolutions} legal solution sequences)`);
}
process.exitCode = failures ? 1 : 0;
