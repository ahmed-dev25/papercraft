// papercraft / games / paperfair — a pop-up carnival shooting gallery in the kit's papercraft style.
//
// BRIEF      a dusk fairground shooting gallery, fixed 16:9 diorama, calm and warm; everything folds up from the page.
// SUBJECT    a long target rail of ducks, balloons and prize stars in front of a prize backboard, behind a blurred
//            wooden counter; the eye lands on the rail (sharp band) and follows the torn sawdust lane up from the counter.
// STOCK      cardstock for every printed card, kraft backs, tissue for the lantern shades, corrugated for crates.
// PALETTE    ground #b7a88b (sawdust) · ground shadow #2e5a62 / #1f414c (deep teal) · lane #e7d5ae ·
//            cream #f1e1bd · ochre #d99f45 · lead coral #cf4f3e / deep #9d3732 · gold #f0bd5a · ink #33211d ·
//            cool accent #4f7d7c · haze #8a7489 · shadow tint #1d2e4c. All derived for this dusk fair.
// LIGHT      kit dusk mood: key #ffb38a from the left (dir -0.866,0.45,0.5) ~27 deg up, violet fill #6f63a8,
//            leak #3a4460, warm paper lanterns #ffb070. No coloured fog; shadows are blue-violet.
// LENS       fov 26, pitch 47, target [2,1.5,-6], focus on the rail: sharp band across the targets, blurred counter
//            and far tents, 18 px maximum blur at 1080p; printed ground past every frame edge.
// LAYOUT     counter z +10 · launch z +8.2 · lane z +7..-8.6 · target rail z -10.4 (deck -9.4..-12.8) ·
//            prize backboard z -14.4 · poles x -24 / 29 · far tents x -34 / 37. 16:9 authored.
// MOTION     score-line hinges: targets rise with overshoot and fold flat with the kit's slap; bunting and flags
//            sway; lanterns flicker subtly; confetti and moths on the fixed clock. No camera shake, no scale tricks.
// TYPES      platform (counter, rail), score-line flaps (targets, signs), layered flats (backboard, prizes, bunting),
//            slotted crosses (poles, lanterns), drawnPiece (figures, props, targets), printed page (sawdust, lane).
// SOUND      paper flaps on hinges, a quiet two-partial chime on a hit, a dull thump on a miss.
// BANNED     sky/horizon, gloss, glow outlines, HUD bars, floating numbers, table or page edge in frame.
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { makeCard, hinge, platform, crossCard, paperMaterial } from 'papercraft/lib/paperkit-3d.js';
import { createLife } from 'papercraft/lib/paper-life.js';
import { createHarness, MOODS } from './harness.js';

// ---- 0. quality tier, resolved BEFORE the harness exists (the knobs go into createHarness's call) ----------------
// ?tier=high|med|low always wins and turns every automatic step-down off; otherwise a hardware heuristic picks the
// tier up front, so a weak machine never pays for a high-tier build and then rebuilds. No reloads, nothing persisted.
const QP = new URLSearchParams(location.search);
const TIER = (() => {
  const t = QP.get('tier');
  if (t === 'high' || t === 'med' || t === 'low') return t;
  const cores = navigator.hardwareConcurrency, dm = navigator.deviceMemory;
  if ((cores >= 1 && cores <= 2) || (dm !== undefined && dm <= 4)) return 'low';
  if ((cores >= 1 && cores <= 4) || (dm !== undefined && dm <= 8)) return 'med';
  return 'high';
})();
const TIERS = {
  high: { dpr: 2, shadow: 4096, msaa: 4, taps: 40, fallers: 20, moths: 6, motes: 18 },
  med: { dpr: 1.25, shadow: 2048, msaa: 2, taps: 24, fallers: 12, moths: 4, motes: 10 },
  low: { dpr: 1, shadow: 1024, msaa: 0, taps: 16, fallers: 8, moths: 2, motes: 6 },
};
const Q = TIERS[TIER];
const PF_LIFE = [];   // [kind, Q key] pairs the live one-shot step-down can thin without a rebuild

// ---- 1. the world's only palette (see the spec above: do not start a similar prompt from these hexes) ------------
const C = {
  ground: '#b7a88b', saw: '#d8c49c', groundWarm: '#cbb68f', lane: '#e7d5ae', laneEdge: '#b49a6e',
  teal: '#2e5a62', tealDeep: '#1f414c', tealLight: '#4f7d7c',
  wood: '#9a6238', woodDark: '#6f4527', woodLight: '#c08a54', kraft: '#c9a873',
  cream: '#f1e1bd', creamDeep: '#dfc898', ochre: '#d99f45', ochreDeep: '#b97c32',
  coral: '#cf4f3e', coralDeep: '#9d3732', coralSoft: '#e07a5f',
  gold: '#f0bd5a', goldDeep: '#c98f2f', lantern: '#ffc46a',
  ink: '#33211d', inkSoft: '#5a3a2b',
  violet: '#6f63a8', haze: '#8a7489', shadow: '#1d2e4c',
};

// ---- 2. small geometry/print helpers shared by the pieces -------------------------------------------------------
const D = P2.draw2, PI = Math.PI, TAU = PI * 2;
const sh = P2.shade, mix = P2.mix, rgba = P2.rgba;
const arc = (cx, cy, rx, ry, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
});
const rr = (x, y, w, h, k) => {
  const r = Math.min(k, w / 2, h / 2);
  return [...arc(x + w - r, y + r, r, r, -PI / 2, 0, 5), ...arc(x + w - r, y + h - r, r, r, 0, PI / 2, 5),
    ...arc(x + r, y + h - r, r, r, PI / 2, PI, 5), ...arc(x + r, y + r, r, r, PI, 1.5 * PI, 5)];
};
const starPts = (cx, cy, R, r, n = 5, rot = PI / 2) => Array.from({ length: n * 2 }, (_, i) => {
  const a = rot + i * PI / n, rad = i % 2 ? r : R; return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
});
const bandRect = (P, y0, y1, color, opts = {}) => P.layer((g) => {
  g.fillStyle = color; g.fillRect(P.box.x0 - 2, y0, P.box.w + 4, y1 - y0);
}, color, { lip: .75, shadow: .65, depth: 1, ...opts });
const disc = (P, x, y, rx, ry, color, opts = {}) => P.layer((g) => {
  g.fillStyle = color; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
}, color, { lip: .7, shadow: .6, ...opts });

// a printed plank field: one layer paints every board (each gets its own lip/shadow), grain and nails are ink
function paintPlanks(P, wood, { n = 5, vertical = false, tone = .06, nails = true, grain = true } = {}) {
  const b = P.box;
  P.gradient(sh(wood, .1), sh(wood, -.12), vertical ? .7 : .5); P.felt(.55);
  P.layer((g) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = sh(wood, (i % 2 ? -1 : 1) * tone + (P.r() - .5) * .04);
      if (vertical) g.fillRect(b.x0 + i * b.w / n + .01, b.y0 - 1, b.w / n - .02, b.h + 2);
      else g.fillRect(b.x0 - 1, b.y0 + i * b.h / n + .01, b.w + 2, b.h / n - .02);
    }
  }, wood, { shadow: .65, lip: .8, depth: 1.2 });
  if (grain) P.draw((g) => {
    g.strokeStyle = rgba(sh(wood, -.45), .38); g.lineWidth = Math.max(1, .035 * P.U); g.lineCap = 'round';
    for (let i = 0; i < n * 3; i++) {
      const x = b.x0 + P.r() * b.w, y = b.y0 + P.r() * b.h, l = (.12 + P.r() * .3) * (vertical ? b.h : b.w);
      g.beginPath(); g.moveTo(x, y);
      if (vertical) g.quadraticCurveTo(x + (P.r() - .5) * .06, y + l / 2, x + (P.r() - .5) * .04, y + l);
      else g.quadraticCurveTo(x + l / 2, y + (P.r() - .5) * .06, x + l, y + (P.r() - .5) * .04);
      g.stroke();
    }
  });
  if (nails) P.draw((g) => {
    g.fillStyle = rgba(sh(wood, .5), .55);
    for (let i = 0; i < n; i++) for (const u of [.18, .82]) {
      const x = vertical ? b.x0 + (i + u) * b.w / n : b.x0 + u * b.w;
      const y = vertical ? b.y0 + u * b.h : b.y0 + (i + .18) * b.h / n;
      g.beginPath(); g.arc(x, y, .035 * P.U, 0, TAU); g.fill();
    }
  });
  P.innerShade(sh(wood, -.55), { alpha: .3, blurPx: 7 });
}

// a striped canvas (awnings, tents, bunting): flat printed stripes + a glued scallop trim and one medallion
function paintStripes(P, base, a, b, { n = 7, vertical = true, scallop = false, medal = true } = {}) {
  const box = P.box;
  P.gradient(sh(base, .10), sh(base, -.12), .6); P.felt(.5);
  P.draw((g) => {
    const span = vertical ? box.w : box.h, start = vertical ? box.x0 : box.y0;
    g.fillStyle = b;
    for (let i = 0; i < n; i += 2) {
      if (vertical) g.fillRect(start + i * span / n, box.y0 - 1, span / n, box.h + 2);
      else g.fillRect(box.x0 - 1, start + i * span / n, box.w + 2, span / n);
    }
  });
  if (scallop) P.layer((g) => {
    const r = Math.min(box.w, box.h) * .07, y = box.y0 + box.h * .1;
    g.fillStyle = a;
    for (let x = box.x0 + r; x < box.x1; x += r * 2) { g.beginPath(); g.arc(x, y, r, PI, TAU); g.fill(); }
  }, a, { rim: .7, shadow: .6 });
  if (medal) {
    const cx = box.x0 + box.w * .5, cy = box.y0 + box.h * .56, r = Math.min(box.w, box.h) * .16;
    P.layer(starPts(cx, cy, r, r * .42, 5, PI / 2), C.cream, { lip: .8, shadow: .7 });
  }
  P.innerShade(sh(base, -.6), { alpha: .34, blurPx: 8 });
}

// ---- 3. the harness: fixed overview, dusk, the kit's lens and moods ----------------------------------------------
const DUSK = {
  ...MOODS.dusk, leak: '#3a4460',
  post: { ...MOODS.dusk.post, haze: '#8a7489', hazeStart: 22, hazeEnd: 80, hazeAmount: .36, shadowTint: '#1d2e4c', shadowLift: .04, vignetteColor: '#120f22' },
};
const H = createHarness({
  ground: C.ground, bounds: { x0: -70, x1: 70, z0: -60, z1: 30 },
  view: { pitch: 47, dist: 66, target: [2, 1.5, -6] }, focus: [2, 2.1, -10.4], subject: [2, -8],
  play: false, mood: 'dusk', moods: { ...MOODS, dusk: DUSK },
  dpr: Q.dpr, shadowMap: Q.shadow, msaa: Q.msaa, lens: { taps: Q.taps, greenDesat: .12 },
  light: { distance: 120, shadowExtent: 54 },
});
const { flags, camera, scene, THREE: T } = H;
const RES = 1;
const popup = (pts, paint, o = {}) => H.popup(pts, paint, {
  res: flags.ROAM || flags.TEST || o.x === undefined || o.z === undefined || H.sharpAt(o.x, o.z) ? RES : RES * .6, ...o,
});

// world coordinates used by the game layer
const RAIL_FRONT = -9.4, RAIL_Z = -10.45, DECK_Z = -9.4, DECK_D = 3.4, RAIL_TOP = 1.35 + .07;
const BOARD_Z = -14.4, COUNTER_Z = 10.0, COUNTER_H = 2.8;
const LAUNCH = new T.Vector3(2, 3.08, 8.15);

// ---- 4. the printed ground: sawdust, a torn lane, ticket stubs, confetti flecks --------------------------------
const laneCtrl = [[.4, 8.8], [4.6, 5.4], [-.8, 1.2], [3.4, -3.4], [2.2, -8.6]];
const laneLine = P2.pathLine(laneCtrl, { step: .4 }).pts;
H.printGround(({ g, ppu, X, Z, rnd, washes, torn, band, bandOf, ribbon, line, drifts }) => {
  washes([C.groundWarm, C.saw, C.groundWarm, C.tealLight, C.saw], { scales: [[56, 170, 430, .26], [190, 55, 150, .17], [680, 12, 38, .1]] });
  // deep teal pools under the gallery and the counter: painted shade, never a coloured fog
  torn([[-34, -13.6], [34, -13.6], [34, -7.7], [20, -8.2], [2, -7.8], [-20, -8.3], [-34, -7.6]], rgba(C.tealDeep, .26), 'rgba(244,232,208,0.16)');
  torn([[-30, 11.2], [32, 11.2], [32, 7.4], [12, 7.0], [-8, 7.6], [-30, 7.1]], rgba(C.tealDeep, .2), 'rgba(244,232,208,0.14)');
  // the lane: a torn pale strip of swept sawdust with two bends, a warmer worn centre, grit inside
  torn(bandOf(laneLine, 2.35), C.lane, 'rgba(251,244,226,0.78)');
  torn(bandOf(laneLine, 1.48), rgba('#f8eccd', .7), 'rgba(0,0,0,0)');
  for (let k = 0; k < 120; k++) {   // grit and straw inside the lane
    const p = laneLine[Math.floor(rnd() * laneLine.length)], x = p[0] + (rnd() - .5) * 4.6, z = p[1] + (rnd() - .5) * .6;
    g.strokeStyle = rnd() < .55 ? rgba(sh(C.laneEdge, -.2), .45) : rgba('#fff5dd', .6);
    g.lineWidth = (1 + rnd() * 1.2); g.beginPath(); g.moveTo(X(x), Z(z)); g.lineTo(X(x + (rnd() - .5) * .5), Z(z + (rnd() - .5) * .35)); g.stroke();
  }
  // a printed boardwalk in front of the rail: planks across, torn ends
  const bw = [[-21, -8.9], [25, -8.9], [25, -7.6], [-21, -7.6]];
  torn(bw, rgba(C.woodLight, .34), 'rgba(246,236,214,0.35)');
  g.strokeStyle = rgba(C.woodDark, .42); g.lineWidth = .08 * ppu;
  for (let x = -20; x < 25; x += 1.5) { g.beginPath(); g.moveTo(X(x), Z(-8.9)); g.lineTo(X(x + .05), Z(-7.6)); g.stroke(); }
  // ticket stubs: little cream cards torn from a roll, scattered near the lane and the counter
  for (let k = 0; k < 26; k++) {
    const t = rnd(), p = laneLine[Math.floor(rnd() * laneLine.length)];
    const x = p[0] + (rnd() - .5) * (t < .5 ? 8 : 13), z = p[1] + (rnd() - .5) * 6, a = (rnd() - .5) * 1.4;
    g.save(); g.translate(X(x), Z(z)); g.rotate(a);
    g.fillStyle = rnd() < .3 ? C.creamDeep : C.cream;
    const w = (.55 + rnd() * .4) * ppu, h = (.28 + rnd() * .16) * ppu;
    g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2); g.lineTo(w / 2 - h * .18, 0); g.lineTo(w / 2, h / 2); g.lineTo(-w / 2, h / 2); g.closePath(); g.fill();
    g.fillStyle = rgba(C.coral, .6); g.fillRect(-w / 2, -h / 2, w * .22, h);
    g.strokeStyle = rgba(C.ink, .35); g.lineWidth = 1;
    for (let q = 0; q < 3; q++) { g.beginPath(); g.moveTo(-w * .18, -h * .18 + q * h * .18); g.lineTo(w * .2, -h * .18 + q * h * .18); g.stroke(); }
    g.restore();
  }
  // confetti flecks and loose sawdust gathered in drifts (never an even sprinkle)
  drifts((x, y) => {
    const r = rnd();
    if (r < .42) { const l = 2 + rnd() * 3; g.strokeStyle = rgba(sh(C.laneEdge, -.15), .55); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y - l * .4); g.stroke(); }
    else {
      g.fillStyle = [C.coral, C.gold, C.cream, C.tealLight, C.coralSoft][Math.floor(rnd() * 5)];
      g.globalAlpha = .55 + rnd() * .35;
      if (rnd() < .55) g.fillRect(x, y, 2 + rnd() * 3, 1.5 + rnd() * 2);
      else { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y); g.lineTo(x + 2, y - 4); g.closePath(); g.fill(); }
      g.globalAlpha = 1;
    }
  }, { n: 3600, inside: .26, outside: .004, threshold: .7 });
});

// ---- 5. the printed pieces: every one its own layered print -----------------------------------------------------

// 5a. the counter: planks, a pasted prize-ticket strip, a painted star at each end
function paintCounterFace(P) {
  paintPlanks(P, C.wood, { n: 7, vertical: true, tone: .07 });
  const b = P.box;
  bandRect(P, b.y0 + b.h * .68, b.y0 + b.h * .95, C.cream, { lip: 1, shadow: .8, depth: 1.4 });
  P.draw((g) => {
    g.fillStyle = rgba(C.coral, .9); g.fillRect(b.x0 + b.w * .04, b.y0 + b.h * .71, b.w * .92, b.h * .035);
    g.strokeStyle = rgba(C.ink, .5); g.lineWidth = Math.max(1, .02 * P.U);
    for (let i = 1; i < 16; i++) { const x = b.x0 + b.w * .05 + i * b.w * .9 / 16; g.beginPath(); g.moveTo(x, b.y0 + b.h * .72); g.lineTo(x, b.y0 + b.h * .92); g.stroke(); }
    for (let i = 0; i < 16; i += 2) {
      const x = b.x0 + b.w * .05 + (i + .5) * b.w * .9 / 16;
      g.fillStyle = rgba(C.ink, .35); g.beginPath(); g.arc(x, b.y0 + b.h * .835, .05 * P.U, 0, TAU); g.fill();
    }
  });
  for (const sx of [.12, .88]) {
    P.layer(starPts(b.x0 + b.w * sx, b.y0 + b.h * .82, b.h * .17, b.h * .075, 5), C.gold, { lip: .8, shadow: .6 });
  }
  bandRect(P, b.y0 + b.h * .04, b.y0 + b.h * .13, sh(C.woodDark, -.15), { lip: .5, shadow: .5, depth: .8 });
}

function paintCounterDeck(P) {
  paintPlanks(P, C.woodLight, { n: 6, vertical: false, tone: .08 });
  const b = P.box;
  bandRect(P, b.y0, b.y0 + b.h * .09, C.woodDark, { lip: .4, shadow: .5, depth: .7 });
  P.draw((g) => {   // a painted coral line and little gold stars across the front edge
    g.fillStyle = rgba(C.coral, .85); g.fillRect(b.x0, b.y0 + b.h * .13, b.w, b.h * .035);
    g.fillStyle = rgba(C.gold, .85);
    for (let x = b.x0 + b.w * .08; x < b.x1; x += b.w * .11) { g.beginPath(); g.arc(x, b.y0 + b.h * .21, .06 * P.U, 0, TAU); g.fill(); }
  });
}

// 5b. the target rail: an open posts face, a plank deck, a coral beam
function paintRailFace(P) {
  paintPlanks(P, C.wood, { n: 11, vertical: true, tone: .06 });
  const b = P.box;
  bandRect(P, b.y0 + b.h * .58, b.y0 + b.h * .94, C.coralDeep, { lip: .8, shadow: .7, depth: 1.2 });
  P.draw((g) => {
    g.fillStyle = rgba(C.cream, .88); g.fillRect(b.x0 + b.w * .03, b.y0 + b.h * .7, b.w * .94, b.h * .12);
    g.fillStyle = rgba(C.ink, .45);
    for (let x = b.x0 + b.w * .05; x < b.x1 - b.w * .04; x += b.w * .075) g.fillRect(x, b.y0 + b.h * .72, .06 * P.U, b.h * .08);
    g.fillStyle = rgba(C.gold, .9);
    for (let x = b.x0 + b.w * .09; x < b.x1; x += b.w * .17) { g.beginPath(); g.arc(x, b.y0 + b.h * .885, .05 * P.U, 0, TAU); g.fill(); }
  });
  P.innerShade(sh(C.woodDark, -.4), { alpha: .32, blurPx: 6 });
}

function paintRailDeck(P) {
  paintPlanks(P, C.woodLight, { n: 6, vertical: false, tone: .07 });
  const b = P.box;
  bandRect(P, b.y0 + b.h * .04, b.y0 + b.h * .16, C.tealDeep, { lip: .5, shadow: .5, depth: .8 });
  P.draw((g) => {
    g.fillStyle = rgba(C.gold, .9);
    for (let x = b.x0 + b.w * .06; x < b.x1; x += b.w * .1) { g.beginPath(); g.arc(x, b.y0 + b.h * .1, .045 * P.U, 0, TAU); g.fill(); }
    g.strokeStyle = rgba(C.cream, .35); g.lineWidth = Math.max(1, .03 * P.U);
    for (let y = b.y0 + b.h * .3; y < b.y1; y += b.h * .18) { g.beginPath(); g.moveTo(b.x0 + b.w * .08, y); g.lineTo(b.x1 - b.w * .08, y + .1 * P.U); g.stroke(); }
  });
}

function paintEndPost(P) {
  paintPlanks(P, C.wood, { n: 3, vertical: true, tone: .06 });
  const b = P.box;
  bandRect(P, b.y0 + b.h * .12, b.y0 + b.h * .24, C.coral, { lip: .7, shadow: .7 });
  disc(P, b.x0 + b.w / 2, b.y1 - b.h * .18, b.w * .26, b.w * .26, C.gold, { lip: .9, shadow: .8 });
  disc(P, b.x0 + b.w / 2 - b.w * .05, b.y1 - b.h * .22, b.w * .08, b.w * .08, C.cream, { lip: 0, shadow: .3, depth: .5 });
}

// 5c. the prize backboard: a deep teal painted wall, cream trims, a lit marquee, a painted star
function boardOutline(w = 34, h = 6.1) {
  const p = [[-w / 2, 0], [w / 2, 0], [w / 2, h]];
  for (let i = 23; i >= 0; i--) p.push([-w / 2 + w * i / 24, h + .6 * Math.sin(PI * i / 24)]);
  return p;
}
function paintBoard(P) {
  const b = P.box;
  P.gradient(sh(C.teal, .10), sh(C.tealDeep, -.06), .5); P.felt(.58);
  P.layer((g) => {      // vertical painted boards, one layer, each board its own glued part
    const n = 9;
    for (let i = 0; i < n; i++) {
      g.fillStyle = sh(C.teal, (i % 2 ? -.05 : .055) + (P.r() - .5) * .025);
      g.fillRect(b.x0 + i * b.w / n, b.y0 - 1, b.w / n - .02, b.h + 2);
    }
  }, C.teal, { shadow: .7, lip: .55, depth: 1.4 });
  // cream side trims and a coral shelf band
  bandRect(P, b.y0 + b.h * .34, b.y0 + b.h * .39, C.coral, { lip: .8, shadow: .7, depth: 1.2 });
  bandRect(P, b.y0 + b.h * .40, b.y0 + b.h * .43, C.creamDeep, { lip: .6, shadow: .5, depth: .8 });
  for (const sx of [.018, .982]) P.layer((g) => {
    g.fillStyle = C.cream; g.fillRect(b.x0 + b.w * sx, b.y0, b.w * .012, b.h);
  }, C.cream, { lip: .4, shadow: .4, depth: .7 });
  // a pale sunburst behind the prizes and a gold star pinned on the marquee
  P.draw((g) => {
    g.save(); g.translate(b.x0 + b.w * .5, b.y0 + b.h * .47);
    g.strokeStyle = rgba(C.cream, .16); g.lineWidth = .015 * P.U;
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * b.w * .46, Math.sin(a) * b.h * .42); g.stroke(); }
    g.restore();
  });
  // marquee: cream band with coral scallops, warm bulbs printed as glow
  bandRect(P, b.y1 - b.h * .12, b.y1 - b.h * .03, C.cream, { lip: 1, shadow: .8, depth: 1.4 });
  P.layer((g) => {
    g.fillStyle = C.coral;
    const r = .07 * P.U, y = b.y1 - b.h * .11;
    for (let x = b.x0 + r; x < b.x1; x += r * 2) { g.beginPath(); g.arc(x, y, r, PI, TAU); g.fill(); }
  }, C.coral, { rim: .75, shadow: .6, depth: 1.1 });
  P.draw((g) => {
    g.fillStyle = C.lantern;
    for (let i = 0; i < 17; i++) { const x = b.x0 + b.w * (.06 + .88 * i / 16); g.beginPath(); g.arc(x, b.y1 - b.h * .075, .025 * P.U, 0, TAU); g.fill(); }
  });
  P.glow((g) => {
    for (let i = 0; i < 17; i++) { const x = b.x0 + b.w * (.06 + .88 * i / 16); g.beginPath(); g.arc(x, b.y1 - b.h * .075, .025 * P.U, 0, TAU); g.fill(); }
  });
  // a gold star medallion pinned on the marquee (drawn over the bulbs, as a glued paper ornament)
  P.layer(starPts(b.x0 + b.w * .5, b.y1 - b.h * .075, .07 * P.U, .032 * P.U, 5), C.gold, { lip: .9, shadow: .8, depth: 1.5 });
  P.layer(starPts(b.x0 + b.w * .5, b.y1 - b.h * .075, .035 * P.U, .016 * P.U, 5), C.cream, { lip: .5, shadow: .6, depth: .7 });
  P.innerShade(sh(C.tealDeep, -.5), { alpha: .4, blurPx: 12 });
}

function paintShelf(P) {
  paintPlanks(P, C.woodLight, { n: 6, vertical: false, tone: .08 });
  const b = P.box;
  P.draw((g) => {
    g.fillStyle = rgba(C.gold, .9);
    for (let x = b.x0 + b.w * .05; x < b.x1; x += b.w * .1) { g.beginPath(); g.arc(x, b.y0 + b.h * .68, .03 * P.U, 0, TAU); g.fill(); }
  });
}
function paintShelfEdge(P) {
  paintPlanks(P, C.wood, { n: 1, vertical: true, tone: .05 });
  P.draw((g) => {
    g.fillStyle = rgba(C.gold, .85);
    for (let x = P.box.x0 + P.box.w * .04; x < P.box.x1; x += P.box.w * .07) { g.beginPath(); g.arc(x, P.box.y0 + P.box.h * .5, .05 * P.U, 0, TAU); g.fill(); }
  });
}

// 5d. the side poles and their lanterns
const polePts = P2.fromDrawing((g) => {
  D.rect(g, -.46, 0, .92, 7.65, .07);
  D.rect(g, -.9, 0, 1.8, .26, .05);
  D.rect(g, -.68, 7.58, 1.36, .28, .05);
  D.ell(g, 0, 8.03, .27, .27);
  D.poly(g, [[.1, 8.1], [.9, 8.3], [.12, 8.26]]);
}, { w: 2.0, h: 8.5, name: 'fair pole' });
function paintPole(P) {
  const b = P.box;
  P.gradient(sh(C.cream, .08), sh(C.creamDeep, -.08), .4); P.felt(.55);
  P.draw((g) => {   // a coral spiral climbing the pole
    g.strokeStyle = C.coral; g.lineWidth = .06 * P.U; g.lineCap = 'round';
    for (let y = b.y0 + .2; y < b.y1 - .5; y += .5) { g.beginPath(); g.moveTo(b.x0 + b.w * .2, y); g.quadraticCurveTo(b.x0 + b.w * .82, y + .14, b.x0 + b.w * .78, y + .34); g.stroke(); }
  });
  P.draw((g) => {   // the little pennant cut into the pole's top
    g.fillStyle = C.coral; g.beginPath(); g.moveTo(.1, 8.1); g.lineTo(.9, 8.3); g.lineTo(.12, 8.26); g.closePath(); g.fill();
  });
  bandRect(P, b.y0 + .08, b.y0 + .25, C.coralDeep, { lip: .7, shadow: .6 });
  bandRect(P, b.y1 - .38, b.y1 - .22, C.gold, { lip: .8, shadow: .6 });
  disc(P, b.x0 + b.w / 2, b.y1 - .27, b.w * .2, b.w * .2, C.gold, { lip: .9, shadow: .8 });
  P.innerShade(sh(C.coralDeep, -.3), { alpha: .3, blurPx: 7 });
}

const lanternPts = P2.fromDrawing((g) => {
  D.rect(g, -.38, 0, .76, .16, .05);
  D.ell(g, 0, .76, .52, .62);
  D.rect(g, -.28, 1.3, .56, .12, .04);
  D.rect(g, -.04, 1.38, .08, .28, .03);
  D.rect(g, -.12, 1.62, .24, .06, .03);
}, { w: 1.25, h: 1.7, name: 'lantern' });
function paintLantern(P) {
  const b = P.box;
  P.gradient(sh(C.coral, .1), sh(C.coralDeep, -.08), .5); P.felt(.45);
  P.layer((g) => {
    g.fillStyle = sh(C.cream, .06);
    for (const [x, w] of [[-.32, .17], [.0, .2], [.32, .17]]) { g.beginPath(); g.ellipse(x, .8, w, .45, 0, 0, TAU); g.fill(); }
  }, C.cream, { lip: .8, shadow: .6, depth: .9 });
  P.draw((g) => {
    g.fillStyle = C.lantern;
    for (const [x, w] of [[-.32, .13], [0, .15], [.32, .13]]) { g.beginPath(); g.ellipse(x, .8, w, .36, 0, 0, TAU); g.fill(); }
    g.strokeStyle = rgba(C.ink, .5); g.lineWidth = Math.max(1, .04 * P.U);
    g.beginPath(); g.moveTo(b.x0, .1); g.lineTo(b.x1, .1); g.stroke();
  });
  P.glow((g) => {
    for (const [x, w] of [[-.32, .13], [0, .15], [.32, .13]]) { g.beginPath(); g.ellipse(x, .8, w, .36, 0, 0, TAU); g.fill(); }
  });
  bandRect(P, .02, .16, C.gold, { lip: .8, shadow: .6 });
  bandRect(P, 1.28, 1.4, C.gold, { lip: .8, shadow: .6 });
  disc(P, 0, .76, .1, .1, C.gold, { lip: .4, shadow: .4, depth: .6 });
}

// 5e. the prizes on the shelf (each a layered flat, all in front of the board)
function prizeTeddy() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink('#b58655'); D.ell(g, -.34, 1.58, .2, .2); D.ell(g, .34, 1.58, .2, .2);
    g.fillStyle = ink('#c99763'); D.ell(g, 0, 1.43, .42, .38);
    g.fillStyle = ink('#b07a4a'); D.ell(g, 0, .7, .5, .55);
    g.fillStyle = ink('#c99763'); D.ell(g, -.5, .82, .19, .28); D.ell(g, .5, .82, .19, .28);
    g.fillStyle = ink('#b58655'); D.ell(g, -.25, .16, .2, .24); D.ell(g, .25, .16, .2, .24);
    g.fillStyle = ink(C.cream); D.ell(g, 0, .66, .27, .34);
    g.fillStyle = ink('#e3c49a'); D.ell(g, 0, 1.3, .2, .16);
    g.fillStyle = ink(C.coral); D.poly(g, [[-.18, 1.05], [-.36, .93], [-.14, .9], [0, 1.0], [.14, .9], [.36, .93], [.18, 1.05]]);
    g.fillStyle = ink(C.ink, 'print'); D.ell(g, -.14, 1.47, .045, .05); D.ell(g, .14, 1.47, .045, .05); D.ell(g, 0, 1.34, .055, .045);
    g.fillStyle = ink('#8a5634', 'print'); D.ell(g, 0, .66, .06, .05);
  }, { w: 1.6, h: 1.95, name: 'prize teddy' });
}
function prizeJar() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink('#cfe0d6'); D.rect(g, -.48, .08, .96, 1.42, .14);
    g.fillStyle = ink('#b9d0c6'); D.rect(g, -.4, 0, .8, .12, .05);
    g.fillStyle = ink(C.ochreDeep); D.rect(g, -.42, 1.48, .84, .18, .06);
    g.fillStyle = ink(C.gold); D.rect(g, -.3, 1.6, .6, .1, .04);
    const candies = [[-.24, .35, C.coral], [.02, .3, C.gold], [.26, .38, C.tealLight], [-.12, .62, C.coralSoft], [.18, .66, C.cream], [-.28, .9, C.gold], [.07, .95, C.coral], [.27, .98, C.tealLight]];
    for (const [x, y, c] of candies) { g.fillStyle = ink(c); D.ell(g, x, y, .1, .1); }
    g.fillStyle = ink('#fff6e0', 'print'); D.rect(g, -.34, .48, .1, .82, .04);
  }, { w: 1.15, h: 1.8, name: 'prize jar' });
}
function prizeStar() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.wood); D.rect(g, -.3, 0, .6, .48, .06);
    g.fillStyle = ink(C.coral); D.poly(g, [[-.3, .46], [.3, .46], [.22, .58], [-.22, .58]]);
    g.fillStyle = ink(C.gold); D.poly(g, starPts(0, 1.28, .85, .38, 5, PI / 2));
    g.fillStyle = ink(C.cream); D.poly(g, starPts(0, 1.28, .53, .24, 5, PI / 2));
    g.fillStyle = ink(C.coral); D.ell(g, 0, 1.28, .13, .13);
    g.fillStyle = ink(C.cream, 'print'); D.ell(g, 0, 1.28, .055, .055);
  }, { w: 1.9, h: 2.18, name: 'prize star' });
}
function prizeHorn() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.gold); D.poly(g, [[-.7, .16], [.32, .46], [.48, 1.15], [-.62, 1.42]]);
    g.fillStyle = ink(C.coral); D.ell(g, .46, .8, .2, .44);
    g.fillStyle = ink(C.cream); D.ell(g, .47, .8, .11, .34);
    g.fillStyle = ink(C.ochreDeep); D.rect(g, -.78, .1, .3, .3, .06);
    g.fillStyle = ink(C.coralDeep, 'print'); D.rect(g, -.55, .3, .12, 1.02);
    g.fillStyle = ink(C.goldDeep, 'print'); D.rect(g, -.22, .38, .08, .9);
  }, { w: 1.9, h: 1.65, name: 'prize horn' });
}
function prizeCrown() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.gold); D.poly(g, [[-.68, .1], [-.68, .98], [-.34, .62], [0, 1.18], [.34, .62], [.68, .98], [.68, .1]]);
    g.fillStyle = ink(C.ochreDeep); D.rect(g, -.7, 0, 1.4, .24, .05);
    g.fillStyle = ink(C.coral); D.ell(g, -.3, .35, .09, .09); D.ell(g, .3, .35, .09, .09);
    g.fillStyle = ink(C.tealLight); D.ell(g, 0, .35, .1, .1);
    g.fillStyle = ink(C.cream, 'print'); D.ell(g, -.3, .37, .03, .03); D.ell(g, .3, .37, .03, .03); D.ell(g, 0, .37, .03, .03);
  }, { w: 1.55, h: 1.35, name: 'prize crown' });
}

// 5f. bunting triangles (a string of small cards) and a little flag
const triPts = [[-.3, 0], [0, -.64], [.3, 0]];
function paintFlag(P, a, b, dot) {
  P.fill(a); P.felt(.35);
  P.draw((g) => {
    g.fillStyle = b;
    g.beginPath(); g.moveTo(-.3, -.02); g.lineTo(.3, -.02); g.lineTo(.03, -.4); g.closePath(); g.fill();
    g.fillStyle = dot; g.beginPath(); g.arc(0, -.14, .05, 0, TAU); g.fill();
  });
  P.innerShade(b, { alpha: .3, blurPx: 3 });
}

// 5g. props: counter cups, popcorn, crates, barrels, bench, cart, tent, figures, prize wheel
function cupStack() {
  return P2.drawnPiece((g, ink) => {
    for (let i = 0; i < 3; i++) {
      const y = i * .72, w = .86 - i * .06;
      g.fillStyle = ink(i === 1 ? C.creamDeep : C.cream);
      D.poly(g, [[-w, y + .1], [w, y + .1], [w * .76, y + .86], [-w * .76, y + .86]]);
      g.fillStyle = ink(C.coral); D.rect(g, -w * .86, y + .34, w * 1.72, .12, .03);
      g.fillStyle = ink(C.gold); D.rect(g, -w * .8, y + .55, w * 1.6, .07, .02);
      g.fillStyle = ink('#f7eed8'); D.ell(g, 0, y + .1, w, .13);
    }
    g.fillStyle = ink(C.tealLight); D.rect(g, -.2, .3, .1, 1.6, .04); D.rect(g, .16, .14, .1, 1.3, .04);
    g.fillStyle = ink(C.gold); D.ell(g, -.15, 1.92, .1, .08); D.ell(g, .21, 1.46, .1, .08);
  }, { w: 2.4, h: 2.4, name: 'cup stack' });
}
function popcornBox() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.coral); D.poly(g, [[-1.1, .05], [1.1, .05], [.82, 2.15], [-.82, 2.15]]);
    g.fillStyle = ink(C.cream); D.rect(g, -.9, .7, 1.8, .18, .03); D.rect(g, -.82, 1.35, 1.64, .18, .03);
    g.fillStyle = ink(C.gold); D.ell(g, 0, 1.0, .34, .34);
    g.fillStyle = ink(C.cream, 'print'); D.ell(g, 0, 1.0, .16, .16);
    for (const [x, y, c] of [[-.5, 2.3, C.cream], [-.2, 2.42, '#f8e7b8'], [.15, 2.35, C.gold], [.45, 2.28, C.cream], [0, 2.55, C.creamDeep]]) {
      g.fillStyle = ink(c); D.ell(g, x, y, .2, .18);
    }
    g.fillStyle = ink(C.creamDeep); D.poly(g, [[-.85, 2.1], [.85, 2.1], [.72, 2.26], [-.72, 2.26]]);
  }, { w: 2.5, h: 2.8, name: 'popcorn box' });
}
function cratePiece() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.woodLight); D.rect(g, -1.15, 0, 2.3, 1.8, .06);
    g.fillStyle = ink(C.wood); for (let i = 0; i < 4; i++) D.rect(g, -1.15, .08 + i * .42, 2.3, .08);
    g.fillStyle = ink(C.woodDark); D.rect(g, -1.18, 0, .16, 1.8); D.rect(g, 1.02, 0, .16, 1.8);
    g.fillStyle = ink(C.ochre); D.poly(g, [[-.9, .18], [.9, 1.62], [.72, 1.62], [-1.02, .32]]);
    g.fillStyle = ink('#e8d7ac', 'print'); D.rect(g, -.45, .72, .55, .4, .04);
    g.fillStyle = ink(C.coral, 'print'); D.poly(g, starPts(0, .94, .16, .07, 5));
  }, { w: 2.5, h: 1.95, name: 'crate' });
}
function barrelPiece() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.wood); D.ell(g, 0, 1.05, .88, 1.05);
    g.fillStyle = ink(C.woodLight); D.ell(g, -.12, 1.05, .7, .98);
    g.fillStyle = ink(C.woodDark); D.rect(g, -.9, .42, 1.8, .14, .04); D.rect(g, -.9, 1.45, 1.8, .14, .04);
    g.fillStyle = ink(C.ochre); D.ell(g, 0, 2.05, .72, .16);
    g.fillStyle = ink(C.coral); D.ell(g, 0, 1.03, .3, .3);
    g.fillStyle = ink(C.cream, 'print'); D.ell(g, 0, 1.03, .13, .13);
  }, { w: 1.9, h: 2.3, name: 'barrel' });
}
function benchPiece() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.wood); D.rect(g, -1.5, .55, 3.0, .22, .04);
    g.fillStyle = ink(C.woodLight); D.rect(g, -1.42, .74, 2.84, .16, .04);
    g.fillStyle = ink(C.woodDark); D.rect(g, -1.2, 0, .22, .6); D.rect(g, .98, 0, .22, .6);
    g.fillStyle = ink(C.coral, 'print'); D.rect(g, -1.35, .58, .5, .06);
  }, { w: 3.1, h: 1.0, name: 'bench' });
}
function cartPiece() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.cream); D.rect(g, -1.5, .45, 3.0, 1.7, .08);
    g.fillStyle = ink(C.coral); for (let i = 0; i < 5; i++) D.rect(g, -1.5 + i * .58, .45, .22, 1.7);
    g.fillStyle = ink(C.woodDark); D.ell(g, -1.0, .4, .38, .38); D.ell(g, 1.0, .4, .38, .38);
    g.fillStyle = ink(C.creamDeep); D.ell(g, -1.0, .4, .15, .15); D.ell(g, 1.0, .4, .15, .15);
    g.fillStyle = ink(C.woodLight); D.rect(g, -1.6, 2.15, 3.2, .14, .04);
    g.fillStyle = ink(C.teal); D.poly(g, [[-1.75, 2.28], [1.75, 2.28], [1.45, 2.55], [-1.45, 2.55]]);
    g.fillStyle = ink(C.coral); D.rect(g, -1.6, 2.42, 3.2, .14, .04);
    for (const [x, y] of [[-.6, 2.62], [-.2, 2.7], [.3, 2.63], [.65, 2.55]]) { g.fillStyle = ink(C.creamDeep); D.ell(g, x, y, .18, .14); }
    g.fillStyle = ink(C.wood); D.rect(g, -.04, 2.55, .08, 1.25);
    g.fillStyle = ink(C.gold); D.poly(g, [[.04, 3.45], [.8, 3.7], [.08, 3.82]]);
    g.fillStyle = ink('#fff2d0', 'print'); D.rect(g, -1.2, 1.05, 2.4, .12); D.rect(g, -1.2, 1.6, 2.4, .1);
  }, { w: 3.6, h: 3.85, name: 'popcorn cart' });
}
function tentPiece() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.cream); D.poly(g, [[-3.3, 0], [3.3, 0], [0, 4.6]]);
    g.fillStyle = ink(C.coral); for (let i = -2; i <= 2; i += 2) D.poly(g, [[i * 1.1, 0], [(i + 1) * 1.1, 0], [0, 4.6]]);
    g.fillStyle = ink(C.teal); D.poly(g, [[-.75, 0], [.75, 0], [.5, 2.2], [0, 2.55], [-.5, 2.2]]);
    g.fillStyle = ink(C.cream); D.poly(g, [[-.28, 0], [.28, 0], [.22, 1.7], [0, 1.9], [-.22, 1.7]]);
    g.fillStyle = ink(C.gold); D.rect(g, -.08, 4.5, .16, 1.1);
    g.fillStyle = ink(C.coral); D.poly(g, [[.08, 5.4], [1.15, 5.2], [.1, 5.0]]);
    g.fillStyle = ink(C.cream); D.rect(g, -3.4, 0, 6.8, .18, .04);
  }, { w: 6.8, h: 5.6, name: 'fair tent' });
}
function barkerPiece() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink('#3d5d66'); D.rect(g, -.55, 0, 1.1, 1.85, .18);
    g.fillStyle = ink(C.cream); D.ell(g, 0, 2.2, .58, .86);
    g.fillStyle = ink(C.coral); D.poly(g, [[-.5, 2.62], [.5, 2.62], [.36, 2.2], [0, 1.98], [-.36, 2.2]]);
    g.fillStyle = ink('#2f4b54'); D.rect(g, -.62, 2.55, .26, 1.15, .08); D.rect(g, .36, 2.55, .26, 1.15, .08);
    g.fillStyle = ink('#e9c69f'); D.rect(g, -.12, 2.98, .24, .32, .05);
    g.fillStyle = ink('#e9c69f'); D.ell(g, 0, 3.6, .42, .46);
    g.fillStyle = ink('#4a2a1c'); D.ell(g, -.14, 3.68, .045, .05); D.ell(g, .14, 3.68, .045, .05);
    g.fillStyle = ink('#5a3322'); D.poly(g, [[-.2, 3.5], [.2, 3.5], [0, 3.38]]);
    g.fillStyle = ink('#8a5a34'); D.rect(g, -.18, 3.48, .36, .08, .03);
    g.fillStyle = ink(C.cream); D.poly(g, [[-.2, 3.32], [.2, 3.32], [.13, 3.24], [-.13, 3.24]]);
    g.fillStyle = ink(C.coral); D.ell(g, 0, 3.3, .09, .06);
    g.fillStyle = ink(C.cream); D.ell(g, 0, 4.06, .5, .12);
    g.fillStyle = ink(C.ochre); D.ell(g, 0, 4.14, .34, .22);
    g.fillStyle = ink(C.coralDeep); D.rect(g, -.34, 4.1, .68, .09, .03);
    g.fillStyle = ink(C.gold, 'print'); D.rect(g, -.05, 1.3, .1, .9);
    g.fillStyle = ink(C.gold, 'print'); D.ell(g, -.18, 1.55, .05, .05); D.ell(g, .18, 1.55, .05, .05); D.ell(g, 0, 1.25, .05, .05);
  }, { w: 2.6, h: 4.55, name: 'barker' });
}
function kidPiece() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink('#6b8f79'); D.rect(g, -.42, 0, .84, 1.35, .18);
    g.fillStyle = ink(C.cream); D.rect(g, -.08, .9, .16, .45, .05);
    g.fillStyle = ink('#e9c69f'); D.rect(g, -.1, 1.24, .2, .28, .05);
    g.fillStyle = ink('#e9c69f'); D.ell(g, 0, 1.75, .34, .36);
    g.fillStyle = ink('#4a2a1c'); D.ell(g, -.12, 1.8, .04, .045); D.ell(g, .12, 1.8, .04, .045);
    g.fillStyle = ink(C.coral); D.ell(g, 0, 1.6, .09, .035);
    g.fillStyle = ink(C.gold); D.poly(g, [[-.42, 2.08], [.42, 2.08], [0, 2.42]]);
    g.fillStyle = ink(C.ochreDeep); D.rect(g, -.44, 2.02, .88, .1, .03);
    g.fillStyle = ink('#6b8f79'); D.rect(g, -.6, 1.0, .18, .85, .06); D.rect(g, .42, 1.0, .18, .85, .06);
    g.fillStyle = ink('#e9c69f'); D.ell(g, -.6, .95, .12, .12); D.ell(g, .6, .95, .12, .12);
    g.fillStyle = ink(C.creamDeep); D.poly(g, [[.52, .88], [.98, .68], [.88, 1.04]]);
    g.fillStyle = ink(C.coral); D.ell(g, .86, 1.02, .16, .14);
  }, { w: 2.1, h: 2.6, name: 'fair kid' });
}
function wheelStand() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.woodDark); D.rect(g, -1.3, 0, .22, 2.2); D.rect(g, 1.08, 0, .22, 2.2);
    g.fillStyle = ink(C.wood); D.rect(g, -1.5, 2.0, 3.0, .24, .04);
    g.fillStyle = ink(C.cream); D.rect(g, -1.35, 2.2, 2.7, .38, .06);
    g.fillStyle = ink(C.coral); D.rect(g, -1.35, 2.34, 2.7, .1, .03);
    g.fillStyle = ink(C.wood); D.rect(g, -.1, 2.52, .2, .7, .04);
  }, { w: 3.2, h: 3.3, name: 'prize wheel stand' });
}
function paintWheel(P) {
  P.fill(C.cream); P.felt(.5);
  const n = 10, r = Math.min(P.box.w, P.box.h) / 2 - .04, cx = 0, cy = 0;
  const cols = [C.coral, C.cream, C.gold, C.tealLight, C.coralSoft];
  P.layer((g) => {
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
      g.fillStyle = sh(cols[i % cols.length], i % 2 ? .02 : -.03);
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath(); g.fill();
    }
  }, C.cream, { shadow: .6, lip: .6, depth: 1 });
  P.layer((g) => { g.lineWidth = .025 * P.U; g.strokeStyle = C.gold; g.beginPath(); g.arc(cx, cy, r - .05, 0, TAU); g.stroke(); }, C.gold, { shadow: .5, lip: .6, depth: .7 });
  P.draw((g) => {
    g.fillStyle = rgba(C.ink, .55);
    for (let i = 0; i < n; i++) { const a = (i + .5) / n * TAU; g.beginPath(); g.arc(Math.cos(a) * r * .68, Math.sin(a) * r * .68, .02 * P.U, 0, TAU); g.fill(); }
  });
  disc(P, 0, 0, .12 * P.U, .12 * P.U, C.ink, { lip: .3, shadow: .4, depth: .5 });
  disc(P, -.02 * P.U, .02 * P.U, .055 * P.U, .055 * P.U, C.gold, { lip: .4, shadow: .4, depth: .4 });
  P.innerShade(C.tealDeep, { alpha: .3, blurPx: 6 });
}
function wheelPointer() {
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(C.coral); D.poly(g, [[0, 0], [-.16, .48], [.16, .48]]);
    g.fillStyle = ink(C.cream); D.ell(g, 0, .5, .09, .09);
  }, { w: .5, h: .62, name: 'wheel pointer' });
}

// ---- 6. build the world ---------------------------------------------------------------------------------------
let rnd = P2.rng(401);   // one seeded stream for the world: an edit in one section never reshuffles another
const between = (a, b) => a + rnd() * (b - a);
const lanterns = [], bunting = [];   // glow flicker and a paper sway (it does hang from its string)

function buildWorld() {
  // 6a. the target rail: an open posts face, a plank deck, two capped end posts (walkable only visually)
  const postsFace = (w, h, n) => P2.fromDrawing((g) => {
    D.rect(g, -w / 2, h - .22, w, .22, .02);
    for (let i = 0; i <= n; i++) D.rect(g, -w / 2 + i * (w - .22) / n, 0, .22, h, .03);
  }, { w: w + .12, h: h + .05, name: 'posts face' });
  const rail = platform({
    w: 38, d: DECK_D, h: 1.35, paper: H.paper, seed: 511,
    facePts: postsFace(38, 1.35, 10), supportPts: postsFace(35, 1.35, 8).map(([x, y]) => [x, y - 1.35]),
    paints: { face: paintRailFace, deck: paintRailDeck, support: (P) => paintPlanks(P, C.woodDark, { n: 2, vertical: true }) },
    print: H.cardOpts(2, DECK_Z),
  });
  rail.name = 'target rail';
  const railH = popup(null, null, { node: rail, height: 1.35, x: 2, z: RAIL_FRONT, level: true });
  H.spots.rail = [2, RAIL_Z];
  const endPostPts = P2.fromDrawing((g) => {
    D.rect(g, -.22, 0, .44, 1.15, .05);
    D.rect(g, -.32, 1.12, .64, .14, .04);
    D.ell(g, 0, 1.36, .18, .18);
  }, { w: .8, h: 1.55, name: 'end post' });
  for (const dx of [-18.3, 18.3]) {
    popup(endPostPts, paintEndPost, { parent: rail.userData.deck, x: dx, z: -.55, yaw: 0, scale: 1, order: railH.order + .55 });
  }

  // 6b. the prize backboard, its shelf and prizes, and the bunting strung across the booth
  const board = popup(boardOutline(34, 6.1), paintBoard, { x: 2, z: BOARD_Z, yaw: 0, edge: .09, scale: 1 });
  H.glowing(board.group);
  const cardOpt = () => H.cardOpts(2, BOARD_Z, 1, null, 1);
  const shelfTop = makeCard([[-14.4, 0], [14.4, 0], [14.4, .86], [-14.4, .86]], {
    ...cardOpt(), paint: paintShelf, thickness: .07, edgeWidth: .07, back: 'kraft', folds: [],
  });
  shelfTop.rotation.x = -PI / 2; shelfTop.position.set(0, 2.42, .96); board.pivot.add(shelfTop);
  const shel = makeCard([[-14.4, 0], [14.4, 0], [14.4, .16], [13.4, .26], [-13.4, .26], [-14.4, .16]], {
    ...cardOpt(), paint: paintShelfEdge, thickness: .07, edgeWidth: .07, back: 'kraft',
  });
  shel.position.set(0, 2.4, .99); board.pivot.add(shel);
  const prizeDefs = [[-12.1, 'jar'], [-7.3, 'teddy'], [-2.2, 'star'], [2.8, 'horn'], [8.2, 'crown'], [12.55, 'jar']];
  const prizePieces = { jar: prizeJar, teddy: prizeTeddy, star: prizeStar, horn: prizeHorn, crown: prizeCrown };
  for (const [px, kind] of prizeDefs) {
    const [pts, paint] = prizePieces[kind]();
    const m = makeCard(pts, { ...cardOpt(), paint, thickness: .07, edgeWidth: .07, back: 'kraft' });
    m.position.set(px, 2.5, .45); m.rotation.y = (rnd() - .5) * .05;
    board.pivot.add(m);
  }
  // the long bunting swag: a string with triangular cards, parented to the board so it rises with it
  const flagMats = [
    H.printed(triPts, (P) => paintFlag(P, C.cream, C.coral, C.gold)),
    H.printed(triPts, (P) => paintFlag(P, C.coral, C.cream, C.ochre)),
    H.printed(triPts, (P) => paintFlag(P, C.gold, C.tealLight, C.cream)),
  ];
  const swagPts = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24; swagPts.push([-26 + 54 * u, 6.02 - .78 * Math.sin(PI * u), 2.18]); }
  const swagGeo = new T.BufferGeometry().setFromPoints(swagPts.map((p) => new T.Vector3(...p)));
  const swagLine = new T.Line(swagGeo, new T.LineBasicMaterial({ color: '#3a241c' }));
  board.pivot.add(swagLine);
  for (let i = 0; i < 13; i++) {
    const u = (i + .5) / 13, x = -26 + 54 * u, y = 6.02 - .78 * Math.sin(PI * u);
    const m = makeCard(triPts, { materials: flagMats[i % 3], paper: H.paper, thickness: .04, edgeWidth: .035, pxPerUnit: 40 });
    m.position.set(x, y, 2.2); m.rotation.z = (i % 2 ? -.05 : .05);
    board.pivot.add(m);
    bunting.push({ m, base: m.rotation.z, ph: i * 1.3 });
  }

  // 6c. side poles with hanging lanterns (crossed cards; the lantern shades glow and carry a warm practical)
  for (const [x, z, seed] of [[-24, -12.2, 901], [29, -12.2, 907]]) {
    const poleH = popup(polePts, paintPole, { x, z, cross: true, scale: 1.04, edge: .1 });
    const lan = crossCard(lanternPts, {
      paper: H.paper, seed, thickness: .07, edgeWidth: .07, pxPerUnit: 48, back: 'mirror',
      paint: paintLantern,
    });
    lan.position.set(0, 6.42, .04); lan.scale.setScalar(1.15);
    poleH.pivot.add(lan);
    H.glowing(lan);
    lanterns.push(lan);
    H.lamp(x, 7.1, z, .7, 14);
  }
  // a small pennant on each pole top, printed into the pole's card back; a pair of loose flags on the rail ends
  for (const [x, z, s] of [[-17.8, -6.9, 1.2], [21.8, -6.7, 1.15]]) {
    popup(P2.fromDrawing((g) => { D.rect(g, -.14, 0, .28, 3.15, .03); D.ell(g, 0, 3.22, .08, .08); D.poly(g, [[.14, 3.05], [.98, 2.84], [.14, 2.6]]); }, { w: 2.0, h: 3.3, name: 'flag pole' }),
      (P) => {
        P.gradient(sh(C.cream, .06), sh(C.creamDeep, -.06), .4); P.felt(.4);
        P.draw((g) => { g.fillStyle = C.coral; g.fillRect(-.14, 0, .28, 3.15); });
        P.layer((g) => { g.fillStyle = C.coral; g.beginPath(); g.moveTo(.14, 3.05); g.lineTo(.98, 2.84); g.lineTo(.14, 2.6); g.closePath(); g.fill(); }, C.coral, { lip: .8, shadow: .7 });
        disc(P, 0, 3.22, .08, .08, C.gold, { lip: .8, shadow: .7 });
        P.innerShade(C.coralDeep, { alpha: .3, blurPx: 5 });
      },
      { x, z, scale: s, yaw: .2, sway: .25 });
  }

  // 6d. the foreground counter (a solid wooden booth face with its printed ticket strip), blurred at the bottom edge
  const counter = platform({
    w: 52, d: 3.4, h: COUNTER_H, paper: H.paper, seed: 611,
    paints: { face: paintCounterFace, deck: paintCounterDeck, support: (P) => paintPlanks(P, C.woodDark, { n: 2, vertical: true }) },
    print: { ...H.cardOpts(2, COUNTER_Z), pxPerUnit: 28 },
  });
  counter.name = 'booth counter';
  const counterH = popup(null, null, { node: counter, height: COUNTER_H, x: 2, z: COUNTER_Z, level: true });
  // two big, blurred props standing on the counter top (they fold up with the counter)
  popup(...cupStack(), { parent: counter.userData.deck, x: -15.2, z: -.75, yaw: .08, scale: 1.55, order: counterH.order + .45 });
  popup(...popcornBox(), { parent: counter.userData.deck, x: 15.8, z: -.8, yaw: -.1, scale: 1.35, order: counterH.order + .45 });

  // 6e. the barker and a kid behind the counter: small static figures for scale (the barker is the harness's hero)
  const barker = popup(...barkerPiece(), { x: -6.6, z: 5.2, yaw: .06, scale: 1.0, sway: .05 });
  H.setHero(barker);
  popup(...kidPiece(), { x: 8.9, z: 5.35, yaw: -.08, scale: .95, sway: .08 });

  // 6f. dressing at the rail ends: crates, barrels, a bench, a popcorn cart, a prize wheel
  popup(...cartPiece(), { x: -20.8, z: -3.6, yaw: .12, scale: 1.25 });
  popup(...cratePiece(), { x: -18.2, z: -1.4, yaw: -.15, scale: 1.15 });
  popup(...cratePiece(), { x: -19.4, z: -2.4, yaw: .22, scale: .9 });
  popup(...barrelPiece(), { x: -23.2, z: -1.5, yaw: -.3, scale: 1.15 });
  popup(...benchPiece(), { x: -17.6, z: .8, yaw: -.18, scale: 1.1 });
  const wheelStandH = popup(...wheelStand(), { x: 23.4, z: -3.2, yaw: -.12, scale: 1.1 });
  {
    const [wp, paint] = [P2.fromDrawing((g) => D.ell(g, 0, 0, 1.55, 1.55), { w: 3.2, h: 3.2, name: 'wheel' }), paintWheel];
    const wheel = makeCard(wp, { ...H.cardOpts(23.4, -3.2), paint, thickness: .07, edgeWidth: .07, back: 'kraft', folds: [] });
    wheel.position.set(0, 3.34, .24); wheelStandH.pivot.add(wheel);
    H.onStep((t) => { wheel.rotation.z = -t * .18; });
    const [pp, pointerPaint] = wheelPointer();
    const pointer = makeCard(pp, { ...H.cardOpts(23.4, -3.2), paint: pointerPaint, thickness: .05, edgeWidth: .05, back: 'kraft', folds: [] });
    pointer.position.set(0, 4.88, .34); wheelStandH.pivot.add(pointer);
  }
  popup(...cratePiece(), { x: 20.2, z: -1.4, yaw: .18, scale: 1.0 });
  popup(...barrelPiece(), { x: 26.2, z: -1.2, yaw: -.2, scale: 1.05 });
  popup(...benchPiece(), { x: 20.4, z: .9, yaw: -.2, scale: 1.0 });

  // 6g. far tents at the blurred edges: this dusk fair continues past the frame
  popup(...tentPiece(), { x: -33.5, z: -21.5, yaw: -.2, scale: 1.45, res: .6, sway: .18 });
  popup(...tentPiece(), { x: 37, z: -20.5, yaw: .25, scale: 1.35, res: .6, sway: .18 });
}

buildWorld();

// ---- 7. the world's life: moths at the lanterns, drifting confetti and dust; all on the fixed clock ------------
const life = createLife({ scene: H.scene, camera: H.camera, heroHeight: H.heroHeight, seed: 73, wind: [.7, .18], box: { w: 21, d: 9, h: 3 } });
PF_LIFE.push([life.flyers({ count: Q.moths, colors: ['#f4e6c6', '#e8c47a'], size: .15, roam: .55, height: [1.15, 2.05], flap: 9, anchors: [[-24, -12.2], [29, -12.2], [2, -13.6]], day: .35, night: 1 }), 'moths']);
PF_LIFE.push([life.fallers({ count: Q.fallers, colors: [C.coral, C.gold, C.cream, C.tealLight], cut: 'confetti', size: [.045, .08], fall: [.45, .8], sway: .65, tumble: 4, land: 7, day: 1, night: 1 }), 'fallers']);
PF_LIFE.push([life.motes({ count: Q.motes, colors: ['#ffe0a4', '#f6c66a'], size: [.015, .03], speed: [.08, .22], height: [.35, 2.0], near: 5, day: .8, night: 1 }), 'motes']);
life.setNight(.55);
life.reset(H.target);
H.onStep((t, dt) => life.update(dt, H.target));
H.onRestart(() => life.reset(H.target));
// the lanterns catch the dusk with a soft, slow flicker; the bunting hangs from its string and sways a little
const LGLOW = { day: .35, golden: .55, dusk: 1.1, night: 1.4 }[flags.MOOD] ?? .35;
H.onStep((t) => {
  const k = LGLOW * (.965 + .035 * Math.sin(t * 2.3) + .012 * Math.sin(t * 7.1 + 1.3));
  for (const g of lanterns) g.traverse((o) => o.userData.setGlow?.(k));
  for (const b of bunting) b.m.rotation.z = b.base + .035 * Math.sin(t * .75 + b.ph);
});

// ---- 8. the game: the shooting gallery, score, streak, ticket clock, end card -------------------------------
const GAME = (() => {
  // 8a. target prints: one shared print per kind, stamped on the pool's cards (three at most in view per kind)
  const duck = (() => {
    const [pts, paint] = P2.drawnPiece((g, ink) => {
      g.fillStyle = ink(C.coralDeep); D.rect(g, -.62, 0, .26, .24, .05); D.rect(g, .22, 0, .26, .24, .05);
      g.fillStyle = ink('#e3ac3e'); D.ell(g, -.08, .72, .9, .52);
      g.fillStyle = ink('#c98a2f'); D.ell(g, -.3, .78, .44, .3);
      g.fillStyle = ink('#edbd50'); D.ell(g, .62, 1.25, .38, .38);
      g.fillStyle = ink(C.coral); D.poly(g, [[.94, 1.27], [1.3, 1.18], [.96, 1.08]]);
      g.fillStyle = ink(C.coral); D.ell(g, .08, .82, .16, .16);
      g.fillStyle = ink('#f7ecd2', 'print'); D.ell(g, .08, .82, .07, .07);
      g.fillStyle = ink(C.ink, 'print'); D.ell(g, .7, 1.32, .045, .05);
      g.fillStyle = ink('#fff4da', 'print'); D.ell(g, .72, 1.34, .018, .018);
    }, { w: 2.8, h: 1.8, name: 'target duck' });
    return { pts, mats: H.printed(pts, paint, { res: 1.1 }), h: P2.bbox(pts).h, w: P2.bbox(pts).w, points: 10, name: 'duck' };
  })();
  const balloon = (() => {
    const [pts, paint] = P2.drawnPiece((g, ink) => {
      g.fillStyle = ink(C.woodDark); D.rect(g, -.34, 0, .68, .13, .04);
      g.fillStyle = ink(C.wood); D.rect(g, -.055, .1, .11, .8, .03);
      g.fillStyle = ink(C.coralDeep); D.poly(g, [[-.12, .88], [.12, .88], [0, .68]]);
      g.fillStyle = ink(C.coral); D.ell(g, 0, 1.62, .68, .78);
      g.fillStyle = ink(C.coralSoft); D.ell(g, -.16, 1.77, .32, .52);
      g.fillStyle = ink(C.cream); D.ell(g, -.24, 1.85, .14, .27);
      g.fillStyle = ink(C.gold, 'print'); D.ell(g, 0, 1.52, .1, .1);
      g.fillStyle = ink(C.cream, 'print'); D.ell(g, 0, 1.52, .04, .04);
    }, { w: 1.8, h: 2.55, name: 'target balloon' });
    return { pts, mats: H.printed(pts, paint, { res: 1.1 }), h: P2.bbox(pts).h, w: P2.bbox(pts).w, points: 15, name: 'balloon' };
  })();
  const star = (() => {
    const [pts, paint] = P2.drawnPiece((g, ink) => {
      g.fillStyle = ink(C.wood); D.rect(g, -.32, 0, .64, .5, .06);
      g.fillStyle = ink(C.coral); D.poly(g, [[-.32, .46], [.32, .46], [.22, .6], [-.22, .6]]);
      g.fillStyle = ink(C.gold); D.poly(g, starPts(0, 1.3, .85, .38, 5, PI / 2));
      g.fillStyle = ink(C.cream); D.poly(g, starPts(0, 1.3, .55, .24, 5, PI / 2));
      g.fillStyle = ink(C.coral); D.ell(g, 0, 1.3, .13, .13);
      g.fillStyle = ink(C.cream, 'print'); D.ell(g, 0, 1.3, .055, .055);
    }, { w: 2.0, h: 2.2, name: 'target star' });
    return { pts, mats: H.printed(pts, paint, { res: 1.1 }), h: P2.bbox(pts).h, w: P2.bbox(pts).w, points: 25, name: 'star' };
  })();

  // 8b. seeded round state
  let seed = +(QP.get('seed') || 0) || 1 + Math.floor(Math.random() * 999);
  let waveRnd = P2.rng(seed * 7919 + 17);
  let fxRnd = P2.rng(seed * 7919 + 31);
  let gameTime = 0, roundStart = 0, score = 0, streak = 0, maxStreak = 0, lastShot = -1;
  let started = false, done = false, waveTimer = 1.5, starterDone = false;
  let best = 0; try { best = +(localStorage.getItem('pf-best') || 0) || 0; } catch (e) { best = 0; }

  // 8c. the spots: eleven free places along the rail; never closer than 1.6 units
  const spots = Array.from({ length: 11 }, (_, i) => ({ x: 2 + (i - 5) * 3.2, z: RAIL_Z, t: null }));
  const centerSpot = spots[5];
  const pool = [];
  let nextId = 0;
  for (const kind of ['duck', 'duck', 'duck', 'duck', 'duck', 'balloon', 'balloon', 'balloon', 'balloon', 'star', 'star', 'star', 'star', 'star', 'duck']) {
    const k = kind === 'duck' ? duck : kind === 'balloon' ? balloon : star;
    const mesh = makeCard(k.pts, { materials: k.mats, paper: H.paper, thickness: .08, edgeWidth: .08, pxPerUnit: 44 });
    const h = hinge(mesh, { at: new T.Vector3(0, RAIL_TOP, RAIL_Z), yaw: 0, open: 0, size: .32, rest: (nextId % 3 - 1) * .018 });
    const t = { id: nextId++, kind, k, mesh, h, group: h.group, x: 0, z: RAIL_Z, scale: 1, standing: false, starter: false, hit: false,
      roseAt: 0, foldAt: 0, freeAt: -1, spot: null };
    h.group.visible = false;
    h.onStart = () => H.sound?.flap({ size: .22, up: h.open > .5, key: 'target' + t.id, seed: 1200 + t.id });
    scene.add(h.group);
    pool.push(t);
  }

  // 8d. the reticle: an inked dashed ring with a small cross, printed flat on the ground
  const ring = (() => {
    const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'); g.translate(s / 2, s / 2);
    g.strokeStyle = '#40271f'; g.lineCap = 'round';
    const wob = P2.rng(91);
    for (let i = 0; i < 9; i++) {
      const a0 = i / 9 * TAU + .07, a1 = (i + 1) / 9 * TAU - .07;
      g.lineWidth = 7.2 + wob() * 1.4;
      for (let q = 0; q < 3; q++) {
        const b0 = a0 + (a1 - a0) * q / 3, b1 = a0 + (a1 - a0) * (q + 1) / 3, r = 86 * (1 + (wob() - .5) * .03);
        g.beginPath(); g.arc(0, 0, r, b0, b1); g.stroke();
      }
    }
    g.lineWidth = 5.6;
    g.beginPath(); g.moveTo(-19, 0); g.lineTo(-6, 0); g.moveTo(6, 0); g.lineTo(19, 0); g.moveTo(0, -19); g.lineTo(0, -6); g.moveTo(0, 6); g.lineTo(0, 19); g.stroke();
    g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fillStyle = '#40271f'; g.fill();
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(new T.PlaneGeometry(2.4, 2.4), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -PI / 2; m.position.y = .045; m.renderOrder = 3; m.visible = false;
    scene.add(m); return m;
  })();
  let retTarget = 0, lastX = 0, lastZ = 0;

  // 8e. pellets, confetti and miss marks (all removed on the step clock)
  const pelletGeo = new T.IcosahedronGeometry(.105, 0);
  const pelletMat = paperMaterial({ color: '#f3e5c6' }); pelletMat.flatShading = true;
  const pellets = [];
  const confettiTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    const g = c.getContext('2d'); g.fillStyle = '#f8eed8'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#c85a44'; g.fillRect(0, 10, 64, 6);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; return tex;
  })();
  const confettiGeo = new T.PlaneGeometry(.16, .085);
  const confetti = [];
  const markTex = (() => {
    const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'), r = P2.rng(177);
    g.translate(s / 2, s / 2);
    g.fillStyle = 'rgba(74,42,26,0.55)';
    for (let i = 0; i < 9; i++) { const a = r() * TAU, d = 10 + r() * 24; g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, 8 + r() * 10, 5 + r() * 8, a, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(240,225,190,0.5)';
    for (let i = 0; i < 5; i++) { const a = r() * TAU, d = 6 + r() * 18; g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, 4 + r() * 6, 3 + r() * 4, a, 0, TAU); g.fill(); }
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; return tex;
  })();
  const marks = [];
  const markGeo = new T.PlaneGeometry(.62, .62);
  const _v = new T.Vector3();

  const cv = () => document.querySelector('canvas');
  const rectOf = () => cv().getBoundingClientRect();
  const cssToNdc = (x, y) => { const r = rectOf(); return { x: (x - r.left) / r.width * 2 - 1, y: -(y - r.top) / r.height * 2 + 1 }; };
  const project = (x, y, z) => { const r = rectOf(); _v.set(x, y, z).project(camera); return [r.left + (_v.x + 1) / 2 * r.width, r.top + (1 - _v.y) / 2 * r.height]; };
  const targetCenter = (t) => [t.x, RAIL_TOP + .04 + t.k.h * t.scale * .5, t.z];
  const targetScreen = (t) => {
    camera.updateMatrixWorld();
    const [cx, cy, cz] = targetCenter(t);
    const hw = t.k.w * t.scale * .5;
    const p = project(cx, cy, cz), b = project(cx, RAIL_TOP + .04, cz), u = project(cx, RAIL_TOP + .04 + t.k.h * t.scale, cz);
    const l = project(cx - hw, cy, cz), r = project(cx + hw, cy, cz);
    return { screen: p, radius: Math.max(18, Math.max(Math.abs(u[1] - b[1]), Math.abs(r[0] - l[0])) * .62) };
  };
  function findTargetAt(cssX, cssY) {
    camera.updateMatrixWorld();
    let best = null, bd = 1e9;
    for (const t of pool) {
      if (!t.standing) continue;
      const s = targetScreen(t), d = Math.hypot(cssX - s.screen[0], cssY - s.screen[1]);
      if (d < s.radius && d < bd) { best = t; bd = d; }
    }
    return best;
  }
  const anyStanding = () => pool.some((t) => t.standing);

  // 8f. the HUD: a fairground scorecard and a ticket that shortens; ink tallies for the streak
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), streakEl = $('streak'), tearsEl = $('tears'), ticketEl = $('ticket');
  const segs = [];
  if (tearsEl) for (let i = 0; i < 12; i++) {
    const s = document.createElement('div'); s.className = 'seg'; s.dataset.n = String(12 - i); tearsEl.appendChild(s); segs.push(s);
  }
  let shownScore = -1, shownStreak = -1, shownBest = -1, shownKeep = -1;
  function updateHud() {
    if (scoreEl && score !== shownScore) { scoreEl.textContent = String(score); shownScore = score; }
    if (bestEl && best !== shownBest) { bestEl.textContent = String(best); shownBest = best; }
    if (streakEl && streak !== shownStreak) {
      shownStreak = streak; streakEl.innerHTML = '';
      const n = Math.min(streak, 10);
      for (let i = 0; i < n; i++) streakEl.appendChild(document.createElement('i'));
      if (streak > 10) { const e = document.createElement('em'); e.textContent = '×' + streak; streakEl.appendChild(e); }
    }
    const tl = timeLeft();
    const keep = done ? 0 : Math.max(0, Math.min(12, Math.ceil(tl / 5)));
    if (keep !== shownKeep) {
      shownKeep = keep;
      segs.forEach((s, i) => s.classList.toggle('torn', i >= keep));
      if (ticketEl) ticketEl.style.opacity = done ? '.72' : '1';
    }
  }
  const toastBox = $('toast'); let toastTimer = null;
  function toast(msg) { if (!toastBox) return; toastBox.textContent = msg; toastBox.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastBox.classList.remove('show'), 4600); }

  // a quiet two-partial paper chime; the dull thump for a miss
  function chime(kind) {
    const ctx = H.sound?.ctx; if (!ctx) return;
    const base = kind === 'star' ? 988 : kind === 'balloon' ? 784 : 659;
    const t0 = ctx.currentTime + .012;
    for (const [mult, gain] of [[1, .045], [1.5, .022]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = base * mult;
      g.gain.setValueAtTime(.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + .012);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + .22);
      o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + .24);
    }
  }
  function thump() {
    const ctx = H.sound?.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + .01, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(92, t0 + .13);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.028, t0 + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + .16);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + .18);
  }

  function timeLeft() { return done ? 0 : started ? Math.max(0, 60 - (gameTime - roundStart)) : 60; }

  // 8g. targets: rise, fold by themselves after 3.5 s, fold at once when hit
  function spawn(t, spot, scale, starter = false) {
    if (!spot || spot.t) return false;
    spot.t = t; t.spot = spot; t.x = spot.x; t.z = spot.z; t.scale = scale; t.standing = true;
    t.starter = !!starter; t.hit = false; t.roseAt = gameTime; t.foldAt = 0; t.freeAt = Infinity;
    t.group.position.set(t.x, RAIL_TOP + .04, t.z);
    t.group.rotation.y = ((t.id * .73) % 1 - .5) * .14;
    t.mesh.scale.setScalar(scale);
    t.group.visible = true;
    t.h.reset(0); t.h.set(1, .025);
    return true;
  }
  function freeTarget(kind) {
    const free = pool.filter((t) => !t.standing && t.freeAt <= gameTime && (kind ? t.kind === kind : true));
    return free.length ? free[Math.floor(waveRnd() * free.length)] : null;
  }
  function spawnStarter() {
    const t = freeTarget('duck'); if (!t) return false;
    return spawn(t, centerSpot, 1.2, true);
  }
  function spawnWave(n) {
    const freeSpots = spots.filter((s) => !s.t);
    for (let i = freeSpots.length - 1; i > 0; i--) { const j = Math.floor(waveRnd() * (i + 1)); [freeSpots[i], freeSpots[j]] = [freeSpots[j], freeSpots[i]]; }
    let made = 0;
    for (const s of freeSpots) {
      if (made >= n) break;
      const r = waveRnd(), kind = r < .48 ? 'duck' : r < .8 ? 'balloon' : 'star';
      const t = freeTarget(kind) || freeTarget(null); if (!t) continue;
      if (spawn(t, s, .92 + waveRnd() * .16, false)) made++;
    }
    return made;
  }
  function fold(t, hit) {
    if (!t.standing) return;
    t.standing = false; t.hit = !!hit; t.freeAt = gameTime + .68; t.foldAt = gameTime;
    if (t.spot) { t.spot.t = null; t.spot = null; }
    t.h.set(0);
  }
  function spawnConfetti(x, y, z) {
    const colors = [C.coral, C.gold, C.cream, C.tealLight, C.coralSoft];
    const n = 8 + Math.floor(fxRnd() * 5);
    for (let i = 0; i < n; i++) {
      const mat = new T.MeshBasicMaterial({ map: confettiTex, color: colors[Math.floor(fxRnd() * colors.length)], transparent: true, side: T.DoubleSide, depthWrite: false });
      const m = new T.Mesh(confettiGeo, mat);
      m.position.set(x + (fxRnd() - .5) * .4, y + (fxRnd() - .5) * .3, z + (fxRnd() - .5) * .2);
      const a = fxRnd() * TAU, s = 1.2 + fxRnd() * 2.1;
      confetti.push({ m, vx: Math.cos(a) * s, vy: 1.8 + fxRnd() * 1.6, vz: Math.sin(a) * s + .3, rx: (fxRnd() - .5) * 14, ry: (fxRnd() - .5) * 14, t: 0, life: 1.05 + fxRnd() * .25, mat });
      scene.add(m);
    }
  }
  function spawnMark(x, z) {
    const mat = new T.MeshBasicMaterial({ map: markTex, transparent: true, opacity: .9, depthWrite: false, side: T.DoubleSide });
    const m = new T.Mesh(markGeo, mat);
    m.rotation.x = -PI / 2; m.rotation.z = fxRnd() * TAU;
    m.position.set(x, .042, z); m.renderOrder = 2;
    scene.add(m); marks.push({ m, mat, t: 0, life: 1.5 });
  }
  function hit(t) {
    const [x, y, z] = targetCenter(t);
    streak++; maxStreak = Math.max(maxStreak, streak);
    const mult = 1 + Math.min(streak - 1, 6) * .25;
    score += Math.round(t.k.points * mult);
    fold(t, true);
    spawnConfetti(x, y, z);
    chime(t.kind);
    updateHud();
  }
  function miss(px, py) {
    spawnMark(px, py);
    if (anyStanding()) streak = 0;
    thump();
    updateHud();
  }

  // 8h. firing: one path for a real pointerdown and for the test hook
  function fireAtPx(cssX, cssY) {
    if (done) return false;
    if (gameTime - lastShot < .1) return false;
    lastShot = gameTime;
    if (!started) { started = true; roundStart = gameTime; updateHud(); }
    const ndc = cssToNdc(cssX, cssY);
    let gp = H.groundAt(ndc.x, ndc.y);
    if (!gp) gp = new T.Vector3(2, 0, -8);
    const gy = Math.max(-13.1, Math.min(5.8, gp.z));
    const ground = new T.Vector3(gp.x, .06, gy);
    const target = findTargetAt(cssX, cssY);
    const to = target ? new T.Vector3(...targetCenter(target)) : ground;
    const m = new T.Mesh(pelletGeo, pelletMat);
    m.position.copy(LAUNCH); m.castShadow = true; m.receiveShadow = false;
    scene.add(m);
    pellets.push({ m, from: LAUNCH.clone(), to, t: 0, dur: .27, spin: (fxRnd() - .5) * 20, ground, ndc, target });
    retTarget = 1; ring.position.set(gp.x, .045, gp.z); ring.rotation.z = Math.abs(Math.sin(gp.x * 12.9898 + gp.z * 78.233) * 43758.5453) % 1 * TAU;
    updateHud();
    return true;
  }
  function resolvePellet(p) {
    const r = rectOf();
    const sx = r.left + (p.ndc.x + 1) / 2 * r.width, sy = r.top + (1 - p.ndc.y) / 2 * r.height;
    const t = findTargetAt(sx, sy);
    if (t) hit(t); else miss(p.ground.x, p.ground.z);
    scene.remove(p.m);
  }

  // 8i. the round ending and the paper end card
  function prizeLine() {
    if (score >= 320) return 'you won the big teddy, a gold star and a paper whistle.';
    if (score >= 180) return 'you won a gold star and a paper whistle.';
    if (score >= 80) return 'you won a paper whistle and a ticket stub.';
    return 'a paper ticket stub — better luck next time.';
  }
  function endRound() {
    if (done) return;
    done = true;
    for (const t of pool) if (t.standing) fold(t, false);
    for (const p of pellets) scene.remove(p.m);
    pellets.length = 0;
    retTarget = 0;
    best = Math.max(best, score);
    try { localStorage.setItem('pf-best', String(best)); } catch (e) { /* a private page may refuse */ }
    updateHud();
    const card = $('endcard');
    if (card) {
      $('final-score').textContent = String(score);
      $('final-best').textContent = String(best);
      $('final-streak').textContent = String(maxStreak);
      $('final-prizes').textContent = prizeLine();
      card.classList.remove('hidden');
    }
    chime('star');
  }
  function resetRound() {
    score = 0; streak = 0; maxStreak = 0; started = false; done = false;
    gameTime = 0; roundStart = 0; lastShot = -1; waveTimer = 1.5; starterDone = false;
    waveRnd = P2.rng(seed * 7919 + 17);
    fxRnd = P2.rng(seed * 7919 + 31);
    for (const s of spots) s.t = null;
    for (const t of pool) { t.standing = false; t.starter = false; t.hit = false; t.spot = null; t.freeAt = -1; t.group.visible = false; t.h.reset(0); }
    for (const p of pellets) scene.remove(p.m); pellets.length = 0;
    for (const c of confetti) { scene.remove(c.m); c.mat.dispose(); } confetti.length = 0;
    for (const m of marks) { scene.remove(m.m); m.mat.dispose(); } marks.length = 0;
    retTarget = 0; ring.visible = false;
    const card = $('endcard'); if (card) card.classList.add('hidden');
    updateHud();
  }
  function newRound() {
    seed = 1 + ((seed * 7919 + 13) % 997);
    resetRound();
    H.sound?.flap({ size: .75, up: true, key: 'new-round' });
    try {
      const u = new URL(location.href); u.searchParams.set('seed', String(seed));
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) { /* file:// may refuse */ }
    toast('a fresh strip of tickets');
  }
  const again = $('again'); if (again) again.addEventListener('click', newRound);

  // 8j. the clock: waves, target life, pellets, confetti, marks and the HUD all run on the harness's fixed step
  H.onStep((time, dt) => {
    gameTime += dt;
    for (const t of pool) t.h.update(dt);   // targets are not in H.hinges: their springs run here, on the same clock
    if (started && !done && gameTime - roundStart >= 60) endRound();
    if (!done) {
      waveTimer -= dt;
      if (waveTimer <= 0) {
        if (!starterDone) { starterDone = true; spawnStarter(); waveTimer = 1.9; }
        else { const n = 1 + (waveRnd() < .55 ? 1 : 0) + (waveRnd() < .2 ? 1 : 0); spawnWave(n); waveTimer = 1.6 + waveRnd() * .8; }
      }
    }
    for (const t of pool) {
      if (!t.standing) {
        if (t.group.visible && gameTime - t.foldAt > .72) t.group.visible = false;
        continue;
      }
      if (gameTime - t.roseAt > 3.5) fold(t, false);
    }
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i]; p.t += dt;
      const u = Math.min(1, p.t / p.dur), e = u * u * (3 - 2 * u);
      p.m.position.lerpVectors(p.from, p.to, e);
      p.m.position.y += Math.sin(PI * u) * .95;
      p.m.rotation.set(p.t * p.spin, p.t * p.spin * 1.3, p.t * p.spin * .7);
      if (u >= 1) { resolvePellet(p); pellets.splice(i, 1); }
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i]; c.t += dt;
      c.vy -= 8.5 * dt;
      c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt;
      c.m.position.y = Math.max(.05, c.m.position.y);
      c.m.rotation.x += c.rx * dt; c.m.rotation.y += c.ry * dt;
      const k = Math.min(1, (c.life - c.t) / .32);
      c.mat.opacity = Math.max(0, Math.min(1, k));
      if (c.t >= c.life) { scene.remove(c.m); c.mat.dispose(); confetti.splice(i, 1); }
    }
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i]; m.t += dt;
      m.mat.opacity = .9 * Math.max(0, Math.min(1, (m.life - m.t) / .45));
      if (m.t >= m.life) { scene.remove(m.m); m.mat.dispose(); marks.splice(i, 1); }
    }
    // reticle: fade in under the pointer, and out when it leaves the canvas; re-project each step because the
    // harness's calm camera drift would otherwise slide the printed ring off the pointer
    if (pointer.inside && !done) {
      const ndc = cssToNdc(pointer.x, pointer.y), gp = H.groundAt(ndc.x, ndc.y);
      if (gp) ring.position.set(gp.x, .045, gp.z);
    }
    const want = retTarget;
    ring.material.opacity += (want * .92 - ring.material.opacity) * Math.min(1, dt * 11);
    ring.visible = ring.material.opacity > .02;
    updateHud();
  });
  H.onRestart(resetRound);

  // 8k. pointer input: the reticle follows the pointer's ground point; a click fires; the harness's fold-on-click is
  // stopped at the canvas so the crosshair stays under the pointer and a shot never folds the world
  const pointer = { x: 0, y: 0, inside: false };
  function showReticle(cssX, cssY) {
    const ndc = cssToNdc(cssX, cssY), gp = H.groundAt(ndc.x, ndc.y);
    if (!gp) { retTarget = 0; return; }
    if (Math.hypot(gp.x - lastX, gp.z - lastZ) > .35) {
      lastX = gp.x; lastZ = gp.z;
      ring.rotation.z = (Math.abs(Math.sin(gp.x * 12.9898 + gp.z * 78.233) * 43758.5453) % 1) * TAU;
    }
    ring.position.set(gp.x, .045, gp.z); retTarget = done ? 0 : 1;
  }
  addEventListener('pointermove', (e) => {
    if (e.target !== cv()) { retTarget = 0; return; }
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
    showReticle(e.clientX, e.clientY);
  }, { passive: true });
  cv().addEventListener('pointerleave', () => { pointer.inside = false; retTarget = 0; });
  addEventListener('blur', () => { retTarget = 0; });
  addEventListener('pointerdown', (e) => {
    if (e.target !== cv()) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopImmediatePropagation();   // the harness may not start a drag or fold the page under a shot
    e.preventDefault();
    H.sound?.unlock();
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
    showReticle(e.clientX, e.clientY);
    fireAtPx(e.clientX, e.clientY);
  }, { capture: true });

  resetRound();
  return {
    ver: 1,
    get seed() { return seed; },
    state: () => ({ score, best, streak, timeLeft: +timeLeft().toFixed(2), done, running: started && !done }),
    targets: () => {
      camera.updateMatrixWorld();
      return pool.map((t) => {
        const s = targetScreen(t);
        return { id: t.id, kind: t.kind, x: +t.x.toFixed(2), z: +t.z.toFixed(2), standing: t.standing, starter: t.starter,
          screen: [Math.round(s.screen[0]), Math.round(s.screen[1])], hit: t.hit };
      });
    },
    probe: () => {
      const r = rectOf();
      return { canvas: [r.left, r.top, r.width, r.height], standing: pool.filter((t) => t.standing).length,
        targets: pool.filter((t) => t.standing).map((t) => { const s = targetScreen(t); return { id: t.id, kind: t.kind, screen: s.screen.map(Math.round), radius: +s.radius.toFixed(1) }; }) };
    },
    shootAt: (cssX, cssY) => {
      pointer.x = cssX; pointer.y = cssY;
      showReticle(cssX, cssY);
      return fireAtPx(cssX, cssY);
    },
    newRound, toast,
  };
})();
window.__paperfair = GAME;
window.__pfh = H;

const __loading = document.getElementById('loading');   // the fair is printed (one synchronous build): lift the note
if (__loading) __loading.remove();

H.start();

// ---- 9. live tier safety net (no reloads, nothing persisted): a light rAF monitor, once only ----------------------
(() => {
  if (flags.TEST || !H.setQuality || QP.has('tier') || TIER === 'low') return;
  const next = TIER === 'high' ? 'med' : 'low', SETTLE = 3000, WATCH = 4000, FLOOR = 38;
  let n = 0, tA = null, done = false;
  requestAnimationFrame(function sample(t) {
    if (done) return;
    if (tA === null) { tA = t; requestAnimationFrame(sample); return; }
    const dt = t - tA;
    if (dt < SETTLE) { requestAnimationFrame(sample); return; }
    n++;
    if (dt < SETTLE + WATCH) { requestAnimationFrame(sample); return; }
    if (n >= 10 && n / ((dt - SETTLE) / 1000) < FLOOR) {
      done = true;
      if (!TIERS[next]) return;
      H.setQuality(TIERS[next]);
      for (const [k, key] of PF_LIFE) { const f = TIERS[next][key] / TIERS[TIER][key]; k.day = (k.day ?? 1) * f; k.night = (k.night ?? 1) * f; }
      GAME.toast('a lighter print, for a smoother page');
      return;
    }
    n = 0; tA = t - SETTLE;
    requestAnimationFrame(sample);
  });
})();
