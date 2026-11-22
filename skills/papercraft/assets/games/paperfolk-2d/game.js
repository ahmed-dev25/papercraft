// papercraft / games / paperfolk-2d: the pop-up hidden-object game PORTED to the kit's 2D Canvas engine (no WebGL), so
// the same countryside board runs on low-config laptops and any phone. The world below is the popup-2d template's
// countryside worked example (the 2D sibling of the board the 3D game copies), playing the 3D game's FIXED overview:
// eight seeded paperfolk hide among its pieces — six facing the camera, two SHY turned cards that show plain kraft
// backs while the world stands and their printed faces only on the folded page. Click a folk to greet it; click the
// empty page to fold the world. All eight found folds the world shut and reopens it, with the time on a paper card.
// ?seed=N replays the same hiding places; a new seed hides anew.
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import * as EX from 'papercraft/examples/countryside.js';
import { createHarness2D } from './harness-2d.js';

// ---- 1. palette: the countryside board's own (the popup-2d template's warm lead on olive-khaki) ----------------------
const C = {
  ground: '#cfc4a1', wash: '#a8ae84', washWarm: '#d6b680', path: '#f3e6c6', river: '#3a8c84', riverDeep: '#286c68', foam: '#f6ecd4',
  leaf: ['#e0852c', '#c9542b', '#d9a03a'], pine: '#62803f', bush: ['#3f8a74', '#8a9c55'], trunk: '#74452a', stone: '#b7a386',
  wall: '#f0e0c0', roof: ['#c8513b', '#9c5636'], window: '#ffc45a', wood: '#a8683a', ink: '#3a2412', hat: '#e3b04b',
  shadow: '#6e3010', kraft: '#c9a77c',
};
// the hero starts on the path (pathX below): the subject a frame narrower than 16:9 swings toward. The view is
// authored for 16:9; ?size=1080x1920 (a Reel) or ?aspect=1:1 builds the same world for another format (formats.md)
const HERO_AT = [-7 + 4 * 0.3 + Math.sin(4 * 0.2 + 1) * 3 + 0.2, 4];
// paperfolk-2d: the FIXED overview, the 3D game's play: false — no walking, no keys (?walk turns the template's stroll
// back on). This engine builds the world for whatever frame the page opens with (a phone's portrait included), so
// there is no letterbox redirect: the folk band below is derived from the harness's own frame bounds.
const H = createHarness2D({ ground: C.ground, shadow: C.shadow, kraft: C.kraft, view: { pitch: 40, dist: 70, across: 54 }, light: [-0.7, 1.1, 0.4], play: false, subject: HERO_AT });
const { g, proj, L } = H, D = P2.draw2;

// ---- 2. the printed ground: washes, a river, a winding path, marks in drifts (the board, unchanged) ------------------
const riverX = (z) => 9 - z * 0.5 + Math.sin(z * 0.15) * 4;
const BZ = 0.4;                                          // where the footbridge crosses the river (inside the sharp band)
const pathX = (z) => -7 + z * 0.3 + Math.sin(z * 0.2 + 1) * 3;
H.printGround(({ x, W, GQ, X, Z, GX1, GZ0, GZ1, rnd, washes, ribbon, drifts }) => {
  washes([C.wash, C.wash, C.wash, C.wash, C.washWarm, C.washWarm]);
  ribbon(riverX, 6.2, P2.rgba('#f2e6c6', 0.95), 0.3); ribbon(riverX, 5.2, C.river, 0.25); ribbon(riverX, 2.4, P2.rgba(C.riverDeep, 0.65), 0.4);
  for (let k = 0; k < 700; k++) { const z = GZ0 + rnd() * (GZ1 - GZ0), wx = riverX(z) + (rnd() - 0.5) * 4.2, l = (0.35 + rnd() * 0.6) * GQ; x.strokeStyle = k % 4 ? P2.rgba(C.foam, 0.85) : P2.rgba(C.riverDeep, 0.7); x.lineWidth = 0.12 * GQ; x.beginPath(); x.moveTo(X(wx) - l / 2, Z(z)); x.quadraticCurveTo(X(wx), Z(z) - 0.12 * GQ, X(wx) + l / 2, Z(z)); x.stroke(); }
  for (let k = 0; k < 3; k++) ribbon(pathX, 2.5 - k * 0.3, P2.rgba(C.path, 0.55 + k * 0.15), 0.35 - k * 0.1);
  for (let k = 0; k < 3; k++) { // the side path to the footbridge and on along the far bank
    x.strokeStyle = P2.rgba(C.path, 0.55 + k * 0.15); x.lineWidth = (2.1 - k * 0.3) * GQ; x.lineCap = x.lineJoin = 'round'; x.beginPath();
    for (let wx = pathX(BZ); wx <= GX1; wx += 0.5) { const wz = BZ + Math.sin(wx * 0.21) * 0.5 * Math.min(1, Math.abs(wx - riverX(BZ)) / 6); (wx === pathX(BZ) ? x.moveTo : x.lineTo).call(x, X(wx), Z(wz)); }
    x.stroke();
  }
  drifts((px, py) => {                                   // grass ticks and flowers gathered in drifts
    if (rnd() < 0.75) { x.strokeStyle = P2.rgba(rnd() < 0.5 ? '#6c7c4a' : '#8d9a58', 0.75); x.lineWidth = 0.07 * GQ; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 0.15 * GQ, py - (0.25 + rnd() * 0.25) * GQ); x.stroke(); }
    else { x.fillStyle = rnd() < 0.5 ? '#f3e6c8' : '#c8452d'; for (let q = 0; q < 5; q++) { const t = q / 5 * 6.283; x.beginPath(); x.arc(px + Math.cos(t) * 0.1 * GQ, py + Math.sin(t) * 0.1 * GQ, 0.075 * GQ, 0, 7); x.fill(); } }
  });
});

// ---- 3. the pieces: each kind is a function of the seeded stream (no two the same card) ------------------------------
let rnd = P2.rng(131);                   // one seeded stream per section: an edit in one section never reshuffles another
const between = (a, b) => a + rnd() * (b - a), pick = (a) => a[Math.floor(rnd() * a.length)];
const mound = (w, h, lobes = 7, depth = 0.18) => P2.roughen(P2.shape.mound(rnd, { w, h, lobes, depth }), rnd);
const tuft = (w, h, n) => P2.shape.mound(rnd, { w, h, lobes: n, depth: 0.42 }); // rounded blades: pointed ones read as combs
const K = {
  tree: () => { const h = between(7, 8.6), w = h * between(0.74, 0.86); return [P2.roughen(EX.shape.tree(rnd, { w, h, lobes: 7 + Math.floor(rnd() * 3), canopy: 0.7 }), rnd), EX.paintTree({ leaf: pick(C.leaf), trunk: C.trunk }, { trunkTop: 0.3, leaves: 20 })]; },
  pine: () => { const h = between(7.5, 9.5); return [P2.roughen(EX.shape.pine(rnd, { w: h * 0.6, h }), rnd), EX.paintPine({ leaf: C.pine, trunk: C.trunk })]; },
  shrub: () => { const w = between(3.6, 4.4); return [mound(w, w * 0.62, 9, 0.12), EX.paintBush({ leaf: C.leaf[1] }, { bands: 2 })]; },
  flowers: () => [mound(5, 1.8, 11, 0.25), EX.paintBush({ leaf: '#6f8f5a' }, { bands: 0, flowers: true, motifs: false })],
  tuft: () => [tuft(3, 2.1, 7), EX.paintBush({ leaf: '#8f9c5c' }, { bands: 2, flowers: false, motifs: false })],
  rock: () => { const w = between(3.2, 4.4); return [mound(w, w * 0.55, 4, 0.1), EX.paintRock({ stone: C.stone, ink: C.ink })]; },
  mushroom: () => [EX.props.mushroom(between(1.8, 2.3)), EX.paintMushroom()],
  fox: () => EX.critter.fox(2.0),
  cat: () => EX.critter.cat(1.7),
  duck: () => EX.critter.duck(1.5),
  bench: () => [EX.props.bench(1.8), EX.paintWood({ wood: C.wood })],
  sign: () => [EX.props.signpost(3), EX.paintWood({ wood: '#b9844f' }, { planks: 1 })],
  barrel: () => [EX.props.barrel(2), EX.paintWood({ wood: '#97552f' }, { planks: 4, vertical: true })],
  fence: () => [EX.shape.fence({ w: 5, h: 1.8, pickets: 6 }), EX.paintWood({ wood: '#b07a48' }, { planks: 1 })],
  house: (roof, w) => [EX.shape.house({ w, wallH: w * 0.62, roofH: w * 0.5 }), EX.paintHouse({ wall: C.wall, roof, window: C.window, ink: C.ink }, { wallH: w * 0.62 })],
  well: () => [P2.fromDrawing((gg) => { D.rect(gg, -0.62, 0, 1.24, 0.62, 0.08); D.rect(gg, -0.56, 0.5, 0.1, 0.8); D.rect(gg, 0.46, 0.5, 0.1, 0.8); D.poly(gg, [[-0.82, 1.2], [0, 1.62], [0.82, 1.2]]); }, { w: 1.7, h: 1.66 }).map(([a, b]) => [a * 1.7, b * 1.7]),
    (P) => { const { box, g: gg } = P; P.gradient(P2.shade(C.stone, 0.1), P2.shade(C.stone, -0.15), 0.4); P.marks('brick', { color: P2.shade(C.stone, -0.45), alpha: 0.55, size: 0.08 }); P.draw(() => { gg.fillStyle = C.wood; gg.fillRect(box.x0 - 1, box.y0 + box.h * 0.37, box.w + 2, box.h * 0.36); gg.fillStyle = C.roof[0]; gg.fillRect(box.x0 - 1, box.y0 + box.h * 0.72, box.w + 2, box.h); }); P.innerShade('#4a2a14', { alpha: 0.4, blurPx: 8 }); }],
};
const turn = () => (rnd() - 0.5) * 0.7;                                   // small cards turned a little about their hinge
const place = (kind, x, z, o = {}) => { const [pts, paint] = typeof kind === 'string' ? K[kind]() : kind; return H.piece(pts, paint, { x, z, ...o }); };
// bushes: two stacked cards (back darker and taller, front lighter, a little nearer), the shipped bush read
const bushStack = (x, z, s = 1) => {
  const w = between(5, 6.6) * s, col = pick(C.bush), y = turn();
  H.piece(mound(w, w * 0.42, 6, 0.2), EX.paintBush({ leaf: P2.shade(col, -0.12) }), { x, z, yaw: y, sway: 0.5 });
  H.piece(mound(w * 0.78, w * 0.3, 7, 0.22), EX.paintBush({ leaf: P2.mix(col, '#f2e3c0', 0.08) }, { bands: 1 }), { x: x + w * 0.06, z: z + 0.45, yaw: y, sway: 0.5 });
};
const taken = [];                                     // [x, z, r] kept clear of the fill (landmarks, the path, the river)
const riverDist = (x, z) => { let d = 1e9; for (let s = -7; s <= 7; s += 0.25) d = Math.min(d, Math.hypot(x - riverX(z + s), s)); return d; };
const pathDist = (x, z) => { let d = 1e9; for (let s = -5; s <= 5; s += 0.25) d = Math.min(d, Math.hypot(x - pathX(z + s), s)); return d; };
const free = (x, z, m = 0) => riverDist(x, z) > 3.4 + m && pathDist(x, z) > 1.7 + m && !(x > pathX(BZ) && Math.abs(z - BZ) < 1.6 + m) && taken.every(([a, b, r]) => Math.hypot(x - a, z - b) > r + m);
// in a pitched view tall pieces in FRONT of the subject hide it: keep the path in front of the hero clear of tall cards
const corridor = (x, z) => z > 2 && pathDist(x, z) < 6;

// ---- 4. landmarks by hand: a hamlet by the path, a well, ducks on the river, the footbridge, the hero -----------------
place(K.house(C.roof[0], 5.6), pathX(-12) + 5.5, -12, { yaw: -0.25 }); place(K.house(C.roof[1], 4.4), pathX(-7) + 7.5, -7, { yaw: 0.3 }); place('well', pathX(-9) + 11.5, -9.5);
taken.push([pathX(-12) + 5.5, -12, 4], [pathX(-7) + 7.5, -7, 3.6], [pathX(-9) + 11.5, -9.5, 2]);
const solids = taken.slice();                         // the houses and the well block the walk
place('barrel', pathX(-4) + 4.2, -4); place('cat', pathX(-3.3) + 5.6, -3.3, { yaw: 0.4 }); place('fence', pathX(-1) + 3.2, -1, { yaw: -0.35 }); place('sign', pathX(-15) - 2, -15, { yaw: 0.3 });
taken.push([pathX(-4) + 4.6, -4, 2.4], [pathX(-1) + 3.2, -1, 2.8], [pathX(-15) - 2, -15, 1.4]);
for (const [z, dx] of [[-8, 0.6], [5, -0.8], [6.5, 0.6]]) place('duck', riverX(z) + dx, z, { yaw: 0.4, bob: 0.06, reflect: true });
// the footbridge: built in depth like bridge() in examples/built-ground.js, never one flat card on the water. Two side cards (foot on
// the banks, an arch over the water, a parapet over the deck line; the FRONT one lower so the deck shows over it) and a
// deck surface drawn between them (drawDeck2D), rising with them. deckAt(x, z): the walk height on the deck.
const BX = riverX(BZ), BHS = 5.2, BW = 1.7, DA1 = 26 * Math.PI / 180, DA2 = 8 * Math.PI / 180, Dz1 = BHS * 0.42, Dh1 = (BHS - Dz1) * Math.tan(DA1);
const deckH = (u) => { u = Math.abs(u); return u >= BHS ? 0 : u >= Dz1 ? (BHS - u) * Math.tan(DA1) : Dh1 + (Dz1 - u) * Math.tan(DA2); };
const deckAt = (x, z) => (Math.abs(x - BX) < BHS && Math.abs(z - BZ) < BW ? deckH(x - BX) : null);
const sideCard = (railH) => {
  const ext = BHS * 1.06, ah = deckH(0) * 0.7, aw = BHS * 0.58, pts = [[-ext, 0], [-aw, 0]];
  for (let i = 1; i < 16; i++) { const a = Math.PI - Math.PI * i / 16; pts.push([Math.cos(a) * aw, Math.sin(a) * ah]); }
  pts.push([aw, 0], [ext, 0]);
  for (let i = 0; i <= 26; i++) { const u = ext - 2 * ext * i / 26; pts.push([u, deckH(u) + railH * (Math.abs(u) > BHS ? 0.8 : 1)]); }
  return [pts, EX.paintBridgeSide({ stone: C.stone, wood: C.wood }, { deckH, arch: { w: aw * 2, h: ah } })];
};
const bridgeBack = place(sideCard(1.1), BX, BZ - BW); place(sideCard(0.55), BX, BZ + BW);
taken.push([BX, BZ, BHS + 1.2], [BX - BHS - 2, BZ, 2], [BX + BHS + 2, BZ, 2]);
// the deck's print: planks ACROSS the deck (its top row is the far edge), graded like every other print; the deck must
// differ from the side faces in unit size and value, or it reads as a third wall instead of a floor
const deckPrint = (() => {
  const pr = P2.printCard(P2.shape.rect(2 * BHS, 2 * BW), { pxPerUnit: H.Q, sheet: H.sheet, seed: 77, paint: EX.paintWood({ wood: C.wood }, { planks: 18, vertical: true }) });
  const c = H.mk(pr.canvas.width, pr.canvas.height), x = c.getContext('2d'); x.filter = H.grade; x.drawImage(pr.canvas, 0, 0); return c;
})();
// keyed at its FAR edge: after the far side card, before everything standing on it and the near side card
const deckSpec = (rise) => ({ print: deckPrint, x0: BX - BHS, x1: BX + BHS, z0: BZ - BW, z1: BZ + BW, heightAt: (x) => deckH(x - BX), rise, light: [L[0], L[1]], edge: 0 });
const bridgeRise = () => Math.min(1, Math.max(0, bridgeBack.spring.p));
H.decks.push({ z: BZ - BW, draw: () => P2.drawDeck2D(g, proj, deckSpec(bridgeRise())), shadow: () => P2.deckShadow2D(g, proj, { ...deckSpec(bridgeRise()), light3: L, color: C.shadow, alpha: 0.32 }) });

// the hero: a paper puppet (never one flat card), the template's young gardener, standing on the path — the fixed
// overview never walks him, but the world keeps him (and its walk field) so the board reads as lived-in
const hero = place(P2.drawnPiece((gg, ink) => {
  gg.fillStyle = ink('#2f6f8a'); D.rect(gg, -0.38, 0.75, 0.76, 1.3, 0.22);                                       // jacket
  gg.fillStyle = ink('#245a72', 'print'); D.rect(gg, -0.3, 0.93, 0.2, 0.2, 0.04); D.rect(gg, -0.38, 1.37, 0.76, 0.04); // pocket, seam
  gg.fillStyle = ink('#e8c25a', 'print'); D.ell(gg, 0.04, 1.2, 0.035, 0.035); D.ell(gg, 0.04, 1.5, 0.035, 0.035); D.ell(gg, 0.04, 1.75, 0.035, 0.035);
  gg.fillStyle = ink('#2f6f8a'); D.rect(gg, 0.3, 1.24, 0.22, 0.62, 0.1);                                         // arm
  gg.fillStyle = ink('#f1d9b8'); D.ell(gg, 0.41, 1.2, 0.1, 0.09);                                                 // hand
  gg.fillStyle = ink('#f1d9b8'); D.ell(gg, 0, 2.3, 0.36, 0.38);                                                   // head
  gg.fillStyle = ink('#9a5a2a', 'print'); D.rect(gg, -0.3, 2.42, 0.6, 0.12, 0.06);                                // fringe
  gg.fillStyle = ink('#2a1608', 'print'); D.ell(gg, -0.12, 2.27, 0.04, 0.05); D.ell(gg, 0.12, 2.27, 0.04, 0.05); // eyes
  gg.fillStyle = ink('#c9845a', 'print'); for (const fx of [-0.2, -0.16, 0.16, 0.2]) D.ell(gg, fx, 2.17, 0.015, 0.015); // freckles
  gg.fillStyle = ink('#8a3a22', 'print'); D.rect(gg, -0.07, 2.09, 0.14, 0.03, 0.015);                             // mouth
}, { w: 1.2, h: 2.8, name: 'hero body' }), HERO_AT[0], HERO_AT[1], { sway: 0.2, sharp: true });
const leg = () => P2.drawnPiece((gg, ink) => { gg.fillStyle = ink('#3c5a3a'); D.rect(gg, -0.1, 0.18, 0.2, 0.66, 0.05); gg.fillStyle = ink('#4a2a18'); D.rect(gg, -0.12, 0, 0.28, 0.22, 0.08); }, { w: 0.4, h: 0.86, name: 'leg' });
const parts = [   // [cut + print, dx, dy, dz, float, leg]
  [leg(), -0.12, 0, -0.02, true, 0], [leg(), 0.12, 0, -0.03, true, 1],
  [P2.drawnPiece((gg, ink) => {                                    // a wicker basket of greens
    gg.fillStyle = ink('#3f7a3a'); for (const [x, a] of [[-0.18, -0.3], [-0.02, 0.1], [0.14, 0.4]]) D.poly(gg, [[x - 0.05, 0.8], [x + 0.05, 0.8], [x + Math.sin(a) * 0.3 + 0.03, 1.32], [x + Math.sin(a) * 0.3 - 0.03, 1.32]]);
    gg.fillStyle = ink('#b58a4a'); D.rect(gg, -0.32, 0, 0.64, 0.86, 0.12);
    gg.fillStyle = ink('#8a6230', 'print'); for (let k = 0; k < 4; k++) D.rect(gg, -0.32, 0.12 + k * 0.18, 0.64, 0.05);
  }, { w: 0.75, h: 1.4, name: 'basket' }), -0.36, 0.95, -0.22, true],
  [P2.drawnPiece((gg, ink) => { gg.fillStyle = ink('#d9a33a'); D.rect(gg, -0.34, 0, 0.68, 0.36, 0.16); gg.fillStyle = ink('#b07e22'); D.rect(gg, -0.35, 0, 0.7, 0.1, 0.04); gg.fillStyle = ink('#c8452d', 'print'); D.rect(gg, -0.34, 0.18, 0.68, 0.05); gg.fillStyle = ink('#f3e6c8'); D.ell(gg, 0, 0.42, 0.13, 0.12); }, { w: 0.75, h: 0.6, name: 'hat' }), 0, 2.5, 0.05, true],
  [P2.drawnPiece((gg, ink) => { gg.fillStyle = ink('#9fb0b0'); D.rect(gg, -0.2, 0, 0.4, 0.36, 0.05); D.poly(gg, [[0.16, 0.12], [0.24, 0.16], [0.48, 0.44], [0.44, 0.48]]); gg.fillStyle = ink('#7c8c8c'); D.rect(gg, -0.12, 0.34, 0.24, 0.1, 0.04); gg.fillStyle = ink('#5f6d6d', 'print'); D.rect(gg, -0.2, 0.1, 0.4, 0.03); D.rect(gg, -0.2, 0.24, 0.4, 0.03); }, { w: 1.05, h: 0.55, name: 'watering can' }), 0.42, 0.72, 0.12, true],
].map(([pp, dx, dy, dz, float, legIndex]) => ({ p: place(pp, hero.x + dx, hero.z + dz, { sharp: true, float }), dx, dy, dz, ...(legIndex !== undefined ? { leg: legIndex } : {}) }));
H.setHero(hero, { parts, step: 0.9 });
place('bench', pathX(7) + 3, 7, { yaw: -0.3 }); taken.push([pathX(4), 4, 2.2], [pathX(7) + 3, 7, 2.4]);

// ---- 5. the fill: a slow noise -> woods (high), groups of 2-5 different pieces (middle), clearings (low), in frame only
rnd = P2.rng(231);                       // the fill's stream
const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
const lush = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.13 + ph[0]) * Math.sin(z * 0.15 + ph[1]) + 0.18 * Math.sin(x * 0.22 + z * 0.17 + ph[2]);
const DRESS = ['bush', 'bush', 'shrub', 'rock', 'tuft', 'flowers', 'mushroom', 'fox', 'cat'];
const CAP = { fox: 2, cat: 2, mushroom: 4 }, used = {};   // at most a few identical pieces in view: clones read as a demo
const trees = [], spots = [];
// cells on a fixed lattice, each with its own seed: every format (16:9, 9:16, 1:1) builds the same pieces at the same
// places, the frame only decides which cells are built
const cellSeed = (gx, gz) => (Math.imul(Math.round(gx * 10), 73856093) ^ Math.imul(Math.round(gz * 10), 19349663) ^ 41) >>> 0;
for (let gz = Math.floor((H.zTop - 6) / 3.4) * 3.4; gz <= H.zBot + 5; gz += 3.4) for (let gx = Math.floor(-(H.halfAt(gz) + 3) / 3.4) * 3.4; gx <= H.halfAt(gz) + 3; gx += 3.4) {
  rnd = P2.rng(cellSeed(gx, gz));
  const x = gx + (rnd() - 0.5) * 2.6, z = gz + (rnd() - 0.5) * 2.6, l = lush(x, z);
  if (l < 0.27 || spots.some(([a, b]) => Math.hypot(x - a, z - b) < 3.1)) continue;
  spots.push([x, z]);
  if (l > 0.56 && free(x, z, 1.5) && !corridor(x, z) && trees.every(([a, b]) => Math.hypot(x - a, z - b) > 3.6)) { trees.push([x, z]); place(rnd() < 0.3 ? 'pine' : 'tree', x, z, { sway: 0.7, slotted: true }); continue; }
  if (!free(x, z, 1)) continue;
  const avail = [...new Set(DRESS)].filter((k) => (used[k] || 0) < (CAP[k] ?? Infinity));
  const n = Math.min(avail.length, 2 + Math.floor(rnd() * 4)), kinds = [];   // groups of 2-5 DIFFERENT pieces
  while (kinds.length < n) { const k = pick(DRESS); if (!kinds.includes(k) && (used[k] || 0) < (CAP[k] ?? Infinity)) kinds.push(k); }
  kinds.forEach((k, i) => { const px = x + (i - (n - 1) / 2) * 1.9 + (rnd() - 0.5), pz = z + (i % 2) * 1.0 - 0.5 + (rnd() - 0.5) * 0.4;
    if (!free(px, pz, 0.6)) return;                                     // every member, not just the group's anchor
    used[k] = (used[k] || 0) + 1;
    if (k === 'bush') bushStack(px, pz); else place(k, px, pz, { yaw: turn(), sway: ['shrub', 'tuft', 'flowers'].includes(k) ? 0.5 : 0 }); });
}
rnd = P2.rng(232);
// big blurred pieces overlapping the bottom edge sell the miniature scale
// across THIS frame's width (fractions of its half-width about frame.cx), so a narrow 9:16 frame gets them too
for (const [f, dz, kind] of [[-0.89, 3, 'tree'], [-0.33, 4.5, 'bush'], [0.48, 4, 'bush'], [0.96, 3.5, 'tree']]) {
  const z = H.zBot + dz, x = H.frame.cx + f * H.frame.half(z);
  if (kind === 'bush') bushStack(x, z, 1.5); else place('tree', x, z, { sway: 0.6, slotted: true });
}

// ---- 6. the walk field reads the same constructions the camera sees (kept with the board; the overview never walks) --
const walk = H.walk;
walk.add({ heightAt: (x, z) => deckAt(x, z) });
walk.block((x, z) => riverDist(x, z) < 2.7);
// the side cards are walls: off the deck, a strip along each one stops the hero (where the deck is low near the banks
// he would otherwise step straight through them)
walk.block((x, z) => Math.abs(x - BX) < BHS * 1.06 && Math.abs(z - BZ) >= BW && Math.abs(z - BZ) < BW + 0.35);
for (const [a, b, r] of solids) walk.solid(a, b, r * 0.7);   // the houses and the well
for (const [a, b] of trees) walk.solid(a, b, 0.9);

// ---- 7. PAPERFOLK: the game layer on this board ----------------------------------------------------------------------
// Eight little paper creatures are placed by seed among the pieces. Six face the camera (find them in the raised
// world); two are SHY turned cards: plain kraft backs while the page stands, their printed faces only when it is
// folded flat. Click a folk to greet it; click empty page to fold the world. All eight found folds the world shut and
// reopens it, with the time on a paper card. ?seed=N replays the same hiding places; a new seed hides anew.
const PFG = (() => {
  const GQ = new URLSearchParams(location.search);
  const SEED = +(GQ.get('seed') || 0) || 1 + Math.floor(Math.random() * 999);
  const pr = P2.rng(SEED * 7 + 13);

  // the folk: one connected cut each (fromDrawing drops loose parts), a simple layered print (fill + accent + shade).
  // Shapes, sizes, colours and the traced-outline scaling are VERBATIM the 3D game's (its KINDS table and
  // .map(([x, y]) => [x * K.s, y * K.s])), so both engines hide the same eight little creatures.
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
  // fromDrawing keeps the drawing's own coordinates: scale the traced outline up to the kind's real size, exactly as
  // the 3D game does; a shy folk is printed 1.2x (the 3D spawn's `scale: shy ? 1.2 : 1` folded into the map)
  const folkPiece = (k, shy, starter) => { const K = KINDS[k], s = K.s * (shy ? 1.2 : 1) * (starter ? 1.2 : 1); return [P2.fromDrawing(K.draw, { w: K.w, h: K.h, name: 'folk-' + k }).map(([x, y]) => [x * s, y * s]), folkPrint(K.base, K.accent, K.kind || 'dot')]; };

  // ---- the folk band and the board's keep-outs ----------------------------------------------------------------------
  // the visible page between the frame's edges (the harness's own bounds, so every frame shape hides folk in the same
  // spirit); folk and pieces never share ground, folk only mind the water, the path and the bridge corridor
  const Z0 = H.zTop + 7, Z1 = H.zBot - 5;
  const inBand = (x, z, m = 4) => z >= Z0 && z <= Z1 && Math.abs(x) < H.halfAt(z) - m;
  const bridgeNear = (x, z) => Math.abs(x - BX) < BHS + 1.6 && Math.abs(z - BZ) < BW + 1.6;   // the deck and its sides screen the ground behind them
  const folkFree = (x, z, m = 0.45) => riverDist(x, z) > 3.4 + m && pathDist(x, z) > 1.7 + m && !bridgeNear(x, z);
  const isTreeAt = (x, z) => trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 0.6);
  // the 3D game's blade-aware clearance on THIS engine's sprite list: cards are blades, not discs, so only the strip
  // along a tall card's own face is barred (yaw turned about the hinge); trees keep a round 2.2 nest instead
  const bigPieceNear = (x, z) => {
    for (const p of H.pieces) {
      if (p.folk || p.rider || p === hero || p.float) continue;
      if (isTreeAt(p.x, p.z)) { if (Math.hypot(x - p.x, z - p.z) < 2.2) return true; continue; }
      if (Math.hypot(x - p.x, z - p.z) > 5.5 || p.box.h < 3.2) continue;    // small dressing: the nest lifts it off
      const ca = Math.cos(p.yaw || 0), sa = Math.sin(p.yaw || 0), dx = x - p.x, dz = z - p.z;
      if (Math.abs(dx * ca + dz * sa) < p.box.w / 2 + 1.4 && Math.abs(-dx * sa + dz * ca) < 1.0) return true;
    }
    return false;
  };
  // lift the small dressing off the folk's little nest so no card ever overdraws it (tall pieces and trees stay: they
  // are the hiding); the same idea as the 3D clearNest, splicing this engine's own sprite list
  const clearNest = (x, z, r = 2.0) => {
    for (let i = H.pieces.length - 1; i >= 0; i--) {
      const p = H.pieces[i];
      if (p.folk || p.rider || p === hero || p.float || Math.hypot(p.x - x, p.z - z) > r) continue;
      if (isTreeAt(p.x, p.z) || p.box.h >= 3.2) continue;
      H.pieces.splice(i, 1);
    }
  };
  // shy folk need OPEN ground for their folded faces: this kit folds cards TOWARD the viewer and draws the flat stack
  // farthest-on-top, so a card folded flat covers the page NEARER than its base — a tall piece FARTHER than the folk
  // covers it if the folk sits inside the card's own height of fold-reach and its strip across the page
  const openGround = (x, z, k = 1) => H.pieces.every((p) => {
    if (p.folk || p.rider) return true;
    if (p.z > z - 0.1) return true;                                  // nearer pieces cover only ground nearer than themselves
    if (z - p.z > (p.box.h + 0.8) * k) return true;                  // the fold's reach: about the card's own height
    return Math.abs(p.x - x) > Math.max(p.box.w / 2, 1) * k + 1.6;  // its strip across the page
  });

  // ---- hiding spots: anchors near the fill's own pieces (tucked like the 3D game), open fallbacks, then random tries
  // the greeter: beside the hero on the side toward the frame's middle (H.frame.cx), a few units toward the camera.
  // Its reserved ground is kept clear of the seeded spots; the fixup pass never moves it.
  const GREETER_AT = [HERO_AT[0] + (H.frame.cx >= HERO_AT[0] ? 3.35 : -3.35), Math.min(Z1 - 1, Math.max(Z0 + 1, HERO_AT[1] + 0.7))];
  const cands = [];
  for (const [ax, az] of [...trees, ...spots]) if (az >= Z0 - 2 && az <= Z1 + 2 && Math.abs(ax) < H.halfAt(az) - 2) cands.push([ax, az]);
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(pr() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  const fspots = [], fspare = [];
  const spotOk = (x, z, shy) => inBand(x, z, 5) && folkFree(x, z, shy ? 1.2 : 0.6) && !bigPieceNear(x, z)
    && Math.hypot(x - HERO_AT[0], z - HERO_AT[1]) > 6
    && Math.hypot(x - GREETER_AT[0], z - GREETER_AT[1]) > 6.5
    && fspots.every(([px, pz]) => Math.hypot(x - px, z - pz) > 9) && fspare.every(([px, pz]) => Math.hypot(x - px, z - pz) > 6)
    && (!shy || openGround(x, z));
  for (const [ax, az] of cands) {
    if (fspots.length >= 6 && fspare.length >= 5) break;
    for (let t = 0; t < 6; t++) { const x = ax + (pr() - 0.5) * (t ? 3.8 : 1), z = az + (pr() - 0.5) * (t ? 3.8 : 1); if (spotOk(x, z, false)) { (fspots.length < 6 ? fspots : fspare).push([x, z]); break; } }
  }
  // a few hand-picked scenic fallbacks on this board (the 3D game's PFFALL): the well, the far bank, the meadow...
  const PFFALL = [[pathX(-9) + 13.8, -9.2], [pathX(-15) - 4.2, -14], [riverX(-11) - 5.2, -11], [pathX(7) + 6.5, 6.2], [pathX(1.5) - 6.5, 1.5], [riverX(3) + 6, 3]];
  for (const [fx, fz] of PFFALL) if (spotOk(fx, fz, false)) (fspots.length < 6 ? fspots : fspare).push([fx, fz]);
  for (let tries = 0; (fspots.length < 6 || fspare.length < 4) && tries < 6000; tries++) {
    const z = Z0 + pr() * (Z1 - Z0), x = (pr() - 0.5) * 2 * Math.max(10, H.halfAt(z) - 5);
    if (spotOk(x, z, false)) (fspots.length < 6 ? fspots : fspare).push([x, z]);
  }
  // shy spots: open ground (the fold rule above), never on another folk's spot
  const shySpots = [];
  for (let tries = 0; shySpots.length < 2 && tries < 8000; tries++) {
    const z = Z0 + pr() * (Z1 - Z0), x = (pr() - 0.5) * 2 * Math.max(10, H.halfAt(z) - 5);
    if (spotOk(x, z, true) && Math.hypot(x - GREETER_AT[0], z - GREETER_AT[1]) > 7 && [...fspots, ...fspare, ...shySpots].every(([px, pz]) => Math.hypot(x - px, z - pz) > 9)) shySpots.push([x, z]);
  }
  for (let i = 0; i < 2; i++) if (!shySpots[i]) shySpots[i] = (fspare.length >= 2 ? fspare.splice(fspare.length - 2 + i, 1)[0] : [(pr() - 0.5) * 40, Z0 + pr() * (Z1 - Z0)]);

  // ---- spawn: six spotters facing the camera, two shy folk as TURNED cards (kraft backs out until the page folds) --
  const order = Object.keys(KINDS); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(pr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const FOLK = [];
  function spawn(f, x, z, shy) {
    if (f.h) { const i = H.pieces.indexOf(f.h); if (i >= 0) H.pieces.splice(i, 1); }   // a respawn (the fixup pass): take the old card off the page first
    f.x = x; f.z = z; f.shy = shy;
    clearNest(x, z);   // lift any small dressing off the folk's nest so no card ever overdraws it
    f.h = H.piece(...folkPiece(f.kind, shy, f.starter), { x, z, seed: 700 + f.id * 13, sway: f.starter ? 0.4 : shy ? 0.1 : 0.25, turned: shy });
    f.h.folk = f;
    if (H.isOpen && H.isOpen()) f.h.spring.reset(1);   // a respawn after the world rose stands up at once: its pose is what the player sees
  }
  for (let i = 0; i < 6; i++) { const f = { id: i, kind: order[i], found: false, shy: false, ok: null, h: null, base: KINDS[order[i]].base }; const at = fspots[i] || fspare[fspare.length - 1] || [(pr() - 0.5) * 40, Z0 + pr() * (Z1 - Z0)]; spawn(f, at[0], at[1], false); FOLK.push(f); }
  for (let i = 0; i < 2; i++) { const f = { id: 6 + i, kind: order[6 + i], found: false, shy: true, ok: null, h: null, base: KINDS[order[6 + i]].base }; const at = shySpots[i] || fspare[fspare.length - 1] || [(pr() - 0.5) * 40, Z0 + pr() * (Z1 - Z0)]; spawn(f, at[0], at[1], true); FOLK.push(f); }

  // ---- the projection helpers: the painter's own card transform, rebuilt from the exposed projection -----------------
  // a card is one setTransform in the painter: screen x = bx + sx * box.x, its top at by - k * uk * box.y1, with
  // k = cos(phi + pitch) (the fold's vertical scale) and uk = device px per world unit at its depth
  const cvEl = () => document.getElementById('c');
  const cardRect = (p, phi) => {
    const k = Math.cos(phi + H.view.pitch * Math.PI / 180);
    if (Math.abs(k) < 0.02) return null;                                             // edge-on mid-fold: nothing to see or click
    const [bx, by] = H.proj(p.x, p.y || 0, p.z), uk = H.proj(p.x + 1, 0, p.z)[0] - H.proj(p.x, 0, p.z)[0], sx = uk * (p.cy ?? 1);
    const top = by - k * uk * p.box.y1;
    return { k, x0: bx + sx * p.box.x0, x1: bx + sx * p.box.x1, y0: Math.min(by, top), y1: Math.max(by, top) };
  };
  const toCss = (dx, dy) => { const c = cvEl(), r = c.getBoundingClientRect(); return [Math.round(r.left + dx / c.width * r.width), Math.round(r.top + dy / c.height * r.height)]; };
  // the folk's VISIBLE card centre in CSS px of the page (its standing print or kraft back, or its print lying flat):
  // a synthetic click at these pixels lands on the folk in whatever fold state the world is in
  const project = (f) => { const R = cardRect(f.h, (1 - f.h.spring.p) * Math.PI / 2); if (!R) return toCss(...H.proj(f.x, 0.6, f.z)); return toCss((R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2); };
  const safeOnScreen = (f) => { const r = cvEl().getBoundingClientRect(), [sx, sy] = project(f); return sx > r.left + r.width * 0.12 && sx < r.right - r.width * 0.12 && sy > r.top + r.height * 0.1 && sy < r.bottom - r.height * 0.12; };
  // clickability the way the painter works: standing cards draw far to near, so a card NEARER than the folk lands on
  // top of it — sample the folk's standing card and count the samples no nearer card's rectangle covers (the 2D
  // sibling of the 3D game's seven probe rays: any clear sample makes the folk clickable)
  const SAMP = [[-0.5, 0.25], [0, 0.3], [0.5, 0.25], [-0.5, 0.6], [0, 0.6], [0.5, 0.6], [-0.5, 0.9], [0, 0.9], [0.5, 0.9]];
  function visibility(f) {
    const R = cardRect(f.h, 0);
    if (!R) return { clear: false, score: 0 };
    const blockers = [];
    for (const q of H.pieces) {
      if (q === f.h || q.folk || q.z <= f.z + 0.05) continue;                        // only cards drawn AFTER the folk cover it
      const B = cardRect(q, 0); if (B) blockers.push(B);
    }
    let score = 0;
    const w2 = (R.x1 - R.x0) / 2, cx = (R.x0 + R.x1) / 2, hh = R.y1 - R.y0;
    for (const [fu, fv] of SAMP) {
      const px = cx + fu * w2, py = R.y1 - fv * hh;
      if (!blockers.some((B) => px >= B.x0 && px <= B.x1 && py >= B.y0 && py <= B.y1)) score++;
    }
    return { clear: score > 0, score };
  }

  // ---- the greeter: one of the eight is placed by hand, in view, and the fixup pass never moves it --------------------
  // Its reserved spot is beside the hero toward the frame's middle. If a fill piece still hides it, a deterministic ring
  // of nudges toward the middle finds the first spot that passes the same clearance tests as every other folk AND the
  // sprite-coverage visibility test this engine's picking uses.
  function placeGreeter(f) {
    const ok = (x, z) => inBand(x, z, 4) && folkFree(x, z, 0.6) && !bigPieceNear(x, z)
      && Math.hypot(x - HERO_AT[0], z - HERO_AT[1]) > 2.6
      && FOLK.every((g) => g === f || Math.hypot(x - g.x, z - g.z) > 5);
    if (f.h && ok(f.x, f.z) && safeOnScreen(f) && visibility(f).clear) { f.ok = true; return true; }   // it already rises in the reserved spot: keep it
    const offs = [[0, 0]];
    for (const r of [0.9, 1.8, 2.7, 3.6]) for (const a of [0, 0.72, -0.72, Math.PI / 2, -Math.PI / 2, Math.PI - 0.72, Math.PI + 0.72, Math.PI]) offs.push([Math.cos(a) * r, Math.sin(a) * r * 0.6]);
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
    if (best) { spawn(f, best[0], best[1], false); f.ok = true; return true; }
    spawn(f, GREETER_AT[0], GREETER_AT[1], false);
    f.ok = true;
    return false;
  }
  const starter = FOLK.find((f) => !f.shy && f.kind === 'robin') || FOLK.find((f) => !f.shy && f.kind === 'beetle') || FOLK.find((f) => !f.shy);
  if (starter) {
    starter.starter = true;
    spawn(starter, GREETER_AT[0], GREETER_AT[1], false);   // it rises with the world in the reserved spot...
  }

  // ---- the paper butterfly: a diegetic stuck hint, on the harness clock -----------------------------------------
  // If nothing is found 30 s after the first interaction (the end-card clock starts on the same pointerdown), then
  // every ~35 s after, a tiny paper butterfly enters from a frame edge, flutters to a point beside the nearest visible
  // unfound folk, hovers, and leaves. It is an overlay only (H.overlay), never a sprite: nothing can pick it.
  const bf = { active: false, phase: 'idle', t: 0, age: 0, op: 0, target: null, tight: false, manual: false, lastTarget: null, leftAt: -1e9, x: 0, y: 0, from: null, to: null, away: null };
  const stamps = [], scraps = [];   // the found flourish: an ink print per collect, and a few flying card scraps
  let hintStuck = 0, hintNext = 30;
  let hintClock = 0, hintLastTap = -1e9;
  const shyWords = 'a shy one — fold the page flat to see its face';
  function hideButterfly() {
    if (bf.target) { bf.lastTarget = bf.target; bf.leftAt = hintClock; }   // remember the clue for a repeat tap
    bf.active = false; bf.phase = 'idle'; bf.target = null; bf.op = 0;
  }
  function hintTarget() {   // the same target choice the stuck hint makes (and the manual hint reuses): nearest unfound
    const unfound = FOLK.filter((f) => !f.found);                          // folk the page shows; when the page shows none,
    if (!unfound.length) return null;                                      // the nearest unfound overall
    const seen = unfound.filter((f) => safeOnScreen(f) && visibility(f).clear);
    const pool = seen.length ? seen : unfound;
    let target = pool[0], best = Infinity;
    for (const f of pool) { const d = Math.hypot(f.x - HERO_AT[0], f.z - HERO_AT[1]); if (d < best) { best = d; target = f; } }
    return target;
  }
  function startHint(tight = false, target = null, manual = false) {
    if (done) return false;
    target = target || hintTarget();
    if (!target) return false;
    const off = tight ? 1.2 : 2.5;   // 2.5 units beside it (never on it); a repeat tap comes in to 1.2
    const c = cvEl();
    const [sx0, sy0] = H.proj(target.x, 0.8, target.z);
    const uk = Math.abs(H.proj(target.x + 1, 0, target.z)[0] - H.proj(target.x, 0, target.z)[0]) || 8;
    const dir = sx0 < c.width / 2 ? 1 : -1;   // beside it, toward the frame's middle
    const hx = sx0 + dir * Math.max(18, off * uk), hy = sy0 - Math.max(8, 0.6 * uk);
    const enterLeft = hx < c.width / 2;
    bf.from = { x: enterLeft ? -26 : c.width + 26, y: Math.min(c.height * 0.86, hy + 60) };
    bf.to = { x: hx, y: hy };
    bf.away = { x: enterLeft ? c.width + 26 : -26, y: Math.max(c.height * 0.12, hy - 70) };
    bf.target = target; bf.tight = tight; bf.manual = manual; bf.active = true; bf.phase = 'in'; bf.t = 0; bf.age = 0; bf.op = 1; bf.x = bf.from.x; bf.y = bf.from.y;
    return true;
  }
  // a user-triggered hint: the tab (index.html's inline wiring calls this) or window.__paperfolk.hint(). One tap sends
  // the butterfly to the nearest unfound folk; a second tap (while it shows, or within 6 s of it leaving) brings the
  // same clue closer; at the tight step a third tap only repeats the shy one's words. 1.2 s between accepted taps.
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
    if (bf.phase === 'in') {
      const u = Math.min(1, bf.t / 1.7), e = u * u * (3 - 2 * u);
      bf.x = bf.from.x + (bf.to.x - bf.from.x) * e + Math.sin(u * 12) * 26 * (1 - u);
      bf.y = bf.from.y + (bf.to.y - bf.from.y) * e + Math.sin(u * 16 + 1) * 18 * (1 - u);
      bf.op = Math.min(1, u * 2.5);
      if (u >= 1) { bf.phase = 'hover'; bf.t = 0; }
    } else if (bf.phase === 'hover') {
      bf.x = bf.to.x + Math.sin(bf.t * 1.7) * 10; bf.y = bf.to.y + Math.sin(bf.t * 2.6) * 5; bf.op = 1;
      if (bf.t > 4.2) { bf.phase = 'out'; bf.t = 0; }
    } else if (bf.phase === 'out') {
      const u = Math.min(1, bf.t / 1.6), e = u * u * (3 - 2 * u);
      bf.x = bf.to.x + (bf.away.x - bf.to.x) * e + Math.sin(u * 10) * 20 * (1 - u);
      bf.y = bf.to.y + (bf.away.y - bf.to.y) * e + Math.sin(u * 14) * 14 * (1 - u);
      bf.op = 1 - u;
      if (u >= 1) hideButterfly();
    }
  }
  H.onStep((time, dt) => {
    hintClock += dt;
    stepButterfly(dt);
    if (!started || done || FOLK.some((f) => f.found)) return;   // the automatically triggered getting-started hint only
    hintStuck += dt;
    if (hintStuck >= hintNext) { startHint(); hintNext += 35; }
  });
  // paperfolk: the flourish and the butterfly draw above the finished world (the harness's overlay hook), never a
  // picking sprite. The found stamp is a flat ground print projected through H.proj (the cheap path: no extra card,
  // no extra draw list), so it is visible standing and folded; the scraps are a few screen-space card chips.
  H.overlay((g) => {
    const c = cvEl(), sinP = Math.sin(H.view.pitch * Math.PI / 180);
    for (const s of stamps) {   // the ink "found" print: dashed ring + check, ~1.4 units across in its plane
      const a = Math.min(1, s.t / 0.25) * 0.8;
      if (a <= 0.01) continue;
      const [sx, sy] = H.proj(s.x, 0.01, s.z);
      const uk = Math.abs(H.proj(s.x + 1, 0, s.z)[0] - H.proj(s.x, 0, s.z)[0]) || 8;
      g.save(); g.translate(sx, sy); g.scale(1, sinP); g.rotate(s.rot);
      g.globalAlpha = a; g.strokeStyle = C.ink; g.lineCap = g.lineJoin = 'round';
      g.lineWidth = Math.max(1, uk * 0.035); g.setLineDash([uk * 0.07, uk * 0.06]);
      g.beginPath(); g.arc(0, 0, uk * 0.67, 0.4, Math.PI * 2 + 0.1); g.stroke();
      g.setLineDash([]); g.lineWidth = Math.max(1, uk * 0.055);
      g.beginPath(); g.moveTo(-uk * 0.29, uk * 0.03); g.lineTo(-uk * 0.07, uk * 0.26); g.lineTo(uk * 0.33, -uk * 0.25); g.stroke();
      g.restore();
    }
    for (const s of scraps) {   // 5-7 tiny cream/ochre card chips: out, up, down, a slow turn, gone by ~0.9 s
      const a = Math.min(1, Math.max(0, (s.life - s.t) / 0.3)) * 0.95;
      if (a <= 0.01) continue;
      g.save(); g.globalAlpha = a; g.translate(s.x, s.y); g.rotate(s.rot);
      g.fillStyle = s.col; g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      g.strokeStyle = 'rgba(90,58,40,.35)'; g.lineWidth = Math.max(1, s.w * 0.06); g.strokeRect(-s.w / 2, -s.h / 2, s.w, s.h);
      g.restore();
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    if (!bf.active || bf.op <= 0.01) return;
    const s = Math.max(7, Math.min(16, c.width / 100));
    const flap = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(bf.age * 18));
    const bob = Math.sin(bf.age * 3.2) * s * 0.12;
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, bf.op));
    g.translate(bf.x, bf.y + bob);
    g.rotate(Math.sin(bf.age * 2.3) * 0.08);
    g.lineWidth = Math.max(1, s * 0.055);
    for (const d of [-1, 1]) {
      g.save(); g.scale(d * flap, 1);
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(s * 0.28, -s * 0.55, s * 0.92, -s * 0.45, s * 0.94, s * 0.05);
      g.bezierCurveTo(s * 0.92, s * 0.5, s * 0.3, s * 0.42, 0, s * 0.12);
      g.closePath();
      g.fillStyle = '#f6ead0'; g.fill(); g.strokeStyle = '#7a4a22'; g.stroke();
      g.beginPath(); g.ellipse(s * 0.58, s * 0.02, s * 0.24, s * 0.16, 0.25, 0, 7); g.fillStyle = '#e0b25e'; g.fill();
      g.restore();
    }
    g.beginPath(); g.moveTo(0, -s * 0.4); g.lineTo(0, s * 0.3); g.strokeStyle = '#5a3a28'; g.stroke();
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  });
  // a tiny debug readout for the main session's stepped-time tests (the game's public hooks keep their shapes; tight and
  // manual are additive: was this hint the closer second tap, and was it asked for rather than the 30 s stuck hint?)
  window.__paperfolkHint = () => ({ active: bf.active, phase: bf.phase, target: bf.target ? bf.target.id : null, stuck: +hintStuck.toFixed(2), next: hintNext, tight: !!bf.tight, manual: !!bf.manual,
    hover: bf.active && bf.to ? (() => { const [hx, hy] = toCss(bf.to.x, bf.to.y); return { x: hx, y: hy }; })() : null });

  // ---- picking: a short click greets a folk; an empty click falls through to the harness and folds the world --------
  const pickFolk = (cx, cy) => {
    const c = cvEl(), r = c.getBoundingClientRect();
    const dx = (cx - r.left) / r.width * c.width, dy = (cy - r.top) / r.height * c.height;
    let hit = null, pri = -Infinity;
    for (const f of FOLK) {
      if (f.found) continue;
      const R = cardRect(f.h, (1 - f.h.spring.p) * Math.PI / 2);
      if (!R || dx < R.x0 - 2 || dx > R.x1 + 2 || dy < R.y0 - 2 || dy > R.y1 + 2) continue;
      const p = R.k > 0 ? f.z : -f.z;                 // standing cards: the nearest is on top; the flat stack: the farthest is
      if (p > pri) { pri = p; hit = f; }
    }
    return hit;
  };
  let downAt = null, started = false, t0 = 0, done = false, foldedOnce = false;
  const pending = [];
  const after = (t, fn) => pending.push({ t, fn });
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

  // ---- the HUD: a row of paper tokens, a fading hint, a toast, an end card (HTML in the papercraft style) ------------
  const $ = (id) => document.getElementById(id);
  const tokens = $('folk-tokens');
  if (tokens) for (const f of FOLK) { const t = document.createElement('div'); t.className = 'token' + (f.shy ? ' shy' : ''); t.id = 'tok' + f.id; t.style.setProperty('--base', f.base); tokens.appendChild(t); }
  const toastBox = $('toast'); let toastTimer = null;
  function toast(msg) { if (!toastBox) return; toastBox.textContent = msg; toastBox.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastBox.classList.remove('show'), 5200); }
  setTimeout(() => { const hint = $('hint'); if (hint) hint.classList.add('fade'); }, 16000);
  // the game's pendings ride the harness clock (H.onStep), so the fold choreography, the fixup pass and the shy hint
  // all also run deterministically under the capture hook's restart() / step()
  H.onStep((time, dt) => {
    for (let i = pending.length - 1; i >= 0; i--) { const p = pending[i]; p.t -= dt; if (p.t <= 0) { pending.splice(i, 1); p.fn(); } }
    for (const s of stamps) if (s.t < 0.25) s.t += dt;   // the ink print drying in over ~0.25 s, then it stays
    for (let i = scraps.length - 1; i >= 0; i--) {        // paper scraps: a short outward arc, gravity, a slow turn, then gone
      const s = scraps[i], c = cvEl(); s.t += dt;
      s.vy += c.height * 1.35 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
      if (s.t >= s.life) scraps.splice(i, 1);
    }
    if (!foldedOnce && H.isOpen && H.isOpen() === false) { foldedOnce = true; toast('two shy folk show their faces only on the folded page'); }
  });

  // the found flourish: one coordinated ~0.8 s beat on the harness clock. The folk's card hops on its hinge (three
  // beats then settled; the painter's FlapSpring reads p > 1 as a small lean past upright, its documented overshoot),
  // an ink "found" print stays on the ground where it stood, 5-7 card scraps fly out, and the HUD token pastes in.
  function hop(f) {
    // a card already lying in the folded stack has no standing fold to bounce: there the stamp and scraps carry the
    // flourish instead of lifting it out of the page
    if (H.isOpen && H.isOpen() === false) return;
    const sp = f.h.spring;
    const beat = (p) => { sp.p = p; sp.v = 0; sp.target = 1; sp.locked = true; sp.atRest = false; };
    beat(1.18); after(0.09, () => beat(0.94)); after(0.19, () => beat(1.04)); after(0.30, () => beat(1));
  }
  function foundFlourish(f) {
    hop(f);
    stamps.push({ x: f.x, z: f.z, t: 0, rot: (((f.id * 2.399) % 1) - 0.5) * 0.35 });
    const c = cvEl(), [sx, sy] = H.proj(f.x, 0.75, f.z), u = Math.max(4, c.height * 0.008), n = 5 + (f.id % 3);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + 0.6, sp = (0.12 + ((i * 37 + f.id * 11) % 10) / 10 * 0.16) * c.height;
      scraps.push({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: -Math.abs(Math.sin(a)) * sp * 0.8 - c.height * 0.05,
        rot: a, vr: (i % 2 ? 1 : -1) * (3 + (i % 3)), w: u * (0.8 + (i % 3) * 0.25), h: u * 0.55, t: 0, life: 0.9, col: i % 2 ? '#dcb055' : '#f3e6c8' });
    }
    after(0.25, () => { if (H.sound) H.sound.step({ surface: 'path', seed: 4100 + f.id }); });   // the stamp's quiet tap
  }

  function collect(f) {
    f.found = true;
    hintStuck = 0; if (bf.active) hideButterfly();   // the hint's job is done: no butterfly for a found world
    if (H.sound) H.sound.flap({ size: 0.5, up: true, key: 'folk' + f.id });
    foundFlourish(f);
    const tok = $('tok' + f.id); if (tok) tok.classList.add('found');
    const n = FOLK.filter((x) => x.found).length;
    const count = $('count');
    if (count) {
      count.textContent = n + ' of ' + FOLK.length;
      count.classList.remove('ping'); void count.offsetWidth; count.classList.add('ping');   // a brief ink ring on the count
    }
    toast({ mouse: 'a mouse!', snail: 'a snail!', beetle: 'a beetle!', hedgehog: 'a hedgehog!', frog: 'a frog!', robin: 'a robin!', moth: 'a moth!', fish: 'a fish!' }[f.kind] + (f.shy ? ' (the shy one)' : ''));
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
  const shuffle = $('shuffle'); if (shuffle) shuffle.addEventListener('click', () => { location.href = location.pathname + '?seed=' + (SEED % 999 + 1); });   // the same board, a new shuffle (no tier in 2D)
  const stay = $('stay'); if (stay) stay.addEventListener('click', () => { const card = $('endcard'); if (card) card.classList.add('hidden'); });

  // ---- the post-build fixup (the 3D game's approach, adapted to the 2D painter) ---------------------------------------
  // once the world has risen: any folk the fill hid, or the frame cut, or (for the shy) the flat stack would bury,
  // moves. ONE folk a tick, the next ~0.15 s later, so the relocations spread over the opening; a full sweep is a
  // pass, passes repeat while any folk moved, and the last falls back to the least-blocked spot it can find.
  const folkOk = (f) => f.shy ? (safeOnScreen(f) && openGround(f.x, f.z)) : (visibility(f).clear && safeOnScreen(f));
  // candidates are drawn ON SCREEN (unprojected through the kit's own projection), so the frame can never cut them
  const screenSpot = () => {
    const c = cvEl(), fy = 0.12 + pr() * 0.63, z = H.zAt(fy);
    const ox = H.proj(0, 0, z)[0], ux = H.proj(1, 0, z)[0] - ox;
    return [((pr() * 1.8 - 0.9) * c.width - ox) / ux, z];
  };
  function relocate(f) {
    for (let t = 0; t < 60; t++) {
      const [x, z] = screenSpot(), shyK = !f.shy ? 1 : (t < 30 ? 1 : 0.6);
      if (!(inBand(x, z, 4) && folkFree(x, z, f.shy ? 1.2 : 0.45) && !bigPieceNear(x, z)
        && Math.hypot(x - HERO_AT[0], z - HERO_AT[1]) > 6
        && FOLK.every((g) => g === f || Math.hypot(x - g.x, z - g.z) > (g.ok === false ? 4 : 8))
        && (!f.shy || openGround(x, z, shyK)))) continue;
      spawn(f, x, z, f.shy);
      if (folkOk(f)) { f.ok = true; return true; }
    }
    return false;
  }
  function relocateBest(f) {   // the last resort, when perfect spots ran out: the least-blocked of 30 in-frame spots beats a hidden folk
    let best = null, bestScore = -1;
    for (let t = 0; t < 30; t++) {
      const [x, z] = screenSpot();
      if (!(inBand(x, z, 4) && folkFree(x, z, f.shy ? 1.2 : 0.45) && !bigPieceNear(x, z)
        && Math.hypot(x - HERO_AT[0], z - HERO_AT[1]) > 6
        && FOLK.every((g) => g === f || Math.hypot(x - g.x, z - g.z) > 5))) continue;
      spawn(f, x, z, f.shy);
      if (!safeOnScreen(f)) continue;
      const s = f.shy ? 1 : visibility(f).score;
      if (s > bestScore) { bestScore = s; best = [x, z]; }
    }
    if (!best) return false;
    spawn(f, best[0], best[1], f.shy);
    f.ok = true;
    return true;
  }
  let fixups = 0, fi = 0, moved = false;
  const fixup = () => {
    if (fi < FOLK.length) {
      const f = FOLK[fi++];
      if (!f.found) {
        if (f.starter) { f.ok = true; after(0.15, fixup); return; }   // the greeter's hand-placed spot is final
        f.ok = folkOk(f);
        if (!f.ok) {
          if (fixups < 5) { if (relocate(f)) moved = true; }
          else if (relocateBest(f)) moved = true;   // the final pass: least-blocked beats hidden
        }
      }
      after(0.15, fixup);
    } else if (moved && ++fixups < 6) { moved = false; fi = 0; after(0.15, fixup); }
  };
  after(0.8, fixup);
  if (starter) after(2.0, () => { if (!starter.found) placeGreeter(starter); });   // the raised world's sprite-coverage test confirms or nudges the greeter

  // ---- the test hook (?seed=N drives it): positions, screen places, visibility and synthetic clicks ------------------
  return {
    ver: 1, seed: SEED, folk: FOLK,
    state: () => ({ seed: SEED, foldOpen: H.isOpen ? H.isOpen() : null, found: FOLK.filter((f) => f.found).length, total: FOLK.length, done, stamps: stamps.length }),
    // clickClear: standing coverage (the 2D sibling of the 3D probe rays); facing: +1 the print is toward the camera,
    // -1 a turned card; screen: CSS px of the folk's VISIBLE card centre, in the world's current fold state
    probe: () => FOLK.map((f) => { const v = visibility(f); return { id: f.id, kind: f.kind, shy: f.shy, x: +f.x.toFixed(1), z: +f.z.toFixed(1), clickClear: v.clear, facing: f.shy ? -1 : 1, onScreen: safeOnScreen(f), screen: project(f), found: f.found, starter: !!f.starter }; }),
    click: (id) => { const f = FOLK[id], [sx, sy] = project(f); dispatchEvent(new PointerEvent('pointerdown', { clientX: sx, clientY: sy })); dispatchEvent(new PointerEvent('pointerup', { clientX: sx, clientY: sy })); },
    hint: manualHint,   // the same code path the "hint" tab's click uses
    fold: () => H.setOpen(!H.isOpen()),
  };
})();
window.__paperfolk = PFG;
window.__pfh = H;   // the test hook's way into the harness (springs, projection, the sprite list)

const __loading = document.getElementById('loading');   // the world is printed (a slow, single synchronous build): lift the note
if (__loading) __loading.remove();

H.start();
