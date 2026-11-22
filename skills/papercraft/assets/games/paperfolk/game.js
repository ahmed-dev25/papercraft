// papercraft / games / paperfolk: a pop-up hidden-object game on the countryside board. The world is the template's
// worked example (a first playable board); the game layer places seeded paperfolk among the pieces, two of them shy
// (backs to the camera: fold the world flat to see their printed faces), wires click-to-collect, a paper token HUD,
// a timer that only shows at the end and a fold-shut-and-reopen win celebration.
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { makeCard, layeredCard, clusterLayout, platform } from 'papercraft/lib/paperkit-3d.js';
import * as EX from 'papercraft/examples/countryside.js';
import { boxHouse, bridge } from 'papercraft/examples/built-ground.js';
import { createLife } from 'papercraft/lib/paper-life.js';
import { createHarness } from './harness.js';

// ---- 0. quality tier, resolved BEFORE the harness exists (the knobs go into createHarness's call): the kit's own
// documented ladder (references/three-js.md section 9). ?tier=high|med|low always wins and turns every automatic
// step-down off; otherwise a hardware heuristic picks the tier up front — a weak machine must never pay for a
// high-tier build and then rebuild (a reload-based tune re-prints the whole world, a minute of loading for nothing).
// No reloads, nothing persisted. The knobs: DPR cap, key-light shadow map, PaperPost MSAA samples, DOF taps;
// ambient life counts scale with it too. A one-shot LIVE downgrade (section 10, below) is the only fallback.
const TIER = (() => {
  const t = new URLSearchParams(location.search).get('tier');
  if (t === 'high' || t === 'med' || t === 'low') return t;   // the player's explicit word
  const cores = navigator.hardwareConcurrency, dm = navigator.deviceMemory;   // dm (GB) is Chromium-only: absent = no signal
  if ((cores >= 1 && cores <= 2) || (dm !== undefined && dm <= 4)) return 'low';
  if ((cores >= 1 && cores <= 4) || (dm !== undefined && dm <= 8)) return 'med';
  return 'high';   // missing or out-of-range readings (0, undefined, spoofed huge) are no signal
})();
const TIERS = {
  high: { dpr: 2, shadow: 4096, msaa: 4, taps: 40, fallers: 60, flyers: 8, clouds: 4 },   // the kit's own defaults
  med: { dpr: 1.25, shadow: 2048, msaa: 2, taps: 24, fallers: 36, flyers: 5, clouds: 2 },
  low: { dpr: 1, shadow: 1024, msaa: 0, taps: 16, fallers: 20, flyers: 3, clouds: 1 },
};
const Q = TIERS[TIER];
const PF_LIFE = [];   // the ambient kinds a live tier step-down can thin at runtime: [kind, Q key] pairs (section 6)

// ---- 1. palette: THIS WORLD'S ONLY (autumn countryside: warm orange / rust / ochre lead; sage, teal and cream
// accents). Do not start from these hexes: derive your own from your brief (references/palettes.md section 3) ------
const C = {
  ground: '#cfc4a1', wash: '#a8ae84', washWarm: '#d4cba6', path: '#f3e6c6', river: '#46aa9e', riverDeep: '#2e8079', foam: '#f6ecd4',
  field: '#d6b86c', leafA: '#e0852c', leafB: '#c9542b', leafC: '#d9a03a', pine: '#62803f', bush: '#3f8a74', bushB: '#8a9c55',
  hill: '#86a07f', hillB: '#a9b98f',
  trunk: '#74452a', wall: '#ecd4b0', roof: '#c8513b', roofB: '#9c5636', roofC: '#b5683a', window: '#ffc45a', stone: '#b7a386',
  wood: '#a8683a', hay: '#dcb055', ink: '#3a2412', cloak: '#4f6a8a', hat: '#e3b04b', door: '#3f7a70', earth: '#b98a58', turf: '#8f9c4c', meadow: '#b3aa6a',
};
// the leading lines (section 2 prints them): the river and the path curve diagonally through the frame and cross ONCE,
// at a bridge. Each bends ~4 times in view (two sines, ~30 and ~45 units long): one gentle sine reads as a ruler-straight road.
const riverX = (z) => -26.4 - z * 0.8 + Math.sin(z * 0.15) * 3 + Math.sin(z * 0.23 + 2.1) * 2.6;   // top centre -> left edge
const pathX = (z) => 6 + z * 0.7 + Math.sin(z * 0.13 + 1) * 2.4 + Math.sin(z * 0.21 + 0.4) * 2.8;  // bottom right -> the bridge -> top left
const HERO_AT = [pathX(3) + 0.2, 3];   // where the hero starts: the subject a frame narrower than 16:9 swings toward
// one diorama: the hero walks anywhere the overview shows (walkArea), the camera drifts a few units with him (camBox).
// paperfolk plays a FIXED overview (play: false), so the fill prints only what that overview can see (H.inFrame) —
// the ring past it the walking camera could bring is never built. The view is authored for 16:9; ?size=1080x1920
// (a Reel) or ?aspect=1:1 renders the same world in another format (references/formats.md)
const H = createHarness({ ground: C.ground, view: { pitch: 47, dist: 66, target: [2, 1.5, -6] }, bounds: { x0: -64, x1: 64, z0: -62, z1: 38 }, play: false,
  walkArea: { x0: -18, x1: 22, z0: -24, z1: 7 }, camBox: { x0: -1, x1: 5, z0: -8, z1: -4 }, subject: HERO_AT,
  dpr: Q.dpr, shadowMap: Q.shadow, msaa: Q.msaa, lens: { taps: Q.taps } });
const { walk, flags } = H;
// print resolution of the fill (popup res): a piece placed OUTSIDE the lens's sharp-to-mid band (H.sharpAt) prints at
// 0.6 of it — the harness already lowers pxPerUnit for non-sharp cards, this multiplies on top, and the blurred far
// rows and near cards build ~3x faster (nothing visible changes; they sit under the DOF). Landmarks and the hero share
// this wrapper: a coarser print on a blurred row is exactly the intent. Missing coords print at full res.
const RES = 1;
const popup = (pts, paint, o = {}) => H.popup(pts, paint, { res: flags.ROAM || flags.TEST || o.x === undefined || o.z === undefined || H.sharpAt(o.x, o.z) ? RES : RES * 0.6, ...o });   // ?roam/?test keep the kit's full-quality review prints

// ---- 2. the printed ground: watercolour washes, torn-paper river, path and fields, marks gathered in drifts ---------
// THIS WORLD'S ground, not a recipe: replace it with your world's own floor and features (deck plates, sand ripples,
// snow drifts, tiles, a lava channel), printed with the same tools; no river unless your world has water.
// Here the river and the path (riverX, pathX above) are the leading lines.
const fields = [[22, -24, 12, 8, 0.2], [21, -3, 10, 7, -0.25]];      // x, z, w, d, angle
const POND = { x: pathX(-3) - 9.6, z: -3.4, rx: 6.2, rz: 3.4 };     // a pond by the path with a jetty: the ground stays flat
const inPond = (x, z, k = 1) => ((x - POND.x) / (POND.rx * k)) ** 2 + ((z - POND.z) / (POND.rz * k)) ** 2 < 1;
const pondPts = (k) => Array.from({ length: 40 }, (_, i) => { const a = i / 40 * Math.PI * 2, w = 1 + 0.07 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 5); return [POND.x + Math.cos(a) * POND.rx * k * w, POND.z + Math.sin(a) * POND.rz * k * w]; });
H.printGround(({ g, ppu, X, Z, rnd, washes, torn, band, ribbon, drifts }) => {
  washes([C.wash, C.wash, C.wash, C.washWarm, C.washWarm]);
  for (const [fx, fz, fw, fd, fa] of fields) {                       // field patches: torn ochre paper with furrows
    const ca = Math.cos(fa), sa = Math.sin(fa), corner = ([u, v]) => [fx + u * ca - v * sa, fz + u * sa + v * ca];
    torn([[-fw / 2, -fd / 2], [fw / 2, -fd / 2], [fw / 2, fd / 2], [-fw / 2, fd / 2]].map(corner), P2.rgba(C.field, 0.8));
    g.save(); g.translate(X(fx), Z(fz)); g.rotate(fa);
    g.strokeStyle = P2.rgba(P2.shade(C.field, -0.3), 0.45); g.lineWidth = 0.22 * ppu;
    for (let k = -fd / 2 + 0.7; k < fd / 2 - 0.4; k += 0.9) { g.beginPath(); g.moveTo((-fw / 2 + 0.6) * ppu, k * ppu); g.lineTo((fw / 2 - 0.6) * ppu, (k + 0.2) * ppu); g.stroke(); }
    g.restore();
  }
  // river (THIS world's water: a countryside stream; do not carry it, its torn rim or its ripples into a world whose
  // brief has no water): a torn pale paper border, the turquoise water piece on it, a deeper channel, ripple highlights
  torn(band(riverX, (z) => 3.1 + Math.sin(z * 0.4) * 0.15), '#f2e6c6');
  torn(band(riverX, (z) => 2.55 + Math.sin(z * 0.3 + 1) * 0.2), C.river, 'rgba(250,240,220,0.35)');
  ribbon(riverX, 2.4, P2.rgba(C.riverDeep, 0.55), undefined, undefined, 0.4);
  for (let k = 0, n = Math.round(2.6 * (H.bounds.z1 - H.bounds.z0)); k < n; k++) {   // ~2.6 ripples per unit of river: the sheet's length varies with the formats it serves
    const z = H.bounds.z0 + rnd() * (H.bounds.z1 - H.bounds.z0), x = riverX(z) + (rnd() - 0.5) * 3.8, l = (0.6 + rnd() * 1.1) * ppu, pale = k % 3 !== 0;
    g.strokeStyle = pale ? P2.rgba(C.foam, 0.85) : P2.rgba(C.riverDeep, 0.7); g.lineWidth = pale ? 0.12 * ppu : 0.09 * ppu;
    g.beginPath(); g.moveTo(X(x) - l / 2, Z(z)); g.quadraticCurveTo(X(x), Z(z) - 0.12 * ppu, X(x) + l / 2, Z(z)); g.stroke();
  }
  // the pond: a torn pale rim, the water, a deeper middle, ripples and lily pads
  torn(pondPts(1.12), '#f2e6c6'); torn(pondPts(1.0), C.river, 'rgba(250,240,220,0.35)'); torn(pondPts(0.6), P2.rgba(C.riverDeep, 0.5), 'rgba(0,0,0,0)');
  for (let k = 0; k < 70; k++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 0.85, x = POND.x + Math.cos(a) * POND.rx * r, z = POND.z + Math.sin(a) * POND.rz * r, l = (0.4 + rnd() * 0.7) * ppu;
    g.strokeStyle = P2.rgba(C.foam, 0.8); g.lineWidth = 0.1 * ppu; g.beginPath(); g.moveTo(X(x) - l / 2, Z(z)); g.quadraticCurveTo(X(x), Z(z) - 0.1 * ppu, X(x) + l / 2, Z(z)); g.stroke(); }
  for (let k = 0; k < 9; k++) { const a = rnd() * 6.283, r = 0.55 + rnd() * 0.3, x = POND.x + Math.cos(a) * POND.rx * r, z = POND.z + Math.sin(a) * POND.rz * r, rr = (0.35 + rnd() * 0.2) * ppu;
    g.fillStyle = '#5f8a4a'; g.beginPath(); g.moveTo(X(x), Z(z)); g.arc(X(x), Z(z), rr, a, a + 5.6); g.closePath(); g.fill();
    if (k % 3 === 0) { g.fillStyle = '#f3dce0'; g.beginPath(); g.arc(X(x) + rr * 0.3, Z(z) - rr * 0.2, rr * 0.28, 0, 7); g.fill(); } }
  torn(band(pathX, (z) => 1.25 + Math.sin(z * 0.5) * 0.12), C.path); // path: a torn strip of pale paper, a worn centre
  ribbon(pathX, 0.7, P2.rgba('#fbf1d8', 0.45), undefined, undefined, 0.2);
  // the path's edge: a slightly darker, greener fringe just outside it and fine grit inside (a bare pale strip reads
  // as an unprinted gap in the sheet)
  for (const sd of [-1, 1]) ribbon((z) => pathX(z) + sd * (1.47 + Math.sin(z * 0.5) * 0.12), 0.36, P2.rgba(P2.shade(C.turf, -0.15), 0.26), undefined, undefined, 0.15);
  for (let k = 0, n = Math.round(20 * (H.bounds.z1 - H.bounds.z0)); k < n; k++) {   // ~20 grit dots per unit of path
    const z = H.bounds.z0 + rnd() * (H.bounds.z1 - H.bounds.z0), x = pathX(z) + (rnd() - 0.5) * 2.2, r = (0.05 + rnd() * 0.06) * ppu;
    g.fillStyle = rnd() < 0.6 ? P2.rgba(P2.shade(C.path, -0.3), 0.55) : P2.rgba('#fff6e2', 0.7);
    g.beginPath(); g.ellipse(X(x), Z(z), r * 1.3, r, rnd() * 3, 0, 7); g.fill();
  }
  drifts((x, y) => {                                                  // grass ticks and flowers gathered in drifts
    if (rnd() < 0.75) { g.strokeStyle = P2.rgba(rnd() < 0.5 ? '#6c7c4a' : '#8d9a58', 0.75); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 5 - rnd() * 5); g.stroke(); }
    else { g.fillStyle = rnd() < 0.5 ? '#f3e6c8' : '#c8452d'; for (let q = 0; q < 5; q++) { const t = q / 5 * 6.283; g.beginPath(); g.arc(x + Math.cos(t) * 2.2, y + Math.sin(t) * 2.2, 1.6, 0, 7); g.fill(); } }
  });
});

// ---- 3. the pieces: silhouettes + layered prints (the countryside examples), a few drawn here with fromDrawing -----
// Proportions from the shipped frames: the hero ~8 % of the frame height, trees ~2-2.5x the hero, bushes and rocks
// ~0.5-0.9x the hero, houses ~1.7x. Each kind is a function returning [outline, print].
let rnd = P2.rng(101);                // one seeded stream per section: an edit in one section never reshuffles another
const D = P2.draw2, between = (a, b) => a + rnd() * (b - a);
// slotted crosses (trees, pines) are placed without a yaw: the harness turns them as the source game does
const tuft = (w, h, n) => P2.shape.mound(rnd, { w, h, lobes: n, depth: 0.42 }); // rounded blades: pointed ones read as combs
const dome = (w, h, n = 24) => { const p = [[-w / 2, 0], [w / 2, 0]]; for (let i = 1; i < n; i++) { const a = (i / n) * Math.PI; p.push([Math.cos(a) * w / 2, Math.sin(a) * h]); } return p; };
const mound = (w, h, lobes = 7, depth = 0.18) => P2.shape.mound(rnd, { w, h, lobes, depth }); // flat base: stands on its fold
const peak = (w, h, lean = 0.15) => { const p = [[w / 2, 0]]; for (let i = 1; i < 28; i++) { const t = i / 28, x = w / 2 - t * w, k = Math.min(1, Math.abs(x / (w / 2) - lean)); p.push([x, h * (1 - Math.pow(k, 1.7)) * (0.95 + 0.05 * Math.sin(t * 11))]); } p.push([-w / 2, 0]); return p; };
const stonePrint = (P) => { P.gradient(P2.shade(C.stone, 0.1), P2.shade(C.stone, -0.15), 0.4); P.marks('brick', { color: P2.shade(C.stone, -0.45), alpha: 0.55, size: 0.08 }); P.marks('dot', { color: P2.shade(C.stone, 0.4), alpha: 0.4, size: 0.03, density: 0.4 }); P.innerShade(P2.shade(C.stone, -0.6), { alpha: 0.4, blurPx: 8 }); };
const K = {
  tree: () => { const h = between(7, 9), w = h * between(0.76, 0.86); return [P2.roughen(EX.shape.tree(rnd, { w, h, lobes: 7 + Math.floor(rnd() * 3), canopy: 0.76, trunk: 0.26 }), rnd), EX.paintTree({ leaf: [C.leafA, C.leafB, C.leafC][Math.floor(rnd() * 3)], trunk: C.trunk, ink: C.ink }, { trunkTop: 0.24 })]; },
  pine: () => { const h = between(7.5, 10); return [P2.roughen(EX.shape.pine(rnd, { w: h * 0.6, h }), rnd), EX.paintPine({ leaf: C.pine, trunk: C.trunk, ink: C.ink })]; },
  shrub: () => { const w = between(4, 5); return [P2.roughen(mound(w, w * 0.62, 9, 0.12), rnd), EX.paintBush({ leaf: C.leafB }, { bands: 2 })]; },
  flowers: () => [P2.roughen(mound(6, 2.0, 11, 0.25), rnd), EX.paintBush({ leaf: '#6f8f5a' }, { bands: 0, flowers: true, motifs: false })],
  tuft: () => [tuft(3.4, 2.4, 7), EX.paintBush({ leaf: '#8f9c5c' }, { bands: 2, flowers: false, motifs: false })],
  reeds: () => [tuft(3.0, 3.6, 9), EX.paintBush({ leaf: '#7d8f4f' }, { bands: 1, flowers: false, motifs: false })],
  rock: () => { const w = between(3.6, 5); return [P2.roughen(mound(w, w * 0.55, 4, 0.1), rnd), EX.paintRock({ stone: C.stone, ink: C.ink })]; },
  mushroom: () => [EX.props.mushroom(between(2.0, 2.5)), EX.paintMushroom()],
  stump: () => [P2.fromDrawing((g) => { D.rect(g, -0.45, 0, 0.9, 0.9, 0.05); D.ell(g, 0, 0.9, 0.45, 0.14); D.rect(g, 0.4, 0.5, 0.35, 0.1); }, { w: 1.6, h: 1.1, name: 'stump' }).map(([x, y]) => [x * 1.8, y * 1.8]), EX.paintWood({ wood: '#8a5634' }, { planks: 1 })],
  fox: () => EX.critter.fox(2.2),
  cat: () => EX.critter.cat(1.9, { coat: rnd() < 0.5 ? '#d98a3e' : '#8f8172' }),
  duck: () => EX.critter.duck(1.6),
  hen: () => EX.critter.hen(1.5),
  bench: () => [EX.props.bench(2.0), EX.paintWood({ wood: C.wood })],
  sign: () => [EX.props.signpost(3.2), EX.paintWood({ wood: '#b9844f' }, { planks: 1 })],
  barrel: () => [EX.props.barrel(2.2), EX.paintWood({ wood: '#97552f' }, { planks: 4, vertical: true })],
  fence: () => [EX.shape.fence({ w: 5.4, h: 2.0, pickets: 6 }), EX.paintWood({ wood: '#b07a48' }, { planks: 1 })],
  hay: () => [P2.roughen(dome(3.4, 2.4), rnd), (P) => { P.gradient(P2.shade(C.hay, 0.15), P2.shade(C.hay, -0.18), 0.5); P.marks('hatch', { color: P2.shade(C.hay, -0.4), alpha: 0.4, size: 0.05, angle: 0.5 }); P.marks('hatch', { color: P2.shade(C.hay, 0.35), alpha: 0.35, size: 0.07, angle: -0.4 }); P.innerShade(P2.shade(C.hay, -0.6), { alpha: 0.4, blurPx: 8 }); }],
  well: () => [P2.fromDrawing((g) => { D.rect(g, -0.62, 0, 1.24, 0.62, 0.08); D.rect(g, -0.56, 0.5, 0.1, 0.8); D.rect(g, 0.46, 0.5, 0.1, 0.8); D.poly(g, [[-0.82, 1.2], [0, 1.62], [0.82, 1.2]]); }, { w: 1.7, h: 1.66, name: 'well' }),
    (P) => { const { box, g } = P; stonePrint(P); P.draw(() => { g.fillStyle = C.wood; g.fillRect(box.x0 - 1, box.y0 + box.h * 0.37, box.w + 2, box.h * 0.36); g.fillStyle = C.roof; g.fillRect(box.x0 - 1, box.y0 + box.h * 0.72, box.w + 2, box.h); }); P.marks('scallop', { color: P2.shade(C.roof, -0.35), alpha: 0.6, size: 0.1, region: { ...box, y0: box.y0 + box.h * 0.74 } }); }],
  lamp: () => [P2.fromDrawing((g) => { D.rect(g, -0.07, 0, 0.14, 2.3); D.rect(g, -0.22, 2.2, 0.44, 0.5, 0.06); D.poly(g, [[-0.3, 2.68], [0, 2.95], [0.3, 2.68]]); D.rect(g, -0.25, 0, 0.5, 0.14); }, { w: 0.7, h: 3.0, name: 'lamp' }),
    (P) => { const { box, g } = P; P.fill('#4a3424'); P.draw(() => { g.fillStyle = '#ffd27a'; g.fillRect(box.x0 + box.w * 0.25, box.y0 + box.h * 0.75, box.w * 0.5, box.h * 0.12); }); P.innerShade('#1e120a', { alpha: 0.4, blurPx: 4 }); }],
  boat: () => [P2.fromDrawing((g) => { D.poly(g, [[-0.95, 0.32], [0.95, 0.32], [0.62, 0], [-0.62, 0]]); D.rect(g, -0.04, 0.3, 0.08, 1.25); D.poly(g, [[0.0, 0.46], [0.0, 1.5], [0.72, 0.52]]); }, { w: 2.0, h: 1.6, name: 'boat' }), // the sail touches the mast
    (P) => { const { box, g } = P; P.fill('#f3e6c8'); P.marks('stripe', { color: '#c8452d', alpha: 0.55, size: 0.09 }); P.draw(() => { g.fillStyle = '#a8432e'; g.fillRect(box.x0 - 1, box.y0 - 1, box.w + 2, box.h * 0.2 + 1); g.fillStyle = P2.rgba('#f6ead2', 0.8); g.fillRect(box.x0 - 1, box.y0 + box.h * 0.12, box.w + 2, box.h * 0.025); }); P.innerShade('#4a2410', { alpha: 0.35, blurPx: 6 }); }],
  hill: (k) => [P2.roughen(peak(10 - k * 1.6, 8 - k * 1.8), rnd), EX.paintHill({ ground: P2.shade(C.hill, -0.16 + k * 0.12), accent: '#f3e6c8', ink: C.ink })]   // stepped lighter toward the front,
};
// the shipped bush: a darker scalloped body card and, in front of it, a lighter inner card with the printed sprigs,
// berries and a grass fan at its foot (two cards on one hinge, a soft shadow between them)
function bushStack(x, z, { yaw = 0, scale = 1, sway = 0.6, parent = null, order = null } = {}) {
  const w = between(5.5, 7.5), col = rnd() < 0.55 ? C.bush : C.bushB, inner = P2.mix(col, col === C.bush ? '#efdcae' : '#f2b45a', 0.55);
  const node = layeredCard([
    { pts: P2.roughen(mound(w, w * 0.42, 6, 0.2), rnd), paint: EX.paintBush({ leaf: P2.shade(col, -0.1) }, { bands: 0, motifs: false, grass: false }) },
    { pts: P2.roughen(mound(w * 0.74, w * 0.3, 5, 0.14), rnd), paint: EX.paintBush({ leaf: inner, stem: P2.shade(col, -0.35) }, { bands: 0 }), z: 0.4 },
  ], H.cardOpts(x, z, scale, parent, RES));
  return popup(null, null, { node, height: w * 0.42, x, z, yaw, scale, sway, parent, order });
}
// a nested landform for the MID-ground (the shipped frames get height from nested cards and rocks, never from a raised
// block of terrain): a hillock of n tall curved 'sails', the back one tallest and darkest, each nearer one lower and
// ~12 % lighter, ~0.5 units apart so the gaps read as shadow bands, with a pale crest band; never walked on (a solid)
function hillock(x, z, { w = 4.2, h = 4.6, n = 4, col = C.hill, yaw = 0, lean = 0.2 } = {}) {
  const layers = Array.from({ length: n }, (_, k) => ({
    pts: P2.roughen(peak(w * (1 - k * 0.1), h * (1 - k * 0.18), lean + (k % 2 ? 0.08 : -0.04)), rnd),
    paint: EX.paintHill({ ground: P2.shade(col, -0.2 + k * 0.12), accent: '#f3e6c8', ink: C.ink }), z: k * 0.5 }));
  return popup(null, null, { node: layeredCard(layers.map((L, k) => ({ ...L, pts: L.pts.map(([px, py]) => [px + (k - 1) * w * 0.12, py]) })), H.cardOpts(x, z, 1, null, RES)), height: h, x, z, yaw, solid: w * 0.45 });
}
// a rock outcrop: 3-5 tall slanted cards in a tight cluster, each a lit face and a darker facet turned from the key
const paintSpire = (col) => (P) => {
  const { box } = P;
  P.gradient(P2.shade(col, 0.16), P2.shade(col, -0.08), 0.5); P.felt(0.5);
  P.layer((g) => { g.fillStyle = P2.shade(col, -0.24); g.beginPath(); g.moveTo(box.x0 + box.w * 0.52, box.y1); g.lineTo(box.x1 + 0.1, box.y0 - 0.1); g.lineTo(box.x0 + box.w * 0.42, box.y0 - 0.1); g.closePath(); g.fill(); }, P2.shade(col, -0.24), { lip: 0.7 });
  P.marks('tick', { color: P2.shade(col, -0.4), alpha: 0.35, size: 0.05, angle: 0.9 });
};
function rockOutcrop(x, z, { n = 4, col = '#a07a58', scale = 1 } = {}) {
  for (let k = 0; k < n; k++) {
    const h = (3 + rnd() * 2.2) * scale * (k === 1 ? 1.25 : 1), w = h * (0.42 + rnd() * 0.12);
    popup(peak(w, h, 0.32 + rnd() * 0.2), paintSpire(P2.shade(col, (rnd() - 0.5) * 0.12)), { x: x + (k - (n - 1) / 2) * w * 0.55, z: z + (k % 2) * 0.6 - k * 0.15, yaw: (rnd() - 0.5) * 0.5, solid: w * 0.45 });
  }
}
// keep pieces off the water, the path and the landmarks (distance to the river measured across the curve)
const riverDist = (x, z) => { let d = 1e9; for (let s = -7; s <= 7; s += 0.25) d = Math.min(d, Math.hypot(x - riverX(z + s), s)); return d; };
const pathDist = (x, z) => { let d = 1e9; for (let s = -5; s <= 5; s += 0.25) d = Math.min(d, Math.hypot(x - pathX(z + s), s)); return d; };
const keepOut = [], mark = (x, z, r) => keepOut.push([x, z, r]);
const free = (x, z, m = 0) => riverDist(x, z) > 3.4 + m && pathDist(x, z) > 1.7 + m && keepOut.every(([hx, hz, r]) => Math.hypot(x - hx, z - hz) > r + m);
// what the world's life needs to know (section 6): chimneys, flower beds, creatures and what each one does
const LIFE = { chimneys: [], flowers: [], floaters: [], creatures: [] };
const BEHAVIOUR = { hen: 'peck', fox: 'shy', cat: 'pet' };
// a group: 4-8 DIFFERENT pieces tight together (a door scene may be 2-3), biggest at the back; every member needs room
const BACK_TO_FRONT = ['bush', 'shrub', 'flowers', 'rock', 'fence', 'barrel', 'tuft', 'stump', 'mushroom', 'fox', 'cat', 'hen'];
function group(x, z, kinds, size = 1, ok = free) {
  const rank = (k) => { const i = BACK_TO_FRONT.indexOf(k); return i < 0 ? BACK_TO_FRONT.length : i; };
  kinds = kinds.slice().sort((a, b) => rank(a) - rank(b));
  clusterLayout(x, z, { n: kinds.length, size: size * 5.5, seed: Math.round(x * 13 + z * 7) & 1023 }).forEach((c, i) => {
    if (!ok(c.x, c.z, 0.2)) return;
    if (kinds[i] === 'bush') { bushStack(c.x, c.z, { yaw: c.yaw, scale: c.scale * size }); return; }
    const [pts, paint] = K[kinds[i]]();
    const h = popup(pts, paint, { x: c.x, z: c.z, yaw: c.yaw, scale: c.scale * size, sway: ['shrub', 'tuft', 'reeds', 'flowers'].includes(kinds[i]) ? 0.6 : 0 });
    if (BEHAVIOUR[kinds[i]]) LIFE.creatures.push([h, BEHAVIOUR[kinds[i]]]);
    if (kinds[i] === 'flowers') LIFE.flowers.push([c.x, c.z]);
  });
}
const houseColors = (roof) => ({ wall: C.wall, roof, window: C.window, door: C.door, ink: C.ink });
// the hero: a small 3D PAPER MODEL that reads from every side (it yaws to face the way it walks, so the camera sees
// its front, side and back), designed for this example world: a young gardener. Every body part is a frontal card
// with a profile card standing right BEHIND it (a T, not a cross: from the front no edge line cuts the face; from the
// side the profile shows the depth; slightly different tones, so the build reads as construction): legs and arms on hip
// and shoulder pivots that swing forward and back with the distance walked, the torso, the head (a face in front,
// hair behind), a knitted bobble hat, a basket of greens on the back, a watering can hanging from one hand (it swings
// with that arm, less than the free one). The model faces +z. ~0.4-0.5 of a tree's height.
// Built like a real paper model, so no card ever cuts into another, standing or mid-stride (references/mechanisms.md
// section 12; __papercraft.clips() checks it): overlapping cards sit in their own layers, clear of each other's
// thickness (hat in front of the face in front of the jacket, the legs behind it); limbs hang BESIDE the body, so their
// swing never sweeps through it; each profile card stays wholly behind its front card, and profile cards that share
// the centre plane never overlap (the torso's ends where the basket's begins; the head's is trimmed between the collar
// and the hat's brim; the basket's stands a plane aside where it passes the head's).
const heroDoll = () => {
  const g = new H.THREE.Group(), body = new H.THREE.Group(); g.add(body);
  const PROFILE = -Math.PI / 2;                                       // a profile card: its +x points forward (+z)
  const T = 0.05, GAP = 0.03, SIDE = 0.01;                            // card thickness; air between layers; beside each other
  const card = ([pts, paint], seed, { x = 0, y = 0, z = 0, ry = 0, parent = body, back = 'mirror', name = '', cut = null } = {}) => {
    const m = makeCard(pts, { paint, paper: H.paper, thickness: T, edgeWidth: 0.04, pxPerUnit: 64, seed, back, folds: [], geomPts: cut });
    m.position.set(x, y, z); m.rotation.y = ry; m.name = name; parent.add(m); return m;   // named: clips() reports by name
  };
  const ext = ([pts]) => pts.reduce((e, [x, y]) => ({ x0: Math.min(e.x0, x), x1: Math.max(e.x1, x), y0: Math.min(e.y0, y), y1: Math.max(e.y1, y) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
  // a profile card's z so its front edge (its outline's +x, which faces forward) stays a gap behind a front card at z0
  const behind = (piece, z0) => z0 - T / 2 - GAP - ext(piece).x1;
  const band = (pts, lo, hi, k = 1) => [[lo, 1], [hi, -1]].reduce((poly, [v, s]) => {   // keep lo <= y (k 0: x) <= hi
    const out = [], ok = (p) => s * (p[k] - v) >= 0;
    poly.forEach((a, i) => { const b = poly[(i + 1) % poly.length]; if (ok(a)) out.push(a); if (ok(a) !== ok(b)) { const t = (v - a[k]) / (b[k] - a[k]); out.push(k ? [a[0] + (b[0] - a[0]) * t, v] : [v, a[1] + (b[1] - a[1]) * t]); } });
    return out;
  }, pts);
  const plain = (c) => (P) => { P.gradient(P2.shade(c, 0.08), P2.shade(c, -0.1), 0.5); P.felt(); P.innerShade(P2.shade(c, -0.5), { alpha: 0.25, blurPx: 8 }); };
  const jacket = '#2f6f8a', jacketSide = '#2a6178', collar = '#efe2c4', hat = '#d9a33a', trousers = '#3c5a3a', skin = '#f1d9b8', hair = '#9a5a2a';
  // the layers, front to back: hat (z 0.16), face (0.08), jacket and arms (0), legs (-0.16); the profiles behind them
  const Z = { hat: 0.16, face: 0.08, jacket: 0, legs: -0.16 };
  // the torso: the jacket front (collar, buttons, a pocket) with its side (a seam, a side pocket) behind it; a plain back
  const jacketFront = P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(jacket); D.rect(gg, -0.38, 0, 0.76, 1.28, 0.22);
    gg.fillStyle = ink(collar); D.poly(gg, [[-0.26, 1.28], [0.26, 1.28], [0.1, 1.08], [-0.1, 1.08]]);
    gg.fillStyle = ink('#245a72', 'print'); D.rect(gg, -0.3, 0.18, 0.2, 0.2, 0.04); D.rect(gg, -0.38, 0.62, 0.76, 0.04);
    gg.fillStyle = ink('#e8c25a', 'print'); D.ell(gg, 0.04, 0.95, 0.035, 0.035); D.ell(gg, 0.04, 0.75, 0.035, 0.035); D.ell(gg, 0.04, 0.45, 0.035, 0.035);
  }, { w: 0.85, h: 1.3, name: 'jacket' });
  const jacketY = 0.78, jx = ext(jacketFront), jacketTop = jacketY + jx.y1;
  card(jacketFront, 301, { y: jacketY, z: Z.jacket, back: plain(P2.shade(jacket, -0.06)), name: 'jacket' });
  const jacketSidePiece = P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(jacketSide); D.rect(gg, -0.24, 0, 0.48, 1.24, 0.18);
    gg.fillStyle = ink('#1f5064', 'print'); D.rect(gg, -0.02, 0.05, 0.04, 1.1); D.rect(gg, 0.06, 0.2, 0.14, 0.16, 0.03);
  }, { w: 0.55, h: 1.3, name: 'jacket side' });
  const TORSO = 0.32;                                                 // the torso's depth: its side card trimmed to it
  const jacketSideZ = behind(jacketSidePiece, Z.jacket), jacketBack = Z.jacket - T / 2 - GAP - TORSO;
  card(jacketSidePiece, 302, { y: 0.8, z: jacketSideZ, ry: PROFILE, name: 'jacket side', cut: band(jacketSidePiece[0], jacketBack - jacketSideZ, 9, 0) });
  // legs: a frontal + a profile card per leg, from hip pivots set apart (the legs never overlap each other, nor the
  // jacket's side card) and a layer behind the jacket, deeper than the jacket's hem moves through when they swing
  const legFront = (i) => P2.drawnPiece((gg, ink) => { gg.fillStyle = ink(trousers); D.rect(gg, -0.1, 0.18, 0.2, 0.8, 0.05); gg.fillStyle = ink('#4a2a18'); D.rect(gg, -0.12, 0, 0.24, 0.22, 0.07); }, { w: 0.3, h: 1.0, name: `leg ${i}` });
  const legSide = (i) => P2.drawnPiece((gg, ink) => { gg.fillStyle = ink(P2.shade(trousers, -0.08)); D.rect(gg, -0.1, 0.18, 0.2, 0.8, 0.05); gg.fillStyle = ink('#4a2a18'); D.rect(gg, -0.1, 0, 0.3, 0.22, 0.08); }, { w: 0.45, h: 1.0, name: `leg ${i} side` });
  const hipX = ext(legFront(0)).x1 + T / 2 + SIDE;                       // the inner edge clears the jacket's side card
  const legs = [-hipX, hipX].map((x, i) => {
    const hip = new H.THREE.Group(); hip.position.set(x, 0.95, Z.legs); body.add(hip);
    const side = legSide(i);
    card(legFront(i), 310 + i, { y: -0.97, parent: hip, name: `leg ${i}` });
    card(side, 320 + i, { y: -0.97, z: behind(side, 0), ry: PROFILE, parent: hip, name: `leg ${i} side` });
    return hip;
  });
  // the head: a face in front of the jacket (hair printed on its back), its profile behind it, trimmed to the band
  // between the collar and the hat's brim so it shares the centre plane with neither the jacket's side nor the hat's
  const face = P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(skin); D.ell(gg, 0, 0.38, 0.36, 0.38);
    gg.fillStyle = ink(hair, 'print'); D.rect(gg, -0.3, 0.5, 0.6, 0.12, 0.06);
    gg.fillStyle = ink('#2a1608', 'print'); D.ell(gg, -0.12, 0.35, 0.04, 0.05); D.ell(gg, 0.12, 0.35, 0.04, 0.05);
    gg.fillStyle = ink('#c9845a', 'print'); for (const fx of [-0.2, -0.16, 0.16, 0.2]) D.ell(gg, fx, 0.25, 0.015, 0.015);
    gg.fillStyle = ink('#8a3a22', 'print'); D.rect(gg, -0.07, 0.17, 0.14, 0.03, 0.015);
  }, { w: 0.8, h: 0.8, name: 'face' });
  card(face, 304, { y: 1.88, z: Z.face, back: plain(hair), name: 'face' });
  const hatY = 2.42, headY = 1.86;
  const headSide = P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(P2.shade(skin, -0.04)); D.ell(gg, 0, 0.38, 0.34, 0.38);
    gg.fillStyle = ink(hair); D.ell(gg, -0.12, 0.44, 0.24, 0.32);
    gg.fillStyle = ink('#e0b896', 'print'); D.ell(gg, 0.02, 0.36, 0.06, 0.08);
    gg.fillStyle = ink('#2a1608', 'print'); D.ell(gg, 0.22, 0.35, 0.03, 0.045);
  }, { w: 0.75, h: 0.8, name: 'head side' });
  const headSideZ = behind(headSide, Z.face), headBack = headSideZ + ext(headSide).x0;   // the back of the head (hair)
  card(headSide, 305, { y: headY, z: headSideZ, ry: PROFILE, name: 'head side',
    cut: band(headSide[0], jacketTop + GAP - headY, hatY - GAP - headY) });
  // the knitted bobble hat: a frontal crown in front of the face, a profile crown behind it, a pompom on both
  const hatPiece = (c) => P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(c); D.rect(gg, -0.34, 0, 0.68, 0.36, 0.16);
    gg.fillStyle = ink(P2.shade(c, -0.22)); D.rect(gg, -0.35, 0, 0.7, 0.1, 0.04);
    gg.fillStyle = ink('#c8452d', 'print'); D.rect(gg, -0.34, 0.18, 0.68, 0.05);
    gg.fillStyle = ink('#f3e6c8'); D.ell(gg, 0, 0.42, 0.13, 0.12);
  }, { w: 0.75, h: 0.6, name: 'hat' });
  card(hatPiece(hat), 306, { y: hatY, z: Z.hat, name: 'hat' });
  const hatSide = hatPiece(P2.shade(hat, -0.06));
  card(hatSide, 307, { y: hatY, z: behind(hatSide, Z.face), ry: PROFILE, name: 'hat side' });
  // arms: a frontal + a profile card each, from shoulder pivots just outside the jacket (a swinging arm never sweeps
  // through the body); the right hand carries the watering can, hung just below the hand
  const armArt = (c, name) => P2.drawnPiece((gg, ink) => { gg.fillStyle = ink(c); D.rect(gg, -0.1, 0.14, 0.2, 0.66, 0.09); gg.fillStyle = ink(collar); D.rect(gg, -0.1, 0.12, 0.2, 0.09, 0.04); gg.fillStyle = ink(skin); D.ell(gg, 0, 0.08, 0.09, 0.08); }, { w: 0.3, h: 0.85, name });
  const shoulderX = jx.x1 + ext(armArt(jacket, 'arm')).x1 + SIDE;     // right against the jacket's edge, never over it
  const arms = [-shoulderX, shoulderX].map((x, i) => {
    const sh = new H.THREE.Group(); sh.position.set(x, 1.98, Z.jacket); body.add(sh);
    const side = armArt(jacketSide, `arm ${i} side`);
    card(armArt(jacket, `arm ${i}`), 330 + i, { y: -0.8, parent: sh, name: `arm ${i}` });
    card(side, 340 + i, { y: -0.8, z: behind(side, 0), ry: PROFILE, parent: sh, name: `arm ${i} side` });
    return sh;
  });
  const can = P2.drawnPiece((gg, ink) => {                           // the can, in profile: spout forward, a handle on top
    gg.fillStyle = ink('#9fb0b0'); D.rect(gg, -0.2, 0, 0.4, 0.36, 0.05); D.poly(gg, [[0.16, 0.12], [0.24, 0.16], [0.48, 0.44], [0.44, 0.48]]);
    gg.fillStyle = ink('#7c8c8c'); D.rect(gg, -0.12, 0.34, 0.24, 0.12, 0.04);
    gg.fillStyle = ink('#5f6d6d', 'print'); D.rect(gg, -0.2, 0.1, 0.4, 0.03); D.rect(gg, -0.2, 0.24, 0.4, 0.03);
  }, { w: 1.05, h: 0.55, name: 'watering can' });
  card(can, 350, { y: -0.8 - GAP - ext(can).y1, ry: PROFILE, parent: arms[1], name: 'watering can' });
  // the basket on the back: its side card right behind the torso's (a plane aside where it passes the head's profile),
  // its card behind both (seen from behind: the weave on its back); greens poke up at the shoulders
  const basket = (side) => P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink('#3f7a3a'); for (const [x, a] of [[-0.18, -0.3], [-0.02, 0.1], [0.14, 0.4]]) D.poly(gg, [[x - 0.05, 0.8], [x + 0.05, 0.8], [x + Math.sin(a) * 0.3 + 0.03, 1.32], [x + Math.sin(a) * 0.3 - 0.03, 1.32]]);
    gg.fillStyle = ink(side ? '#a67c40' : '#b58a4a'); D.rect(gg, side ? -0.22 : -0.32, 0, side ? 0.44 : 0.64, 0.86, 0.1);
    gg.fillStyle = ink('#8a6230', 'print'); for (let k = 0; k < 4; k++) D.rect(gg, side ? -0.22 : -0.32, 0.12 + k * 0.18, side ? 0.44 : 0.64, 0.05);
  }, { w: 0.75, h: 1.4, name: 'basket' });
  const basketSide = basket(true), bs = ext(basketSide), basketY = 0.96, DEPTH = 0.25;   // its depth: the side card trimmed
  const basketSideZ = jacketBack - GAP - bs.x1, basketZ = basketSideZ + bs.x1 - DEPTH - GAP - T / 2;
  card(basketSide, 361, { x: T + SIDE, y: basketY, z: basketSideZ, ry: PROFILE, name: 'basket side', cut: band(basketSide[0], bs.x1 - DEPTH, 9, 0) });
  card(basket(false), 360, { y: basketY, z: Math.min(basketZ, headBack - T / 2 - GAP), name: 'basket' });
  // the stride (motion.md section 8): the phase runs with the distance walked; in the stance a leg's angle is LINEAR in
  // distance, so the planted foot stays put; the swing eases forward; arms swing opposite the legs (the loaded arm
  // less); the body bobs twice per stride. Rotation only, never a scale.
  const legLen = 0.97 * 1.25, stepLen = 1.2, R = stepLen / (2 * legLen);
  const leg = (ph, gait) => { const u = (ph / Math.PI) % 2, A = gait * R; if (u >= 1) return A * (3 - 2 * u); const e = u * u * (3 - 2 * u); return A * (2 * e - 1); };
  g.userData.stride = (walked, gait) => {
    const ph = walked / stepLen * Math.PI, l0 = leg(ph, gait), l1 = leg(ph + Math.PI, gait);
    legs[0].rotation.x = -l0; legs[1].rotation.x = -l1;              // + forward = the foot toward +z
    arms[0].rotation.x = l0 * 0.7; arms[1].rotation.x = l1 * 0.7 * 0.3;   // opposite the leg on its side; the can arm swings less
    body.position.y = Math.abs(Math.sin(ph)) * 0.05 * gait;
  };
  return g;
};


// ---- 4. ?test: the material on a few cards under the final light and lens (workflow step 2) ----------------------
if (flags.TEST) {
  { const doll = heroDoll(); H.setHero(popup(null, null, { node: doll, height: 3.1, x: 2, z: -4, sway: 0.2, scale: 1.25 }), { stride: doll.userData.stride }); }
  popup(...K.tree(), { x: -3, z: -8, cross: true, sway: 0.8 }); bushStack(6.5, -6, {}); popup(...K.rock(), { x: -1, z: -2.5, yaw: -0.2 });
  H.glowing(popup(null, null, { node: boxHouse({ w: 4.8, d: 3.8, wallH: 3.4, roofH: 2.5, colors: houseColors(C.roof), paper: H.paper, seed: 79 }), height: 5.9, x: 9, z: -11, yaw: -0.3 }).group);
} else buildWorld();

// ---- 6. a living world (references/motion.md section 12): THIS world's weather and creatures, chosen for an autumn
// countryside: leaves falling in the trees' own colours, a few birds crossing above the treetops, butterflies at the
// flower beds, smoke from the chimneys, cloud shadows, ducks drifting on the water, hens that peck and scatter, a fox
// that bounds away from the hero, cats that wander and nap. Another brief picks its own (snow, petals, rain and mist,
// dust and gusts, bubbles and fish...), in its own colours: never this list by default.
if (!flags.TEST) {
  const life = createLife({ scene: H.scene, camera: H.camera, heroHeight: H.heroHeight, seed: 41, wind: [0.94, 0.34] });
  // ambient counts scale with the quality tier (Q, above: 60/36/20 fallers, 8/5/3 flyers, 4/2/1 cloud shadows) — the
  // frame budget goes to the world itself; the flock and the chimney puffs are few enough to leave alone. The fallers
  // and flyers kinds are kept (PF_LIFE): their update() re-derives counts from their day/night factors EVERY frame, so
  // a live tier step-down (section 10) thins them without a rebuild. Cloud shadows have no count dial (their factor
  // only fades opacity), so on a step-down they stay — four soft sheets are no frame cost to speak of.
  PF_LIFE.push([life.fallers({ count: Q.fallers, cut: 'leaf', colors: [C.leafA, C.leafB, C.leafC, '#a8452a'], size: [0.2, 0.3], land: 9 }), 'fallers']);
  life.flock({ size: 5, height: 3.4, colors: ['#f6f1e6', '#e9e2d4'] });
  PF_LIFE.push([life.flyers({ count: Q.flyers, colors: ['#fff6e0', '#f6c64a', '#ef8a3c'], anchors: LIFE.flowers.slice(0, 8), roam: 1.4 }), 'flyers']);
  life.puffs({ at: LIFE.chimneys, perEmitter: 3, life: 4.5, rise: 0.45, size: [0.2, 0.45], colors: ['#f3e8d2', '#ece0c8'] });   // paper discs with a cut spiral, just above the chimney
  life.cloudShadows({ count: Q.clouds });
  for (const [h, roam] of LIFE.floaters) life.critter(h.group, { behaviour: 'float', roam });
  for (const [h, behaviour] of LIFE.creatures) life.critter(h.group, { behaviour, hero: H.hero.group.position, walk: H.walk, roam: 1.2 });
  life.setNight({ night: 1, dusk: 0.5 }[flags.MOOD] ?? 0);   // butterflies sleep, fewer birds, no smoke at night
  life.reset(H.target);
  H.onStep((t, dt) => life.update(dt, H.target));
  H.onRestart(() => life.reset(H.target));
}

// ---- 5. the world: landmarks and built ground by hand, then the fill ------------------------------------------------
function buildWorld() {
  const side = (z) => Math.sign(pathX(z) - riverX(z)) || 1;          // the side of the path away from the river
  const at = (z, off) => [pathX(z) + side(z) * off, z];
  // the hamlet: box-fold houses (gables open first, then the roof), a well, life at the doors
  const homes = [[at(-11, 5.5), { w: 5.4, d: 4.2, wallH: 3.7, roofH: 2.7 }, C.roof, 71, -0.25, 3.4, 4.4], [at(-4.5, 7), { w: 4.2, d: 3.6, wallH: 3.1, roofH: 2.3, windows: 1 }, C.roofB, 73, -0.5, 2.9, 3.8], [at(-17.5, 6.5), { w: 4.8, d: 3.8, wallH: 3.4, roofH: 2.5 }, C.roofC, 79, 0.2, 3.1, 4]];
  for (const [[x, z], dims, roof, seed, yaw, solid, keep] of homes) {
    const node = boxHouse({ ...dims, colors: houseColors(roof), paper: H.paper, seed, print: H.cardOpts(x, z) });
    const h = popup(null, null, { node, height: dims.wallH + dims.roofH, x, z, yaw, solid });   // print quality follows the lens
    if (node.userData.chimneyTop) LIFE.chimneys.push(node.userData.chimneyTop);
    H.glowing(h.group); H.lamp(x + Math.sin(yaw) * 2.6, 2.2, z + Math.cos(yaw) * 2.6, 1, 11); mark(x, z, keep);   // a warm pool at the door at dusk
  }
  // a small scene beside each door (2-3 different pieces, never the same set twice): a home reads as lived in
  const DOOR = [['flowers', 'barrel', 'hen'], ['bench', 'flowers'], ['hay', 'barrel', 'cat']];
  homes.forEach(([[x, z], dims, , , yaw], i) => {                    // at the front corner away from the path
    const u = side(z) * (dims.w / 2 + 1.3), v = dims.d / 2 + 1.1, gx = x + u * Math.cos(yaw) + v * Math.sin(yaw), gz = z - u * Math.sin(yaw) + v * Math.cos(yaw);
    group(gx, gz, DOOR[i], 0.6, (px, pz) => pathDist(px, pz) > 1.7 && riverDist(px, pz) > 3.4); mark(gx, gz, 1.8);
  });
  { const [x, z] = at(-8, 10.5); popup(...K.well(), { x, z, yaw: -0.3, scale: 1.6, solid: 1.3 }); mark(x, z, 2); }
  { const [x, z] = at(-7.5, 3.4); group(x + 2.6, z, ['barrel', 'bush', 'cat']); mark(x + 2.6, z, 2.6); }
  { const [x, z] = at(-14.5, 2.6); group(x, z, ['hen', 'flowers', 'tuft']); mark(x, z, 2.4); }
  { const [x, z] = at(-1, 11); group(x, z, ['shrub', 'barrel']); mark(x, z, 2.4); }
  for (const z of [0, 4.2]) { const [x] = at(z, 2.6); popup(...K.fence(), { x, z, yaw: -0.55 + (z > 2 ? 0.25 : 0) }); mark(x, z, 2.2); }
  for (const [z, sd] of [[-6, 1], [-15, -1]]) { const x = pathX(z) + side(z) * sd * 1.9; popup(...K.lamp(), { x, z, scale: 1.25 }); mark(x, z, 1); H.lamp(x, 3.6, z + 0.3, 0.66, 9); }
  // the river crossing: a BUILT bridge (deck ramps + crown, leaning parapet sides, posts), its span along the path and
  // long enough to clear the river band where the path crosses it obliquely; the hero walks over it (walk field)
  let bz = -20; for (let z = -42; z < 10; z += 0.1) if (Math.sign(pathX(z) - riverX(z)) !== Math.sign(pathX(z + 0.1) - riverX(z + 0.1))) { bz = z; break; }
  {
    const dxp = pathX(bz + 0.5) - pathX(bz - 0.5), dxr = riverX(bz + 0.5) - riverX(bz - 0.5);
    const yawB = Math.atan2(dxp, 1), cross = Math.abs(Math.sin(yawB - Math.atan2(dxr, 1))), span = Math.min(15, 2 * 3.4 / Math.max(0.4, cross) + 1.6);
    const br = popup(null, null, { node: bridge({ span, width: 3.2, paper: H.paper, colors: { stone: C.stone, wood: C.wood }, seed: 91,
      paints: { deck: EX.paintWood({ wood: C.wood }, { planks: 5 }), side: (deckH, arch) => EX.paintBridgeSide({ stone: C.stone, wood: C.wood }, { deckH, arch }) } }), height: 4, x: riverX(bz), z: bz, yaw: yawB, self: true });
    br.pivot.children[0].name = 'bridge'; walk.add(br.pivot.children[0]); mark(riverX(bz), bz, span / 2 + 1.2); H.spots.bridge = [riverX(bz), bz, yawB, span];
  }
  { const z = bz + 4, [x] = at(z, 2.2); popup(...K.sign(), { x, z, yaw: -0.4 }); mark(x, z, 1.2); }
  walk.block((x, z) => riverDist(x, z) < 2.8);                         // the water blocks the walk except on a deck
  for (const [z, dx, yaw, sc] of [[-11, -0.8, 0.5, 1.0], [-9.5, 0.6, -0.35, 0.85]]) LIFE.floaters.push([popup(...K.duck(), { x: riverX(z) + dx, z, yaw, scale: sc }), 0.3]);   // twins vary in size and turn
  // the pond and its jetty: an OPEN construction (a posts face, a plank deck, a posts support: platform() with the
  // deck's walk surface), low over the water, reached from the bank; the water blocks the walk everywhere else.
  {
    const JW = 6, JD = 2, JH = 0.55, x0 = POND.x + POND.rx * 0.95, jx = x0 - JW / 2 + 0.4, jz = POND.z + JD / 2;
    const posts = (w, h) => P2.fromDrawing((gg) => { D.rect(gg, -w / 2, h - 0.16, w, 0.16); const n = Math.round(w / 0.75); for (let i = 0; i <= n; i++) D.rect(gg, -w / 2 + (n ? i * (w - 0.16) / n : 0), 0, 0.16, h); }, { w: w + 0.1, h: h + 0.05, name: 'posts' });
    const wood = (n, vertical) => EX.paintWood({ wood: C.wood }, { planks: n, vertical });
    const jetty = platform({ w: JW, d: JD, h: JH, paper: H.paper, seed: 141, facePts: posts(JW, JH), supportPts: posts(JW * 0.9, JH).map(([px, py]) => [px, py - JH]),
      paints: { face: wood(1, true), deck: wood(Math.round(JW / 0.42), true), support: wood(1, true) }, print: H.cardOpts(jx, jz) });
    jetty.name = 'jetty';
    const j = popup(null, null, { node: jetty, height: JH, x: jx, z: jz, level: true });
    walk.add(jetty); H.spots.jetty = [jx, jz, JW, JD, JH];
    const o = j.order + 0.5;
    for (const dx of [-JW / 2 + 0.2, -JW / 2 + 1.4]) popup(posts(0.18, 1.1), wood(1, true), { parent: jetty.userData.deck, x: dx, z: 0.05, order: o });   // mooring posts
    popup(...K.boat(), { x: jx - JW / 2 + 0.6, z: jz + 1.5, yaw: 0.25, scale: 1.3, sway: 0.35 });
    for (const [a, r] of [[2.3, 1.02], [2.9, 1.04], [3.9, 1.0], [4.6, 1.03], [5.6, 1.05]]) popup(...K.reeds(), { x: POND.x + Math.cos(a) * POND.rx * r, z: POND.z + Math.sin(a) * POND.rz * r, yaw: (rnd() - 0.5) * 0.6, sway: 0.7 });
    LIFE.floaters.push([popup(...K.duck(), { x: POND.x - 2.6, z: POND.z + 1.4, yaw: 0.65, scale: 1.12 }), 0.5]);
    walk.block((x, z) => inPond(x, z, 0.98));
    mark(POND.x, POND.z, Math.max(POND.rx, POND.rz) * 1.08);
  }
  // a rock outcrop and life on the far bank of the pond
  { const x = POND.x - POND.rx - 2.5, z = POND.z - 1.5; if (free(x, z, 1)) { rockOutcrop(x, z); mark(x, z, 3.2); } }
  // nested landforms in the mid-ground, in the open ground the fill leaves: volume from stepped cards, not only boxes
  for (const [x, z, o] of [[30, -8, { col: C.hillB, yaw: -0.25 }], [-17, 4, { w: 3.8, h: 4.2, yaw: 0.3 }], [25, 7, { w: 3.6, h: 3.8, n: 3, col: C.hillB, yaw: -0.15 }], [8, -16, { w: 4.4, h: 5, yaw: 0.1 }]])
    if (free(x, z, 1.5)) { hillock(x, z, o); mark(x, z, (o.w || 4.2) * 0.8); }
  popup(...K.boat(), { x: riverX(-27) + 0.4, z: -27, yaw: 0.3, scale: 1.6, sway: 0.35 });
  for (const [z, sd] of [[-38, -1], [-30, 1], [-14, -1], [-6, 1], [-2, -1]]) { const x = riverX(z) + sd * 4.6; popup(...K.reeds(), { x, z, yaw: (rnd() - 0.5) * 0.6, sway: 0.7 }); mark(x, z, 1.6); }
  // layered hills at the far edge (never walked on): 3 parallel cards stepping back, alternating tones
  for (const [hx, hz] of [[-30, -34], [26, -33]]) { for (let k = 0; k < 3; k++) popup(...K.hill(k), { x: hx + (k - 1) * 0.8, z: hz + k * 1.3 }); mark(hx, hz + 1.3, 5.5); }
  for (const [dx, dz] of [[-3, -1], [2, 0.8], [5.5, -1.6]]) popup(...K.hay(), { x: fields[0][0] + dx, z: fields[0][1] + dz, yaw: (rnd() - 0.5) * 0.5 });
  mark(fields[0][0], fields[0][1], 7.5); mark(fields[1][0], fields[1][1], 6.5);
  // the hero, off-centre on the path (lower right third), and a bench to rest on
  const doll = heroDoll(), hero = popup(null, null, { node: doll, height: 3.1, x: HERO_AT[0], z: HERO_AT[1], sway: 0.2, scale: 1.25 }); H.setHero(hero, { stride: doll.userData.stride });
  { const [x, z] = at(6.5, 3); popup(...K.bench(), { x, z, yaw: -0.3 }); mark(x, z, 2.2); mark(pathX(3), 3, 2.4); }

  // the fill: a slow noise decides woods (high), groups (middle) and clearings (low), only where the camera can see:
  // the overview (inFrame) alone — this game is a fixed diorama (play: false), so the ring past the frame that a
  // walking camera could bring is never printed (the old ring fill cost ~half the build for a view nobody sees).
  // Every cell draws from its own seed, so each frame shape (16:9, 9:16, 1:1) and each camera sees the same pieces at
  // the same places: the frame only decides which cells are built
  rnd = P2.rng(202);
  const cellSeed = (gx, gz, salt) => (Math.imul(Math.round(gx * 10), 73856093) ^ Math.imul(Math.round(gz * 10), 19349663) ^ Math.imul(salt, 83492791)) >>> 0;
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const lush = (x, z) => 0.5 + 0.24 * Math.sin(x * 0.12 + ph[0]) * Math.sin(z * 0.14 + ph[1]) + 0.16 * Math.sin(x * 0.21 + z * 0.15 + ph[2]) + 0.1 * Math.sin(x * 0.05 - z * 0.31 + ph[3]);
  const trees = [], placed = [];
  const DRESS = ['bush', 'bush', 'shrub', 'rock', 'rock', 'tuft', 'flowers', 'flowers', 'mushroom', 'mushroom', 'stump', 'fox', 'cat'];
  const CAP = { fox: 2, cat: 2 }, used = {};   // at most a few identical props or creatures in view: clones read as a demo
  const kindsFor = (n) => { const out = []; n = Math.min(n, [...new Set(DRESS)].filter((k) => (used[k] || 0) < (CAP[k] ?? Infinity)).length); while (out.length < n) { const k = DRESS[Math.floor(rnd() * DRESS.length)]; if (!out.includes(k) && (used[k] || 0) < (CAP[k] ?? Infinity)) { out.push(k); used[k] = (used[k] || 0) + 1; } } return out; };   // never more kinds than are left
  // tall pieces in FRONT of the subject hide it in a down-looking view: keep a low-dress corridor before the hero
  const [hx0, hz0] = [hero.group.position.x, hero.group.position.z];
  const corridor = (x, z) => z > hz0 - 1 && z < hz0 + 16 && Math.abs(x - hx0) < 7 + (z - hz0) * 0.35;
  const fillGroups = (see) => { for (let gz = -46; gz <= 18; gz += 3.1) for (let gx = -46; gx <= 46; gx += 3.1) {
    rnd = P2.rng(cellSeed(gx, gz, 19));
    const x = gx + (rnd() - 0.5) * 2.6, z = gz + (rnd() - 0.5) * 2.6, l = lush(x, z);
    if (!see(x, z, 0.12, 4) || l < 0.26 || placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 3.0)) continue;
    placed.push([x, z]);
    if (l > 0.55 && free(x, z, 1.6) && !corridor(x, z) && trees.every(([tx, tz]) => Math.hypot(x - tx, z - tz) > 4.8)) {   // canopies never stack
      trees.push([x, z]);
      if (rnd() < 0.3) popup(...K.pine(), { x, z, cross: true, sway: 0.5 });
      else popup(...K.tree(), { x, z, cross: true, sway: 0.8 });
    } else if (free(x, z, 1.0)) group(x, z, kindsFor(4 + Math.floor(rnd() * 4)), 1.15);   // groups of 4-7 different pieces
  } };
  fillGroups(H.inFrame);
  // small fillers between the groups (tufts, flowers, mushrooms, stones), never in the clearings: the sharp band of the
  // shipped frames is ~45-55 % open ground (measure.py barePct)
  const fillSmall = (see, z0 = -30, x0 = 40) => { for (let gz = z0; gz <= 12; gz += 2.0) for (let gx = -x0; gx <= x0; gx += 2.0) {
    rnd = P2.rng(cellSeed(gx, gz, 69));
    const x = gx + (rnd() - 0.5) * 1.6, z = gz + (rnd() - 0.5) * 1.6, l = lush(x, z);
    if (!see(x, z, 0.05, 1) || l < 0.26 || !free(x, z, 0.4) || placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.8)) continue;
    placed.push([x, z]);
    const k = ['tuft', 'flowers', 'mushroom', 'tuft', 'rock'][Math.floor(rnd() * 5)];
    popup(...K[k](), { x, z, yaw: (rnd() - 0.5) * 0.7, scale: 0.65 + rnd() * 0.25, sway: k === 'tuft' || k === 'flowers' ? 0.6 : 0 });
  } };
  fillSmall(H.inFrame);
  // big, blurred pieces overlapping the bottom edge sell the miniature scale
  rnd = P2.rng(303);
  // placed across THIS frame's bottom edge (screen x -1..1), a few units nearer than the page there, so every format
  // (a narrow 9:16 frame too) gets them
  for (const [sx, dz, s, kind] of [[-1.05, 5.2, 2.0, 'tree'], [-0.38, 6.7, 1.8, 'bush'], [1.05, 7.2, 2.1, 'tree'], [0.3, 8.2, 1.5, 'bush']]) {
    const p = H.groundAt(sx, -1); if (!p) continue;
    const x = p.x, z = p.z + dz;
    if (kind === 'bush') bushStack(x, z, { scale: s, yaw: (rnd() - 0.5) * 0.4 });
    else popup(...K.tree(), { x, z, cross: true, scale: s, sway: 0.6 });
  }
  H.board = { trees, placed };   // paperfolk: the hiding-place candidates (every standing piece the fill placed)
}

// ---- 9. PAPERFOLK: the game layer on this board ---------------------------------------------------------------------
// Eight little paper creatures are placed by seed among the pieces. Six face the camera (find them in the raised
// world); two are SHY: they stand with their plain kraft backs turned, and their printed faces show only when the
// page is folded flat. Click a folk to greet it; click empty page to fold the world. All eight found folds the world
// shut and reopens it, with the time on a paper card. ?seed=N replays the same hiding places; a new seed hides anew.
const PFG = (() => {
  const GQ = new URLSearchParams(location.search);
  const SEED = +(GQ.get('seed') || 0) || 1 + Math.floor(Math.random() * 999);
  const pr = P2.rng(SEED * 7 + 13);

  // the folk: one connected cut each (fromDrawing drops loose parts), a simple layered print (fill + accent + shade)
  const folkPrint = (base, accent, kind = 'dot') => (P) => {
    P.fill(base);
    P.marks(kind, { color: accent, alpha: 0.8, size: 0.09, density: 0.5 });
    P.innerShade('#3a2412', { alpha: 0.4, blurPx: 5 });
  };
  const KINDS = {
    mouse: { s: 1.8, base: '#a3937f', accent: '#e8d9b8', draw: (g) => { D.ell(g, -0.1, 0.34, 0.52, 0.34); D.ell(g, 0.42, 0.3, 0.24, 0.22); D.ell(g, 0.36, 0.56, 0.13, 0.13); D.poly(g, [[0.62, 0.3], [1.15, 0.42], [0.66, 0.18]]); }, w: 2.6, h: 1.2 },
    snail: { s: 2.0, base: '#b5874e', accent: '#efe0c2', draw: (g) => { D.ell(g, -0.15, 0.42, 0.36, 0.36); D.poly(g, [[-0.5, 0.04], [-0.52, 0.26], [-0.2, 0.3], [0.32, 0.26], [0.6, 0.36], [0.66, 0.12], [0.1, 0.02]]); }, w: 2.4, h: 1.3 },
    beetle: { s: 2.4, base: '#b0543a', accent: '#f3e6c8', draw: (g) => { D.ell(g, -0.05, 0.36, 0.5, 0.34); D.ell(g, 0.5, 0.28, 0.15, 0.13); }, w: 2.3, h: 1.2 },
    hedgehog: { s: 2.6, base: '#8a6a4a', accent: '#5a4030', kind: 'hatch', draw: (g) => { D.ell(g, -0.05, 0.3, 0.55, 0.3); D.poly(g, [[0.35, 0.36], [0.78, 0.24], [0.4, 0.16]]); }, w: 2.6, h: 1.1 },
    frog: { s: 3.0, base: '#7a9c5a', accent: '#e8e3c0', draw: (g) => { D.ell(g, 0, 0.26, 0.42, 0.26); D.ell(g, 0.3, 0.36, 0.2, 0.15); }, w: 2.0, h: 1.0 },
    robin: { s: 2.4, base: '#b8503a', accent: '#f0dcbc', draw: (g) => { D.ell(g, 0, 0.3, 0.38, 0.28); D.poly(g, [[-0.3, 0.34], [-0.68, 0.46], [-0.34, 0.2]]); D.ell(g, 0.28, 0.5, 0.16, 0.14); D.poly(g, [[0.4, 0.5], [0.6, 0.46], [0.44, 0.42]]); }, w: 2.4, h: 1.3 },
    moth: { s: 2.6, base: '#d9c9a8', accent: '#5a4a3a', draw: (g) => { D.ell(g, 0, 0.34, 0.14, 0.3); D.ell(g, -0.34, 0.38, 0.3, 0.26); D.ell(g, 0.34, 0.38, 0.3, 0.26); }, w: 2.2, h: 1.2 },
    fish: { s: 1.8, base: '#7fa8b0', accent: '#e8e3c0', draw: (g) => { D.ell(g, 0.05, 0.3, 0.5, 0.24); D.poly(g, [[-0.42, 0.3], [-0.75, 0.46], [-0.75, 0.14], [-0.45, 0.22]]); }, w: 2.4, h: 1.0 },
  };
  // fromDrawing keeps the drawing's own coordinates: scale the traced outline up to the kind's real size (the kit's
  // own stump example does exactly this), so a folk is a readable ~1.2-tall card, not a fingernail
  const folkPiece = (k) => { const K = KINDS[k]; return [P2.fromDrawing(K.draw, { w: K.w, h: K.h, name: 'folk-' + k }).map(([x, y]) => [x * K.s, y * K.s]), folkPrint(K.base, K.accent, K.kind || 'dot')]; };

  // hiding spots. Spotters tuck near standing pieces inside the frame's sharp band. Shy folk need OPEN ground:
  // a card folded back covers the page behind it, so a shy folk beside a tall piece would be buried under the flat
  // stack instead of showing its printed face on top of it.
  // folk and pieces never share ground. Small dressing (tufts, flowers, mushrooms) is EVERYWHERE — a folk's spot
  // clears a little nest of it instead of hunting for a gap that cannot exist. Trees and other TALL pieces stay:
  // the folk keeps its distance from their cards, and they remain its hiding.
  const isTree = (x, z) => H.board.trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 0.6);
  const hingeSize = (h) => {
    let w = 0, maxY = 0;
    h.group.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox; if (!b) return;
      w = Math.max(w, (b.max.x - b.min.x) * (o.scale.x || 1));
      maxY = Math.max(maxY, b.max.y * (o.scale.y || 1));
    });
    return { w, maxY };
  };
  const bigPieceNear = (x, z) => {   // cards are blades, not discs: only the strip along a tall card's own axis is barred
    for (const h of H.hinges) {
      if (h === H.hero || !h.group) continue;
      const gp = h.group.position, dx = x - gp.x, dz = z - gp.z, d = Math.hypot(dx, dz);
      if (isTree(gp.x, gp.z)) { if (d < 2.2) return true; continue; }   // a tree's ground print is its narrow trunk cross
      if (d > 5.5) continue;
      const { w, maxY } = hingeSize(h);
      if (maxY < 3.2) continue;                       // small dressing: the nest lifts it off, no need to flee it
      const yaw = h.group.rotation.y || 0, ca = Math.cos(yaw), sa = Math.sin(yaw);
      if (Math.abs(dx * ca - dz * sa) < w / 2 + 1.4 && Math.abs(dx * sa + dz * ca) < 1.0) return true;
    }
    return false;
  };
  const clearNest = (x, z, r = 2.0) => {              // lift the small dressing off the folk's little nest
    for (let i = H.hinges.length - 1; i >= 0; i--) {
      const h = H.hinges[i]; if (h === H.hero || !h.group) continue;
      const gp = h.group.position;
      if (Math.hypot(gp.x - x, gp.z - z) > r) continue;
      if (isTree(gp.x, gp.z) || hingeSize(h).maxY >= 3.2) continue;
      H.scene.remove(h.group); H.hinges.splice(i, 1);
    }
  };
  // folk only mind the water and the path: keepOut circles guard landmarks from the FILL, but a folk tucked at a
  // doorstep, a bridge end or a hay bale is exactly the hiding this game wants (the blade rule still keeps it off
  // every real card, and the nest clears the small dressing underfoot)
  const folkFree = (x, z, m = 0.45) => riverDist(x, z) > 3.4 + m && pathDist(x, z) > 1.7 + m;
  // the greeter: one of the eight is placed by hand beside the path, a few units toward the camera and on the side
  // toward the frame's middle (the hero stands right of centre), so the first find is always in clear view. The seeded
  // spots keep their distance from this reserved ground.
  const GREETER_AT = [HERO_AT[0] - 3.35, HERO_AT[1] + 0.7];
  const cands = [];
  for (const [ax, az] of [...H.board.trees, ...H.board.placed]) {
    if (az < -22 || az > 6 || !H.inFrame(ax, az, 1)) continue;
    cands.push([ax, az]);
  }
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(pr() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  const spots = [], spares = [];
  const spotOk = (x, z) => z >= -22 && z <= 6.5 && folkFree(x, z, 0.6) && !inPond(x, z, 1.15) && H.inFrame(x, z, 8)
    && !bigPieceNear(x, z)
    && Math.hypot(x - HERO_AT[0], z - HERO_AT[1]) > 6
    && Math.hypot(x - GREETER_AT[0], z - GREETER_AT[1]) > 6.5
    && spots.every(([px, pz]) => Math.hypot(x - px, z - pz) > 9) && spares.every(([px, pz]) => Math.hypot(x - px, z - pz) > 6);
  for (const [ax, az] of cands) {
    if (spots.length >= 6 && spares.length >= 5) break;
    for (let t = 0; t < 6; t++) { const x = ax + (pr() - 0.5) * (t ? 3.8 : 1), z = az + (pr() - 0.5) * (t ? 3.8 : 1); if (spotOk(x, z)) { (spots.length < 6 ? spots : spares).push([x, z]); break; } }
  }
  const PFFALL = [[POND.x - POND.rx - 3.6, POND.z + 1.6], [fields[1][0] - 6.5, fields[1][1] + 3.2], [pathX(-17) + 4.2, -17.5], [pathX(9) - 4.4, 4.5], [fields[0][0] + 8, fields[0][1] - 4.5], [POND.x + POND.rx + 3.2, POND.z - 2.5]];
  for (const [fx, fz] of PFFALL) { if (spotOk(fx, fz)) (spots.length < 6 ? spots : spares).push([fx, fz]); }
  for (let tries = 0; (spots.length < 6 || spares.length < 4) && tries < 6000; tries++) {
    const x = (pr() - 0.5) * 64, z = -21 + pr() * 26;
    if (spotOk(x, z)) (spots.length < 6 ? spots : spares).push([x, z]);
  }
  // shy spots: open ground, nothing tall SOUTH of them (nearer the camera) whose folded card would cover them —
  // trees cover ~9 of page behind them, low dressing ~3.5, landmarks ~6 — and never on another folk's spot
  const shySpots = [];
  for (let tries = 0; shySpots.length < 2 && tries < 8000; tries++) {
    const x = (pr() - 0.5) * 60, z = -21 + pr() * 26;
    const openGround = H.board.trees.every(([px, pz]) => pz <= z || pz - z > 9 || Math.abs(px - x) > 6)
      && H.board.placed.every(([px, pz]) => pz <= z || pz - z > 3.5 || Math.abs(px - x) > 4)
      && keepOut.every(([hx, hz, r]) => hz <= z || hz - z > 6 || Math.abs(hx - x) > r + 3);
    if (z >= -22 && z <= 6.5 && folkFree(x, z, 1.2) && !inPond(x, z, 1.3) && H.inFrame(x, z, 8) && !bigPieceNear(x, z)
      && Math.hypot(x - HERO_AT[0], z - HERO_AT[1]) > 6 && openGround
      && Math.hypot(x - GREETER_AT[0], z - GREETER_AT[1]) > 7
      && [...spots, ...spares, ...shySpots].every(([px, pz]) => Math.hypot(x - px, z - pz) > 9)) shySpots.push([x, z]);
  }
  for (let i = 0; i < 2; i++) if (!shySpots[i]) shySpots[i] = (spares.length >= 2 ? spares.splice(spares.length - 2 + i, 1)[0] : [(pr() - 0.5) * 50, -12 + pr() * 14]);

  // spawn: six spotters facing the camera, two shy folk turned away (kraft backs out; prints show only folded flat)
  const faceCam = (x, z) => Math.atan2(2 - x, 39 - z);
  const order = Object.keys(KINDS); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(pr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const FOLK = [], meshToFolk = new Map();
  function spawn(f, x, z, shy) {
    if (f.h) {   // a respawn (the fixup pass): take the old card off the page first
      H.scene.remove(f.h.group); f.h.pivot.traverse((o) => o.isMesh && meshToFolk.delete(o));
      const hi = H.hinges.indexOf(f.h); if (hi >= 0) H.hinges.splice(hi, 1);
    }
    f.x = x; f.z = z; f.shy = shy;
    clearNest(x, z);   // lift any small dressing off the folk's nest so no cards ever clip
    f.yaw = shy ? faceCam(x, z) + Math.PI : faceCam(x, z) + (pr() - 0.5) * 0.5;
    f.h = popup(...folkPiece(f.kind), { x, z, yaw: f.yaw, sway: f.starter ? 0.4 : shy ? 0.1 : 0.25, scale: f.starter ? 1.2 : shy ? 1.2 : 1 });
    f.h.pivot.traverse((o) => { if (o.isMesh) meshToFolk.set(o, f); });
    if (H.isOpen && H.isOpen()) f.h.reset(1);   // a respawn after the world rose stands up at once: its pose is what the player sees
  }
  for (let i = 0; i < 6; i++) { const f = { id: i, kind: order[i], found: false, h: null, base: KINDS[order[i]].base }; spawn(f, spots[i][0], spots[i][1], false); FOLK.push(f); }
  for (let i = 0; i < 2; i++) { const f = { id: 6 + i, kind: order[6 + i], found: false, h: null, base: KINDS[order[6 + i]].base }; const [sx, sz] = shySpots[i] || spares[spares.length - 1] || [-8, -10]; spawn(f, sx, sz, true); FOLK.push(f); }

  // picking: a short click greets a folk; an empty click falls through to the harness and folds the world
  const ray = new H.THREE.Raycaster();
  let downAt = null, started = false, t0 = 0, done = false, foldedOnce = false;
  const pending = [];
  H.onStep((time, dt) => {
    for (let i = pending.length - 1; i >= 0; i--) { const p = pending[i]; p.t -= dt; if (p.t <= 0) { pending.splice(i, 1); p.fn(); } }
    for (const s of stamps) if (s.t < s.life) { s.t += dt; s.mat.opacity = 0.8 * Math.min(1, s.t / s.life); }   // the ink print drying in
    for (let i = scraps.length - 1; i >= 0; i--) {   // paper scraps: a short outward arc, gravity, a slow turn, then gone
      const s = scraps[i]; s.t += dt; s.vy -= 6.5 * dt;
      s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt;
      if (s.m.position.y < 0.06) { s.m.position.y = 0.06; s.vy *= -0.2; s.vx *= 0.7; s.vz *= 0.7; }
      s.m.rotation.x += s.rx * dt; s.m.rotation.z += s.rz * dt;
      s.mat.opacity = 0.95 * Math.min(1, Math.max(0, (s.life - s.t) / 0.3));
      if (s.t >= s.life) { H.scene.remove(s.m); scraps.splice(i, 1); }
    }
    if (!foldedOnce && H.isOpen() === false) { foldedOnce = true; toast('two shy folk show their faces only on the folded page'); }
  });
  const after = (t, fn) => pending.push({ t, fn });
  const pickFolk = (cx, cy) => {
    ray.setFromCamera(ndcAt(cx, cy), H.camera);
    ray.far = Infinity;   // a probe (visibility) leaves a short far behind: never let it cull a player's click
    const hits = ray.intersectObjects([...meshToFolk.keys()], false);
    if (!hits.length) return null;
    const f = meshToFolk.get(hits[0].object);
    return f && !f.found ? f : null;
  };
  addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
    if (!started && !done) { started = true; t0 = performance.now(); }
  }, { capture: true });
  addEventListener('pointerup', (e) => {
    if (downAt === null || done) { downAt = null; return; }
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y); downAt = null;
    if (moved > 6) return;
    const f = pickFolk(e.clientX, e.clientY);
    if (f) { e.stopImmediatePropagation(); collect(f); }   // a folk greets; the page does not fold under it
  }, { capture: true });

  // the HUD: a row of paper tokens, a fading hint, a toast, an end card (HTML in the papercraft style)
  const $ = (id) => document.getElementById(id);
  const tokens = $('folk-tokens');
  if (tokens) for (const f of FOLK) { const t = document.createElement('div'); t.className = 'token' + (f.shy ? ' shy' : ''); t.id = 'tok' + f.id; t.style.setProperty('--base', f.base); tokens.appendChild(t); }
  const toastBox = $('toast'); let toastTimer = null;
  function toast(msg) { if (!toastBox) return; toastBox.textContent = msg; toastBox.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastBox.classList.remove('show'), 5200); }
  setTimeout(() => { const hint = $('hint'); if (hint) hint.classList.add('fade'); }, 16000);

  // ---- the found flourish: one coordinated ~0.8 s beat, all on the harness clock -------------------------------
  // A found folk hops on its hinge (three beats, then settled), prints a small ink "found" ring with a check on the
  // ground where it stood (it stays for the round, and shows on the folded page too), throws 5-7 card scraps, and its
  // HUD token pastes in (the CSS keyframe in index.html). No screen shake, no flashing: one calm, tactile "yes".
  let stampTex = null, stampGeo = null;
  const stamps = [];
  function stampTexture() {
    if (stampTex) return stampTex;
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    const q = c.getContext('2d'); q.translate(N / 2, N / 2);
    q.strokeStyle = C.ink; q.lineCap = q.lineJoin = 'round';
    q.lineWidth = N * 0.026; q.setLineDash([N * 0.05, N * 0.045]);   // a dashed ink ring, like a hand stamp
    q.beginPath(); q.arc(0, 0, N * 0.335, 0.4, Math.PI * 2 + 0.1); q.stroke();
    q.setLineDash([]); q.lineWidth = N * 0.04;
    q.beginPath(); q.moveTo(-N * 0.145, N * 0.015); q.lineTo(-N * 0.035, N * 0.13); q.lineTo(N * 0.165, -N * 0.125); q.stroke();
    stampTex = new H.THREE.CanvasTexture(c);
    stampTex.colorSpace = H.THREE.SRGBColorSpace; stampTex.anisotropy = 4;
    return stampTex;
  }
  function stampAt(f) {
    stampGeo = stampGeo || new H.THREE.PlaneGeometry(1.4, 1.4);   // one small print, stamped where the folk stood
    const mat = new H.THREE.MeshBasicMaterial({ map: stampTexture(), transparent: true, opacity: 0, depthWrite: false, side: H.THREE.DoubleSide });
    const m = new H.THREE.Mesh(stampGeo, mat);
    m.position.set(f.x, 0.01, f.z);                               // flat on the page, a ground print
    m.rotation.set(-Math.PI / 2, 0, (((f.id * 2.399) % 1) - 0.5) * 0.9);
    m.renderOrder = 1; m.raycast = () => {};                      // a print, never a card: no pick, no probe hit, no hinge
    H.scene.add(m);
    stamps.push({ m, mat, t: 0, life: 0.25 });                    // fades in over ~0.25 s, then stays
  }
  let scrapGeo = null; const scrapMats = [], scraps = [];         // 5-7 scraps: pooled geometry and materials
  function spawnScraps(f) {
    if (!scrapGeo) {
      scrapGeo = new H.THREE.PlaneGeometry(0.2, 0.13);
      for (const col of ['#f3e6c8', '#dcb055']) for (let k = 0; k < 6; k++) scrapMats.push(new H.THREE.MeshBasicMaterial({ color: col, side: H.THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
    }
    const n = 5 + (f.id % 3);                                     // the taste limit: five to seven, no confetti storm
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + 0.6, sp = 1.1 + ((i * 37 + f.id * 11) % 10) / 10 * 1.6;
      const mat = scrapMats[(i + f.id) % scrapMats.length]; mat.opacity = 0.95;
      const m = new H.THREE.Mesh(scrapGeo, mat);
      m.position.set(f.x, 0.55 + (i % 3) * 0.18, f.z);
      m.rotation.set((i % 4) * 0.5, a, (i % 3) * 0.7);
      m.renderOrder = 2; m.raycast = () => {}; m.frustumCulled = false;
      H.scene.add(m);
      scraps.push({ m, mat, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 1.8 + (i % 3) * 0.5, rx: 3 + (i % 3), rz: 2 + (i % 2), t: 0, life: 0.9 });
    }
  }
  function hop(h) {
    // a latched FlapSpring only knows target 0/1, so h.set(1.18) would read as "fall down": drive the same spring by
    // hand instead. p is a fraction of the fold angle (p > 1 leans a little past upright, the spring's own overshoot
    // range); the base never moves, only the fold angle. A card already lying in the folded stack has no standing fold
    // to bounce, so there the stamp and scraps carry the flourish instead of lifting it out of the page.
    if (H.isOpen && H.isOpen() === false) return;
    const sp = h.spring;
    const beat = (p) => { sp.p = p; sp.v = 0; sp.target = 1; sp.locked = true; sp.atRest = false; };
    beat(1.18); after(0.09, () => beat(0.94)); after(0.19, () => beat(1.04)); after(0.30, () => beat(1));
  }
  function foundFlourish(f) {
    hop(f.h);
    stampAt(f);
    spawnScraps(f);
    after(0.25, () => { if (H.sound) H.sound.step({ surface: 'path', seed: 4100 + f.id }); });   // the stamp's quiet tap
  }

  function collect(f) {
    f.found = true;
    hintStuck = 0; if (bf.active) hideButterfly();                  // the butterfly's job is done: no hint for a found world
    if (marker && marker.target === f) clearMarker();               // a marker never rings a folk already found
    H.sound.flap({ size: 0.5, up: true, key: 'folk' + f.id });
    foundFlourish(f);
    plantTag(f);   // the name tag itself reports the find: no toast for collects
    const tok = $('tok' + f.id); if (tok) tok.classList.add('found');
    const n = FOLK.filter((x) => x.found).length;
    const count = $('count');
    if (count) {
      count.textContent = n + ' of ' + FOLK.length;
      count.classList.remove('ping'); void count.offsetWidth; count.classList.add('ping');   // a brief ink ring on the count
    }
    if (n === FOLK.length) win();
  }
  function win() {
    done = true;
    const secs = started ? Math.round((performance.now() - t0) / 1000) : 0;
    after(0.8, () => H.setOpen(false));   // the world folds shut with all the folk inside...
    after(2.6, () => H.setOpen(true));    // ...and opens again
    after(1.1, () => {
      const card = $('endcard'); if (!card) return;
      $('final-time').textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
      $('final-names').textContent = FOLK.map((f) => f.kind).join(', ');
      card.classList.remove('hidden');
    });
  }
  const shuffle = $('shuffle'); if (shuffle) shuffle.addEventListener('click', () => { location.href = location.pathname + '?seed=' + (SEED % 999 + 1) + (GQ.get('tier') ? '&tier=' + GQ.get('tier') : ''); });   // an explicit ?tier= follows the shuffle
  const stay = $('stay'); if (stay) stay.addEventListener('click', () => { const card = $('endcard'); if (card) card.classList.add('hidden'); });

  // the test hook (?probe or window.__paperfolk): positions, screen places, visibility and synthetic clicks.
  // The frame can be letterboxed (?size on a narrow window): every screen<->pixel mapping goes through the canvas
  // rect, never the window, so picks, probes and synthetic clicks all agree with what the player sees.
  const cvEl = () => document.querySelector('canvas');
  const ndcAt = (cx, cy) => { const r = cvEl().getBoundingClientRect(); return { x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1 }; };
  const project = (f) => { const v = new H.THREE.Vector3(f.x, 0.8, f.z).project(H.camera); const r = cvEl().getBoundingClientRect(); return [Math.round(r.left + (v.x + 1) / 2 * r.width), Math.round(r.top + (1 - v.y) / 2 * r.height)]; };
  const safeOnScreen = (f) => { const r = cvEl().getBoundingClientRect(); const [sx, sy] = project(f); return sx > r.left + r.width * 0.12 && sx < r.right - r.width * 0.12 && sy > r.top + r.height * 0.1 && sy < r.bottom - r.height * 0.12; };
  const probeRay = new H.THREE.Raycaster();   // probes keep their own raycaster: they must never touch the pick's far
  function visibility(f) {   // clickability, the way the pick itself works: rays whose FIRST hit is this folk's card
    const cp = H.camera.position.clone(), c = new H.THREE.Vector3(f.x, 0, f.z);
    const dir = c.clone().sub(cp).normalize(), side = new H.THREE.Vector3(-dir.z, 0, dir.x).normalize();
    let score = 0;
    for (const [off, y] of [[0, 0.7], [0.7, 0.4], [-0.7, 0.4], [0.7, 1.0], [-0.7, 1.0], [0, 1.2], [0, 0.35]]) {
      const p = new H.THREE.Vector3(c.x + side.x * off, y, c.z + side.z * off), d = cp.distanceTo(p);
      probeRay.set(cp, p.clone().sub(cp).normalize()); probeRay.far = d + 0.5;
      const hits = probeRay.intersectObjects(H.scene.children, true);
      if (hits.length && meshToFolk.has(hits[0].object)) score++;
    }
    return { clear: score > 0, score, facing: facingOf(f, cp) };
  }
  function facingOf(f, cp) { const nx = Math.sin(f.yaw), nz = Math.cos(f.yaw), L = Math.hypot(cp.x - f.x, cp.z - f.z) || 1; return +((nx * (cp.x - f.x) + nz * (cp.z - f.z)) / L).toFixed(2); }

  // ---- the greeter: one of the eight is placed by hand, in view, and the fixup pass never moves it --------------------
  // Its reserved spot is beside the path by the hero. If a fill piece still hides it (the seed may put a bush there),
  // a deterministic ring of nudges toward the frame's middle finds the first spot that passes the same clearance tests
  // as every other folk AND the actual clickability probe.
  function placeGreeter(f) {
    const ok = (x, z) => z >= -22 && z <= 6.5 && folkFree(x, z, 0.6) && !inPond(x, z, 1.15) && H.inFrame(x, z, 8)
      && !bigPieceNear(x, z) && Math.hypot(x - HERO_AT[0], z - HERO_AT[1]) > 2.6
      && FOLK.every((g) => g === f || Math.hypot(x - g.x, z - g.z) > 5);
    if (f.h && ok(f.x, f.z) && safeOnScreen(f) && visibility(f).clear) { f.ok = true; return true; }   // it already rises in the reserved spot: keep it
    const offs = [[0, 0]];
    for (const r of [0.8, 1.6, 2.4, 3.2]) for (const a of [Math.PI, Math.PI - 0.72, Math.PI + 0.72, Math.PI / 2, -Math.PI / 2, 0.72, -0.72]) offs.push([Math.cos(a) * r, Math.sin(a) * r * 0.7]);
    let best = null, bestScore = -1;
    for (const [dx, dz] of offs) {
      const x = GREETER_AT[0] + dx, z = GREETER_AT[1] + dz;
      if (!ok(x, z)) continue;
      spawn(f, x, z, false);
      if (!safeOnScreen(f)) continue;
      const v = visibility(f);
      if (v.clear) { f.ok = true; return true; }
      if (v.score > bestScore) { bestScore = v.score; best = [x, z]; }
    }
    if (best) { spawn(f, best[0], best[1], false); f.ok = true; return true; }   // the least-blocked nudge still beats a hidden starter
    spawn(f, GREETER_AT[0], GREETER_AT[1], false);
    f.ok = true;
    return false;
  }
  const starter = FOLK.find((f) => !f.shy && f.kind === 'robin') || FOLK.find((f) => !f.shy && f.kind === 'beetle') || FOLK.find((f) => !f.shy);
  if (starter) {
    starter.starter = true;
    spawn(starter, GREETER_AT[0], GREETER_AT[1], false);   // it rises with the world in the reserved spot...
    after(2.0, () => { if (starter && !starter.found) placeGreeter(starter); });              // ...then the raised world's probe confirms or nudges it
  }

  // ---- the paper butterfly: a diegetic stuck hint, on the harness clock -----------------------------------------
  // If nothing is found 30 s after the first interaction (the end-card clock starts on the same pointerdown), then
  // every ~35 s after, a tiny cut-paper butterfly enters from the frame edge, flutters to a point beside the nearest
  // visible unfound folk, hovers, and leaves. It is scene decoration only: no hinge, no meshToFolk entry, no raycast,
  // so it can neither be clicked nor block a probe. It exists only while found === 0 (the getting-started hint).
  const bf = { g: null, wings: [], mats: [], phase: 'idle', t: 0, dur: 0, age: 0, target: null, active: false, tight: false, manual: false, lastTarget: null, leftAt: -1e9,
    from: new H.THREE.Vector3(), to: new H.THREE.Vector3(), away: new H.THREE.Vector3() };
  let marker = null, tag = null;   // the manual hint's ground marker (ring + prize flag) and the found name tag; both live outside H.hinges
  let hintStuck = 0, hintNext = 30;
  const _hv = new H.THREE.Vector3();
  const wingCut = (s) => [[0, 0], [s * 0.09, 0.13], [s * 0.27, 0.21], [s * 0.45, 0.13], [s * 0.4, -0.03], [s * 0.17, -0.08]];
  function butterfly() {
    if (bf.g) return bf.g;
    const g = new H.THREE.Group();
    for (const s of [-1, 1]) {
      const m = makeCard(wingCut(s), { paper: H.paper, thickness: 0.02, edgeWidth: 0.018, pxPerUnit: 96, seed: 1400 + s, back: 'kraft',
        paint: (P) => { P.gradient('#f8eed8', '#e2b562', 0.55); P.marks('dot', { color: '#a8683a', alpha: 0.45, size: 0.035, density: 0.45 }); P.innerShade('#7a4a22', { alpha: 0.3, blurPx: 6 }); } });
      m.position.z = s * 0.004;
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.renderOrder = 999; o.frustumCulled = false; o.raycast = () => {}; o.castShadow = o.receiveShadow = false;
        for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
          mat.depthTest = false; mat.depthWrite = false; mat.transparent = true; mat.opacity = 0.96;
          if (!bf.mats.includes(mat)) bf.mats.push(mat);
        }
      });
      bf.wings.push(m); g.add(m);
    }
    g.name = 'paperfolk-butterfly'; g.visible = false; g.renderOrder = 999;
    g.traverse((o) => { if (o.isMesh) o.visible = false; });
    H.scene.add(g); bf.g = g; return g;
  }
  function bfVisible(v) {
    if (!bf.g) return;
    bf.g.visible = v;
    bf.g.traverse((o) => { if (o.isMesh) o.visible = v; });   // cards()/culling see a hidden hint as absent, not as two stray cards
  }
  function hideButterfly() {
    if (bf.target) { bf.lastTarget = bf.target; bf.leftAt = hintClock; }   // remember the clue for a repeat tap
    bf.active = false; bf.phase = 'idle'; bf.target = null; bfVisible(false);
  }
  // ---- hint v2 helpers: a printed marker on the page, a paper chime, and the found name tag -------------------------
  // All of these are scene decoration with raycast disabled: no hinge, no meshToFolk entry, no probe hit. Textures are
  // drawn once and cached; each marker/tag owns only its materials, so its opacity can fade independently.
  let unitPlane = null;
  const plane = () => unitPlane || (unitPlane = new H.THREE.PlaneGeometry(1, 1));
  const ringTex = new Map(), tagTex = new Map();
  let poleTex = null, clothTex = null, measureCtx = null;
  function inkTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new H.THREE.CanvasTexture(c);
    t.colorSpace = H.THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  function ringTexture(r) {   // a bold dashed ink ring with a thin cream halo, drawn once per radius
    const key = r.toFixed(2);
    if (ringTex.has(key)) return ringTex.get(key);
    const N = 512, ext = r + 0.22, rad = (N / 2) * (r / ext), unit = N / (2 * ext);
    const tex = inkTex(N, N, (q) => {
      q.translate(N / 2, N / 2); q.lineCap = 'round';
      q.strokeStyle = 'rgba(246,236,212,.92)'; q.lineWidth = 0.30 * unit;
      q.beginPath(); q.arc(0, 0, rad, 0, Math.PI * 2); q.stroke();
      q.strokeStyle = C.ink; q.lineWidth = 0.16 * unit;
      q.setLineDash([0.34 * unit, 0.24 * unit]);
      q.beginPath(); q.arc(0, 0, rad, 0.36, Math.PI * 2 + 0.3); q.stroke();
    });
    ringTex.set(key, tex); return tex;
  }
  function flagTexture() {
    if (!poleTex) poleTex = inkTex(32, 512, (q, w, h) => {
      q.fillStyle = '#eddcb9'; q.fillRect(0, 0, w, h);
      q.strokeStyle = 'rgba(58,36,18,.28)'; q.lineWidth = 3; q.beginPath(); q.moveTo(w * 0.66, 0); q.lineTo(w * 0.66, h); q.stroke();
      q.strokeStyle = C.ink; q.lineWidth = 6; q.strokeRect(3, 3, w - 6, h - 6);
    });
    if (!clothTex) clothTex = inkTex(256, 160, (q, w, h) => {
      q.clearRect(0, 0, w, h);
      q.beginPath(); q.moveTo(3, 10); q.quadraticCurveTo(w * 0.56, 16, w - 3, h / 2);
      q.quadraticCurveTo(w * 0.56, h - 16, 3, h - 10); q.closePath();
      q.fillStyle = '#f8eed8'; q.fill(); q.strokeStyle = C.ink; q.lineWidth = 5; q.stroke();
      q.fillStyle = C.ink; q.fillRect(3, 9, 4, h - 18);                       // the hoist, inked
      q.beginPath();                                                          // a small coral star print
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 11 : 25; q.lineTo(66 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr); }
      q.closePath(); q.fillStyle = '#c9542b'; q.fill();
    });
  }
  function besideSpot(f, off, toward = 0, sidesOnly = false) {   // a spot whose screen projection has the most frame room
    const cp = H.camera.position;
    let ax = cp.x - f.x, az = cp.z - f.z;                       // unit vector from the folk toward the camera
    const L = Math.hypot(ax, az) || 1; ax /= L; az /= L;
    const cands = [[-az, ax], [az, -ax]];                       // the two sides, never between the folk and the camera
    if (!sidesOnly) cands.push([-ax, -az]);                     // or behind it, where it can still be seen
    let best = null, bestScore = -Infinity;
    for (const [ux, uz] of cands) {
      const x = f.x + ux * off + ax * toward, z = f.z + uz * off + az * toward;
      const v = _hv.set(x, 1.45, z).project(H.camera);
      const score = (1 - Math.abs(v.x)) * 2 + (1 - Math.abs(v.y)) * 0.35;
      if (score > bestScore) { bestScore = score; best = [x, z]; }
    }
    return { x: best[0], z: best[1] };
  }
  function clearMarker() {
    if (!marker) return;
    H.scene.remove(marker.g);
    for (const m of marker.mats) m.dispose();
    marker = null;
  }
  function plantMarker(f, tight) {
    clearMarker();
    flagTexture();
    const r = tight ? 1.2 : 1.9, off = tight ? 1.0 : 1.6;
    const spot = besideSpot(f, off, 0, false);
    const g = new H.THREE.Group(); g.position.set(f.x, 0, f.z); g.name = 'paperfolk-hint-marker';
    const ringMat = new H.THREE.MeshBasicMaterial({ map: ringTexture(r), transparent: true, opacity: 0, depthWrite: false, side: H.THREE.DoubleSide });
    const ring = new H.THREE.Mesh(plane(), ringMat);
    ring.scale.set(2 * (r + 0.22), 2 * (r + 0.22), 1);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    ring.renderOrder = 3; ring.raycast = () => {}; ring.frustumCulled = false; g.add(ring);
    const poleMat = new H.THREE.MeshBasicMaterial({ map: poleTex, transparent: true, opacity: 0, depthWrite: false, side: H.THREE.DoubleSide });
    const clothMat = new H.THREE.MeshBasicMaterial({ map: clothTex, transparent: true, opacity: 0, depthWrite: false, side: H.THREE.DoubleSide });
    const flag = new H.THREE.Group(); flag.position.set(spot.x - f.x, 0.02, spot.z - f.z);
    flag.scale.x = spot.x < f.x ? -1 : 1;   // the pennant flies away from the folk, not across it
    const pole = new H.THREE.Mesh(plane(), poleMat); pole.scale.set(0.12, 2.9, 1); pole.position.y = 1.45;
    const wave = new H.THREE.Group(); wave.position.set(0.05, 2.32, 0.02);
    const cloth = new H.THREE.Mesh(plane(), clothMat); cloth.scale.set(1.22, 0.78, 1); cloth.position.x = 0.61;
    for (const m of [pole, cloth]) { m.renderOrder = 4; m.raycast = () => {}; m.frustumCulled = false; }
    wave.add(cloth); flag.add(pole, wave); g.add(flag);
    H.scene.add(g);
    marker = { g, flag, wave, ringMat, mats: [ringMat, poleMat, clothMat], t: 0, target: f, tight: !!tight, flagX: spot.x, flagZ: spot.z };
  }
  function stepMarker(dt) {
    if (!marker) return;
    marker.t += dt;
    const t = marker.t;
    if (t >= 7.6) { clearMarker(); return; }
    const a = t < 0.2 ? t / 0.2 : t > 7 ? Math.max(0, 1 - (t - 7) / 0.6) : 1;   // in 0.2 s, hold, out 0.6 s after 7 s
    marker.ringMat.opacity = 0.94 * a;
    for (const m of marker.mats) if (m !== marker.ringMat) m.opacity = 0.97 * a;
    const cp = H.camera.position, wp = marker.flag.position;
    marker.flag.rotation.y = Math.atan2(cp.x - (marker.g.position.x + wp.x), cp.z - (marker.g.position.z + wp.z));
    marker.wave.rotation.y = Math.sin(t * 2.3) * 0.16;
    marker.wave.rotation.z = Math.sin(t * 1.6 + 0.8) * 0.035;
  }
  function chime() {   // two paper-soft notes, 200 ms apart, through the sound engine's own bus (quiet: under a flap)
    const snd = H.sound;
    if (!snd) return;
    try {
      const ctx = snd.ctx || snd.unlock();
      if (!ctx || snd.muted || ctx.state !== 'running') return;
      const bus = (snd.chain && snd.chain.bus) || ctx.destination, t0 = ctx.currentTime + 0.02;
      for (const [freq, at] of [[587.33, 0], [880, 0.2]]) {
        const t = t0 + at, osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        lp.type = 'lowpass'; lp.frequency.value = 2100; lp.Q.value = 0.4;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        osc.connect(lp); lp.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + 0.34);
      }
    } catch { /* an audio-blocked browser simply gets the silent version of the hint */ }
  }
  function tagCard(kind) {   // the little price card: cream stock, neatline, hand-inked 'a <kind>!'
    if (tagTex.has(kind)) return tagTex.get(kind);
    const text = 'a ' + kind + '!', hpx = 230, maxW = 900, minW = 430;
    measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
    let fs = 150, tw;
    const setFont = () => { measureCtx.font = 'italic 700 ' + fs + 'px Georgia, "Times New Roman", serif'; tw = measureCtx.measureText(text).width; };
    setFont();
    let wpx = Math.max(minW, Math.min(maxW, Math.ceil(tw + 130)));
    if (tw + 130 > maxW) { fs = Math.max(104, Math.floor(fs * (maxW - 130) / tw)); setFont(); wpx = Math.max(minW, Math.min(maxW, Math.ceil(tw + 130))); }
    const tex = inkTex(wpx, hpx, (q, w, h) => {
      const pad = 7;
      q.beginPath(); q.moveTo(pad + 10, pad); q.lineTo(w - pad - 9, pad + 2); q.lineTo(w - pad, pad + 12); q.lineTo(w - pad - 2, h - pad - 9);
      q.lineTo(w - pad - 13, h - pad); q.lineTo(pad + 8, h - pad - 2); q.lineTo(pad, h - pad - 12); q.lineTo(pad + 2, pad + 8); q.closePath();
      q.fillStyle = '#fbf3df'; q.fill(); q.strokeStyle = C.ink; q.lineWidth = 3; q.stroke();
      q.strokeStyle = 'rgba(58,36,18,.5)'; q.lineWidth = 2; q.strokeRect(17, 17, w - 34, h - 34);
      q.fillStyle = C.ink; q.font = 'italic 700 ' + fs + 'px Georgia, "Times New Roman", serif'; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillText(text, w / 2, h / 2 + 4);
      q.globalAlpha = 0.16; q.fillText(text, w / 2 + 1.1, h / 2 + 5.2); q.globalAlpha = 1;
    });
    const out = { tex, w: wpx / 200 };
    tagTex.set(kind, out); return out;
  }
  function clearTag() {
    if (!tag) return;
    H.scene.remove(tag.g);
    tag.cardMat.dispose(); tag.standMat.dispose();
    tag = null;
  }
  function plantTag(f) {
    clearTag();
    const card = tagCard(f.kind), spot = besideSpot(f, 1.4, 0.5, true);
    const outer = new H.THREE.Group(); outer.position.set(spot.x, 0.02, spot.z); outer.name = 'paperfolk-found-tag';
    const hinge = new H.THREE.Group(); outer.add(hinge);
    const standMat = new H.THREE.MeshBasicMaterial({ color: '#e4cfa8', transparent: true, depthTest: false, depthWrite: false, side: H.THREE.DoubleSide });
    const cardMat = new H.THREE.MeshBasicMaterial({ map: card.tex, transparent: true, depthTest: false, depthWrite: false, side: H.THREE.DoubleSide });
    const stand = new H.THREE.Mesh(plane(), standMat); stand.scale.set(0.13, 1.15, 1); stand.position.y = 0.575;      // the little stand
    const foot = new H.THREE.Mesh(plane(), standMat); foot.scale.set(0.8, 0.08, 1); foot.position.y = 0.04; foot.rotation.x = -Math.PI / 2;
    const face = new H.THREE.Mesh(plane(), cardMat); face.scale.set(card.w, 1.15, 1); face.position.y = 1.15 + 0.575 + 0.01;
    for (const m of [stand, foot, face]) { m.renderOrder = 5; m.raycast = () => {}; m.frustumCulled = false; }
    hinge.add(stand, face); outer.add(foot);   // the foot stays on the page while the stand and card hinge up
    outer.rotation.y = Math.atan2(H.camera.position.x - spot.x, H.camera.position.z - spot.z);
    hinge.rotation.x = -Math.PI / 2;   // starts flat on the page, then rises on the hinge
    H.scene.add(outer);
    tag = { g: outer, hinge, cardMat, standMat, id: f.id, t: 0, active: true };
  }
  function stepTag(dt) {
    if (!tag) return;
    tag.t += dt;
    const t = tag.t;
    if (t < 0.25) { const u = t / 0.25, e = 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2); tag.hinge.rotation.x = -Math.PI / 2 * (1 - e); }
    else if (t < 1.65) tag.hinge.rotation.x = 0;                    // 1.4 s of reading time
    else if (t < 1.9) { const u = (t - 1.65) / 0.25; tag.hinge.rotation.x = -Math.PI / 2 * u * u; }
    else clearTag();
  }
  function hintTarget() {   // prefer a clear, comfortably in-frame folk near the middle; never a blurry edge if better exists
    const unfound = FOLK.filter((f) => !f.found);
    if (!unfound.length) return null;
    const r = cvEl().getBoundingClientRect();
    const centre = (f) => { const [sx, sy] = project(f); return Math.hypot((sx - (r.left + r.width / 2)) / (r.width / 2), (sy - (r.top + r.height / 2)) / (r.height / 2)); };
    const inFrame = (f) => { const [sx, sy] = project(f), m = 0.12; return sx > r.left + r.width * m && sx < r.right - r.width * m && sy > r.top + r.height * m && sy < r.bottom - r.height * m; };
    const centreBest = (pool) => pool.reduce((a, f) => (centre(f) < centre(a) ? f : a));
    const seen = unfound.filter((f) => inFrame(f) && visibility(f).clear);
    if (seen.length) return centreBest(seen);
    const onScreen = unfound.filter(inFrame);
    if (onScreen.length) return centreBest(onScreen);
    const hx = H.hero ? H.hero.group.position.x : HERO_AT[0], hz = H.hero ? H.hero.group.position.z : HERO_AT[1];
    let target = unfound[0], best = Infinity;
    for (const f of unfound) { const d = Math.hypot(f.x - hx, f.z - hz); if (d < best) { best = d; target = f; } }
    return target;
  }
  function startHint(tight = false, target = null, manual = false) {
    if (done) return false;
    target = target || hintTarget();
    if (!target) return false;
    const off = tight ? 1.2 : 2.5;   // 2.5 units beside it (never on it); a repeat tap comes in to 1.2
    const cp = H.camera.position, nx = -(target.z - cp.z), nz = target.x - cp.x, nl = Math.hypot(nx, nz) || 1;
    const a = [target.x + nx / nl * off, target.z + nz / nl * off], b = [target.x - nx / nl * off, target.z - nz / nl * off];
    const ax = _hv.set(a[0], 1.5, a[1]).project(H.camera).x, bx = _hv.set(b[0], 1.5, b[1]).project(H.camera).x;
    const hov = Math.abs(ax) <= Math.abs(bx) ? a : b;
    const g = butterfly();
    bf.to.set(hov[0], 1.55, hov[1]);
    const ndcX = _hv.set(bf.to.x, bf.to.y, bf.to.z).project(H.camera).x;
    const enter = H.groundAt(ndcX < 0 ? -1.05 : 1.05, 0.1);
    bf.from.set(enter ? enter.x : bf.to.x + (ndcX < 0 ? -18 : 18), 2.2, enter ? enter.z : bf.to.z);
    const leave = H.groundAt(ndcX < 0 ? 1.08 : -1.08, 0.05);
    bf.away.set(leave ? leave.x : bf.to.x, 2.6, leave ? leave.z : bf.to.z + 16);
    bf.target = target; bf.tight = tight; bf.manual = manual; bf.phase = 'in'; bf.t = 0; bf.dur = tight ? 1.15 : 1.7; bf.age = 0; bf.active = true;
    bfVisible(true); g.position.copy(bf.from); g.scale.setScalar(1.4);
    for (const mat of bf.mats) mat.opacity = 0.96;
    if (manual) { plantMarker(target, tight); chime(); }   // the unambiguous page marker and its two quiet notes
    return true;
  }
  // a user-triggered hint: the tab (index.html's inline wiring calls this) or window.__paperfolk.hint(). One tap sends
  // the butterfly to the nearest unfound folk; a second tap (while it shows, or within 6 s of it leaving) brings the
  // same clue closer; at the tight step a third tap only repeats the shy one's words. 1.2 s between accepted taps.
  let hintClock = 0, hintLastTap = -1e9;
  const shyWords = 'a shy one — fold the page flat to see its face';
  function manualHint() {
    if (done || !FOLK.some((f) => !f.found)) return false;
    if (hintClock - hintLastTap < 1.2) return false;             // spam guard: a tap within 1.2 s is a slip
    hintLastTap = hintClock;
    if (!started) { started = true; t0 = performance.now(); }    // a hint tap is a first interaction too (the timer runs)
    const prev = bf.active ? bf.target : bf.lastTarget;
    const live = bf.active || (bf.lastTarget && hintClock - bf.leftAt <= 6);
    if (live && prev && !prev.found) {
      if (!bf.tight) {                                            // the same clue, one step closer
        startHint(true, prev, true);
        if (prev.shy) toast(shyWords);
        return true;
      }
      if (prev.shy) toast(shyWords);                              // already tight: only the words repeat
      return false;
    }
    const target = hintTarget();
    if (!target) return false;
    startHint(false, target, true);
    if (target.shy) toast(shyWords);                              // only the shy one needs words; the butterfly is the hint
    return true;
  }
  function stepButterfly(dt) {
    if (!bf.active) return;
    bf.t += dt; bf.age += dt;
    const g = bf.g;
    let fade = 1;
    if (bf.phase === 'in') {
      const u = Math.min(1, bf.t / bf.dur), e = u * u * (3 - 2 * u);
      g.position.lerpVectors(bf.from, bf.to, e);
      g.position.x += Math.sin(u * 12) * 0.9 * (1 - u);
      g.position.y += Math.sin(u * 16 + 1) * 0.45 * (1 - u) + Math.sin(u * 6) * 0.15;
      fade = Math.min(1, u * 2.5);
      if (u >= 1) { bf.phase = 'hover'; bf.t = 0; }
    } else if (bf.phase === 'hover') {
      g.position.set(bf.to.x + Math.sin(bf.t * 1.7) * 0.55, bf.to.y + Math.sin(bf.t * 2.6) * 0.18, bf.to.z + Math.cos(bf.t * 1.3) * 0.35);
      if (bf.t > 4.2) { bf.phase = 'out'; bf.t = 0; }
    } else if (bf.phase === 'out') {
      const u = Math.min(1, bf.t / 1.6), e = u * u * (3 - 2 * u);
      g.position.lerpVectors(bf.to, bf.away, e);
      g.position.x += Math.sin(u * 10) * 0.7 * (1 - u);
      g.position.y += Math.sin(u * 14) * 0.35 * (1 - u);
      fade = 1 - u;
      if (u >= 1) { hideButterfly(); return; }
    }
    g.rotation.y = Math.atan2(H.camera.position.x - g.position.x, H.camera.position.z - g.position.z);
    const flap = 0.18 + 0.62 * (0.5 + 0.5 * Math.sin(bf.age * 18));
    bf.wings[0].rotation.y = flap; bf.wings[1].rotation.y = -flap;
    g.scale.setScalar(1.4 * (1 + 0.05 * Math.sin(bf.age * 7)));   // 1.4x the old butterfly: the clue must read at a glance
    for (const mat of bf.mats) mat.opacity = 0.96 * fade;
  }
  H.onStep((time, dt) => {
    hintClock += dt;
    stepButterfly(dt); stepMarker(dt); stepTag(dt);
    if (!started || done || FOLK.some((f) => f.found)) return;   // the automatically triggered getting-started hint only
    hintStuck += dt;
    if (hintStuck >= hintNext) { startHint(); hintNext += 35; }
  });
  // a tiny debug readout for the main session's stepped-time tests (the game's public hooks keep their shapes; tight and
  // manual are additive: was this hint the closer second tap, and was it asked for rather than the 30 s stuck hint?)
  window.__paperfolkHint = () => ({ active: bf.active, phase: bf.phase, target: bf.target ? bf.target.id : null, stuck: +hintStuck.toFixed(2), next: hintNext, tight: !!bf.tight, manual: !!bf.manual,
    hover: bf.active ? { x: +bf.to.x.toFixed(2), y: +bf.to.y.toFixed(2), z: +bf.to.z.toFixed(2) } : null,
    marker: marker ? { active: true, target: marker.target.id, tight: !!marker.tight, x: +marker.flagX.toFixed(2), z: +marker.flagZ.toFixed(2) } : null });

  // a blocked or off-screen folk moves: candidates are drawn ON SCREEN (unprojected to the page) so the frame can
  // never cut them, then checked against the river, the path, the pond, the folk and the landmarks like any placement
  function relocate(f, debug) {
    const why = [];
    for (let t = 0; t < 60; t++) {
      const gp = H.groundAt(pr() * 1.84 - 0.92, pr() * 0.85 - 0.55);
      if (!gp) { if (debug) why.push('no-ground'); continue; }
      const x = gp.x, z = gp.z, shyK = !f.shy ? 1 : (t < 30 ? 1 : 0.6);
      const place = z >= -22 && z <= 6.5 && folkFree(x, z, f.shy ? 1.2 : 0.45) && !inPond(x, z, 1.3) && !bigPieceNear(x, z)
        && Math.hypot(x - HERO_AT[0], z - HERO_AT[1]) > 6
        && FOLK.every((g) => g === f || Math.hypot(x - g.x, z - g.z) > (g.ok === false ? 4 : 8))
        && (!f.shy || (H.board.trees.every(([px, pz]) => pz <= z || pz - z > 9 * shyK || Math.abs(px - x) > 6 * shyK)
          && H.board.placed.every(([px, pz]) => pz <= z || pz - z > 3.5 || Math.abs(px - x) > 4)
          && keepOut.every(([hx, hz, r]) => hz <= z || hz - z > 6 || Math.abs(hx - x) > r + 3)));
      if (debug) why.push(place ? ('ok:' + (visibility(f).clear && safeOnScreen(f) ? 'GOOD' : 'bad-here') + ' @' + [+x.toFixed(1), +z.toFixed(1)]) : 'no-place @' + [+x.toFixed(1), +z.toFixed(1)]);
      if (!place) continue;
      spawn(f, x, z, f.shy);
      if (visibility(f).clear && safeOnScreen(f)) return true;
    }
    if (debug) return { tries: why };
    return false;
  }
  // the last resort, when perfect spots ran out: the least-blocked of 30 in-frame spots beats a hidden folk
  function relocateBest(f) {
    let best = null, bestScore = -1;
    for (let t = 0; t < 30; t++) {
      const gp = H.groundAt(pr() * 1.84 - 0.92, pr() * 0.85 - 0.55);
      if (!gp) continue;
      const x = gp.x, z = gp.z;
      if (!(z >= -22 && z <= 6.5 && folkFree(x, z, f.shy ? 1.2 : 0.45) && !inPond(x, z, 1.3) && !bigPieceNear(x, z)
        && Math.hypot(x - HERO_AT[0], z - HERO_AT[1]) > 6
        && FOLK.every((g) => g === f || Math.hypot(x - g.x, z - g.z) > 5))) continue;
      spawn(f, x, z, f.shy);
      if (!safeOnScreen(f)) continue;
      const s = visibility(f).score;
      if (s > bestScore) { bestScore = s; best = [x, z]; }
    }
    if (!best) return false;
    spawn(f, best[0], best[1], f.shy);
    return true;
  }
  let fixups = 0, fi = 0, moved = false;
  const fixup = () => {   // once the camera is live: any folk the fill hid, or the frame cut, moves to a better spot.
    // ONE folk a tick, the next ~0.15 s later (after()): the relocation raycasts spread over the opening instead of
    // one hitch while the world rises. A full sweep is a pass; passes repeat while any folk moved, preserving the
    // old multi-pass behaviour, and the 6th and last still falls back to the least-blocked spot.
    if (fi < FOLK.length) {
      const f = FOLK[fi++];
      if (!f.found) {
        if (f.starter) { f.ok = true; after(0.15, fixup); return; }   // the greeter's hand-placed spot is final
        f.ok = f.shy ? safeOnScreen(f) : (visibility(f).clear && safeOnScreen(f));
        if (!f.ok) {
          if (fixups < 5) { if (relocate(f)) moved = true; }
          else if (relocateBest(f)) moved = true;   // the final pass: least-blocked beats hidden
        }
      }
      after(0.15, fixup);
    } else if (moved && ++fixups < 6) { moved = false; fi = 0; after(0.15, fixup); }
  };
  after(0.8, fixup);
  return {
    ver: 13, seed: SEED, folk: FOLK,
    relocateDebug: (id) => relocate(FOLK[id], true),
    candStats: () => {   // which placement gate eats the candidates? counted over 200 fresh samples
      const fails = { noGround: 0, zBand: 0, free: 0, pond: 0, big: 0, hero: 0, folk: 0, passed: 0 };
      for (let t = 0; t < 200; t++) {
        const gp = H.groundAt(pr() * 1.84 - 0.92, pr() * 0.85 - 0.55);
        if (!gp) { fails.noGround++; continue; }
        const x = gp.x, z = gp.z;
        if (!(z >= -22 && z <= 6.5)) { fails.zBand++; continue; }
        if (!folkFree(x, z, 0.45)) { fails.free++; continue; }
        if (inPond(x, z, 1.3)) { fails.pond++; continue; }
        if (bigPieceNear(x, z)) { fails.big++; continue; }
        if (Math.hypot(x - HERO_AT[0], z - HERO_AT[1]) <= 6) { fails.hero++; continue; }
        if (!FOLK.every((g) => Math.hypot(x - g.x, z - g.z) > 5)) { fails.folk++; continue; }
        fails.passed++;
      }
      return fails;
    },
    rayDump: (id) => {
      const f = FOLK[id], [sx, sy] = project(f);
      probeRay.setFromCamera(ndcAt(sx, sy), H.camera);
      probeRay.far = Infinity;
      const hits = probeRay.intersectObjects(H.scene.children, true);
      return { id, kind: f.kind, screen: [sx, sy], hits: hits.slice(0, 4).map((h) => {
        const o = h.object; let n = o; const chain = [];
        for (let k = 0; k < 5 && n; k++) { chain.push(n.name || (n.userData && n.userData.folk !== undefined ? 'FOLKGROUP' : n.type)); n = n.parent; }
        return { dist: +h.distance.toFixed(2), meshType: o.type, folk: meshToFolk.has(o), chain };
      }) };
    },
    state: () => ({ seed: SEED, foldOpen: H.isOpen(), found: FOLK.filter((f) => f.found).length, total: FOLK.length, done, stamps: stamps.length,
      tag: tag && tag.active ? { active: true, id: tag.id } : null }),
    probe: () => FOLK.map((f) => { const v = visibility(f); return { id: f.id, kind: f.kind, shy: f.shy, x: +f.x.toFixed(1), z: +f.z.toFixed(1), clickClear: v.clear, facing: v.facing, onScreen: safeOnScreen(f), screen: project(f), found: f.found, starter: !!f.starter }; }),
    click: (id) => { const f = FOLK[id], [sx, sy] = project(f); dispatchEvent(new PointerEvent('pointerdown', { clientX: sx, clientY: sy })); dispatchEvent(new PointerEvent('pointerup', { clientX: sx, clientY: sy })); },
    hint: manualHint,   // the same code path the "hint" tab's click uses
    fold: () => H.setOpen(!H.isOpen()),
    toast,   // the HUD's paper note: the live tier step-down (section 10) speaks through it too
  };
})();
window.__paperfolk = PFG;
window.__pfh = H;   // the test hook's way into the harness (springs, camera, scene)

const __loading = document.getElementById('loading');   // the world is printed (a slow, single synchronous build): lift the note
if (__loading) __loading.remove();

H.start();

// ---- 10. live tier safety net (no reloads, nothing persisted): a light rAF monitor — it only runs while rAF runs.
// Once the world has risen (~3 s), it watches the live frame rate over ~4 s windows; a window that held fewer than
// ~10 frames (an embedded browser pauses rAF) is skipped silently, and a window under ~38 fps steps the tier down ONE
// level in place via H.setQuality (DPR cap, MSAA, DOF taps, shadow map — re-allocated through the harness's own
// resize path), thins the fallers and flyers to the lower tier's counts, and says so on the paper toast. At most once
// (done); never under ?tier= (the player's word) or ?test (a review page); a machine that never starts its loop keeps
// its build-time tier. ?tier=high|med|low for manual testing.
(() => {
  if (flags.TEST || !H.setQuality || new URLSearchParams(location.search).has('tier') || TIER === 'low') return;
  const next = TIER === 'high' ? 'med' : 'low', SETTLE = 3000, WATCH = 4000, FLOOR = 38;
  let n = 0, tA = null, done = false;
  requestAnimationFrame(function sample(t) {
    if (done) return;
    if (tA === null) { tA = t; requestAnimationFrame(sample); return; }
    const dt = t - tA;
    if (dt < SETTLE) { requestAnimationFrame(sample); return; }   // the opening rise: not the steady loop yet
    n++;
    if (dt < SETTLE + WATCH) { requestAnimationFrame(sample); return; }
    if (n >= 10 && n / ((dt - SETTLE) / 1000) < FLOOR) {          // under the floor for the whole window: step down once
      done = true;
      if (!TIERS[next]) return;
      H.setQuality(TIERS[next]);
      for (const [k, key] of PF_LIFE) { const f = TIERS[next][key] / TIERS[TIER][key]; k.day = (k.day ?? 1) * f; k.night = (k.night ?? 1) * f; }
      window.__paperfolk?.toast('a lighter print, for a smoother page');
      return;
    }
    n = 0; tA = t - SETTLE;                                       // a healthy window (or rAF barely ran): keep watching
    requestAnimationFrame(sample);
  });
})();
