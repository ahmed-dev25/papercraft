// papercraft / games / paperfair — a pop-up carnival shooting gallery in the kit's papercraft style.
//
// BRIEF      a dusk fairground shooting gallery, fixed 16:9 diorama, calm and warm; everything folds up from the page.
// SUBJECT    a long target rail of tin cans, bottles, pie tins, balloons and prize stars in front of a prize backboard,
//            behind a blurred wooden counter; a paper pop-gun in the near foreground follows the pointer. The eye lands
//            on the rail (sharp band) and follows the torn sawdust lane up from the counter.
// STOCK      cardstock for every printed card, kraft backs, tissue for the lantern shades, corrugated for crates.
// PALETTE    ground #b7a88b (sawdust) · ground shadow #2e5a62 / #1f414c (deep teal) · lane #e7d5ae ·
//            cream #f1e1bd · ochre #d99f45 · lead coral #cf4f3e / deep #9d3732 · gold #f0bd5a · ink #33211d ·
//            cool accent #4f7d7c · haze #8a7489 · shadow tint #1d2e4c. All derived for this dusk fair.
// LIGHT      kit dusk mood: key #ffb38a from the left (dir -0.866,0.45,0.5) ~27 deg up, violet fill #6f63a8,
//            leak #3a4460, warm paper lanterns #ffb070. No coloured fog; shadows are blue-violet.
// LENS       fov 26, pitch 47, target [2,1.5,-6], focus on the rail: sharp band across the targets, blurred counter
//            and far tents, 18 px maximum blur at 1080p; printed ground past every frame edge.
// LAYOUT     counter z +10 · lane z +7..-8.6 · target rail z -10.4 (deck -9.4..-12.8, raised to 1.5) ·
//            prize backboard z -14.4 · poles x -24 / 29 · far tents x -34 / 37 · the pop-gun at the near edge.
//            16:9 authored.
// MOTION     score-line hinges: targets rise with overshoot and fold flat with the kit's slap; bunting and flags
//            sway; lanterns flicker subtly; confetti and moths on the fixed clock. The pop-gun follows the aim with a
//            damped turn and a short recoil. No camera shake, no scale tricks.
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

// ---- 0m. phones: ONE detection for the page — a coarse pointer (a finger) or a viewport with a short side under 620
// CSS px — plus the portrait flag taken once at load. Portrait is the real experience: the harness's own vertical frame
// (no letterbox), a slightly closer portrait camera, a portrait rail whose spot pool is screen-checked against the
// canvas safe band, targets sized for a fingertip, and a thumb-sized HUD. Every branch is gated on MOBILE, so a desktop
// mouse in a wide window keeps the authored camera, gun, target scales, HUD and click-to-shoot exactly.
const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 620;
const PORTRAIT = innerHeight >= innerWidth;
// portrait-only cabinet: three depth rows on a tall booth, a sliding can, a faster wave clock and the golden flurry.
// Landscape phones and every desktop keep the authored wide rail and kind-based scoring.
const PGP = MOBILE && PORTRAIT;
// 60 units: the harness's 9:16 lens sees the cabinet's two side posts at 390 px with a margin (at 56 the outer post
// edge clips), while the near row still prints ~48-50 CSS px of tap circle. See GAME.mobile() for the live readout.
const MOBILE_DIST = 60;
if (MOBILE) {
  document.documentElement.classList.add('pf-mobile');
  // phones never zoom the page chrome under a double tap or a pinch; desktop zoom is untouched by this branch
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  // the how-to card speaks the phone's verb; the desktop keeps its authored "click to shoot" line
  const helpShoot = document.getElementById('help-shoot');
  if (helpShoot) helpShoot.textContent = 'tap to shoot the pop-gun';
}

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
  view: { pitch: 47, dist: MOBILE && PORTRAIT ? MOBILE_DIST : 66, target: [2, 1.5, -6], ...(PGP ? { subjectY: -.05 } : {}) }, focus: [2, 2.1, -10.4], subject: [2, -8],
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
const RAIL_FRONT = -9.4, RAIL_Z = -10.45, DECK_Z = -9.4, DECK_D = 3.4, RAIL_H = 1.5, RAIL_TOP = RAIL_H + .07;
const BOARD_Z = -14.4, COUNTER_Z = 10.0, COUNTER_H = 2.8;

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
    g.fillStyle = ink(C.coral); D.poly(g, [[-.3, .46], [.3, .46], [.22, .78], [-.22, .78]]);
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
function paintWheel(P, cy0 = 0) {
  P.fill(C.cream); P.felt(.5);
  const n = 10, r = Math.min(P.box.w, P.box.h) / 2 - .04, cx = 0, cy = cy0;
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
  disc(P, 0, cy, .12 * P.U, .12 * P.U, C.ink, { lip: .3, shadow: .4, depth: .5 });
  disc(P, -.02 * P.U, cy + .02 * P.U, .055 * P.U, .055 * P.U, C.gold, { lip: .4, shadow: .4, depth: .4 });
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
    w: 38, d: DECK_D, h: RAIL_H, paper: H.paper, seed: 511,
    facePts: postsFace(38, RAIL_H, 10), supportPts: postsFace(35, RAIL_H, 8).map(([x, y]) => [x, y - RAIL_H]),
    paints: { face: paintRailFace, deck: paintRailDeck, support: (P) => paintPlanks(P, C.woodDark, { n: 2, vertical: true }) },
    print: H.cardOpts(2, DECK_Z),
  });
  rail.name = 'target rail';
  const railH = popup(null, null, { node: rail, height: RAIL_H, x: 2, z: RAIL_FRONT, level: true });
  H.spots.rail = [2, RAIL_Z];
  const endPostPts = P2.fromDrawing((g) => {
    D.rect(g, -.22, 0, .44, 1.15, .05);
    D.rect(g, -.32, 1.12, .64, .14, .04);
    D.ell(g, 0, 1.36, .18, .18);
  }, { w: .8, h: 1.55, name: 'end post' });
  for (const dx of [-18.3, 18.3]) {
    popup(endPostPts, paintEndPost, { parent: rail.userData.deck, x: dx, z: -.55, yaw: 0, scale: 1, order: railH.order + .55 });
  }

  // 6b. the prize backboard, its shelf and prizes, and the bunting strung across the booth. On a phone the whole
  // backboard is printed deeper (behind the tall cabinet's side posts) so the portrait rows have room to step back.
  const BZ = PGP ? -18.6 : BOARD_Z;
  const board = popup(boardOutline(34, 6.1), paintBoard, { x: 2, z: BZ, yaw: 0, edge: .09, scale: 1 });
  H.glowing(board.group);
  const cardOpt = () => H.cardOpts(2, BZ, 1, null, 1);
  const shelfTop = makeCard([[-14.4, 0], [14.4, 0], [14.4, .86], [-14.4, .86]], {
    ...cardOpt(), paint: paintShelf, thickness: .07, edgeWidth: .07, back: 'kraft', folds: [],
  });
  shelfTop.rotation.x = -PI / 2; shelfTop.position.set(0, 2.42, .96); board.pivot.add(shelfTop);
  const shel = makeCard([[-14.4, 0], [14.4, 0], [14.4, .07], [13.4, .12], [-13.4, .12], [-14.4, .07]], {
    ...cardOpt(), paint: paintShelfEdge, thickness: .07, edgeWidth: .07, back: 'kraft',
  });
  shel.position.set(0, 2.42, .99); board.pivot.add(shel);
  const prizeDefs = [[-12.1, 'jar'], [-7.3, 'teddy'], [-2.2, 'star'], [2.8, 'horn'], [8.2, 'crown'], [12.55, 'jar']];
  const prizePieces = { jar: prizeJar, teddy: prizeTeddy, star: prizeStar, horn: prizeHorn, crown: prizeCrown };
  const prizeMeshes = [];
  for (const [px, kind] of prizeDefs) {
    const [pts, paint] = prizePieces[kind]();
    const m = makeCard(pts, { ...cardOpt(), paint, thickness: .07, edgeWidth: .07, back: 'kraft' });
    // z .82 stands the prize INSIDE the shelf top (which spans local z .53..1.39), not behind its back edge,
    // and y 2.49 rests the cut base on the shelf: no prize pokes through the board face or floats over the gap
    m.position.set(px, 2.49, .82); m.rotation.y = (rnd() - .5) * .05;
    board.pivot.add(m); prizeMeshes.push(m);
  }
  // while the backboard is still folded flat, the horizontal shelf and the standing prizes would sweep through the
  // printed page; they only appear once the board is past halfway up (a beat nobody can see at the far focus)
  const setShelfVisible = (v) => { shelfTop.visible = shel.visible = v; for (const m of prizeMeshes) m.visible = v; };
  setShelfVisible(false);   // the folded board starts the first beat under the page
  H.onStep(() => setShelfVisible(board.p > .45));
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
    // a full prize wheel, mounted on a pivot at its own centre so it spins in place (the old card was a half-disc
    // traced from a circle centred on the card base, and it swung around that base instead of turning)
    const [wp, paint] = [P2.fromDrawing((g) => D.ell(g, 0, 1.6, 1.55, 1.55), { w: 3.2, h: 3.3, name: 'wheel' }), (P) => paintWheel(P, 1.6)];
    const wheel = makeCard(wp, { ...H.cardOpts(23.4, -3.2), paint, thickness: .07, edgeWidth: .07, back: 'kraft', folds: [] });
    const wheelPivot = new T.Group(); wheelPivot.position.set(0, 3.34, .24); wheelStandH.pivot.add(wheelPivot);
    wheel.position.set(0, -1.6, 0); wheelPivot.add(wheel);
    H.onStep((t) => { wheelPivot.rotation.z = -t * .18; });
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

  if (PGP) buildPortraitBooth();
}

// 6g-b. the portrait cabinet. In a 390 px vertical frame the wide rail is a thin strip, so the phone gets a tall booth:
// two cream side posts and a striped top beam frame the view, and two shelves carry a middle and a far row of targets
// over the near row on the deck. The targets themselves are placed by GAME (three rows, see its 8c); this is the paper
// that makes the depth ladder read as one cabinet. Desktop and phone-landscape never build it.
function buildPortraitBooth() {
  const PX = 2, HW = 9.05, PZ = -17.2;
  for (const side of [-1, 1]) {
    popup(polePts, paintPole, { x: PX + side * 8.0, z: PZ, cross: true, scale: 1.45, edge: .1, effects: 1 });
  }
  const shelf = (y, z0, depth) => {
    const card = makeCard([[-HW, 0], [HW, 0], [HW, depth], [-HW, depth]], {
      ...H.cardOpts(PX, z0, 1, null, 1), paint: paintShelf, thickness: .08, edgeWidth: .08, back: 'kraft', folds: [],
    });
    card.rotation.x = -PI / 2; card.position.set(PX, y, z0); scene.add(card); return card;
  };
  shelf(3.92, -10.60, 2.15);   // the middle row's plank, its top at the row base (4.00)
  shelf(6.32, -12.50, 1.95);   // the far row's plank, one step higher and deeper
  const beamPts = [[-HW - .35, 0], [HW + .35, 0], [HW + .12, 1.12], [-HW - .12, 1.12]];
  const beam = makeCard(beamPts, {
    ...H.cardOpts(PX, PZ, 1, null, 1), thickness: .08, edgeWidth: .08, back: 'kraft', folds: [],
    paint: (P) => paintStripes(P, C.cream, C.coral, C.gold, { n: 11, vertical: true, scallop: true, medal: false }),
  });
  beam.position.set(PX, 12.35, PZ); scene.add(beam);
}

buildWorld();

// ---- 6h. the paper pop-gun: a six-card toy held in the blurred near band, bottom-right ---------------------------
// It is placed in CAMERA space (grip just off the bottom-right corner at 13 units depth), so it always sits in the
// same corner of the frame whatever the letterbox; its world size follows the lens, so it reads the same at 16:9.
// The rig is non-pickable and never part of hit tests: raycast is disabled on every mesh.
const GUN = (() => {
  const CARD = { paper: H.paper, thickness: .06, edgeWidth: .06, pxPerUnit: 34, effects: 1, back: 'kraft' };
  const rig = new T.Group();          // camera-space pose
  rig.name = 'paperfair-pop-gun';
  const aim = new T.Group();          // yaw/pitch + recoil on top of it
  rig.add(aim); scene.add(rig);
  const add = (pts, paint, z, order = 0) => {
    const m = makeCard(pts, { ...CARD, seed: 4300 + order, paint });
    m.position.z = z;
    m.castShadow = false; m.receiveShadow = false;
    m.traverse((o) => { if (o.isMesh) o.raycast = () => {}; });
    aim.add(m);
    return m;
  };

  // barrel: cream cardstock, an ochre strip, a coral painted band, ink rivets; the cork sits on the muzzle
  const barrelPts = [[-.065, -.313], [.065, .313], [-2.349, .745], [-2.451, .255]];
  const ang = Math.atan2(.50, -2.4), CA = Math.cos(ang), SA = Math.sin(ang);
  add(barrelPts, (P) => {
    P.gradient(sh(C.cream, .08), sh(C.creamDeep, -.1), .4); P.felt(.5);
    P.layer((g) => {
      g.save(); g.rotate(ang); g.fillStyle = C.ochre; g.fillRect(.12, .1, 2.1, .18); g.restore();
    }, C.ochre, { lip: .6, shadow: .5, depth: .8 });
    P.layer((g) => {   // the red painted band, a separate glued strip
      g.save(); g.rotate(ang); g.fillStyle = C.coral; g.fillRect(1.5, -.25, .28, .5); g.restore();
    }, C.coral, { lip: .85, shadow: .7, depth: 1.1 });
    P.draw((g) => {
      g.save(); g.rotate(ang);
      g.strokeStyle = rgba(C.ink, .7); g.lineWidth = .04;
      g.beginPath(); g.moveTo(.18, -.275); g.lineTo(2.26, -.215); g.moveTo(.2, .275); g.lineTo(2.24, .215); g.stroke();
      g.fillStyle = rgba(C.ink, .55);
      for (let x = .46; x < 2.2; x += .42) { g.beginPath(); g.arc(x, -.21, .033, 0, TAU); g.fill(); }
      g.restore();
    });
    P.innerShade(sh(C.ochreDeep, -.25), { alpha: .24, blurPx: 5 });
  }, .16, 1);

  // muzzle collar: a small ochre band card slipped over the barrel tip
  const collar = add([[-.075, -.25], [.075, -.25], [.075, .25], [-.075, .25]], (P) => {
    P.fill(C.ochre); P.felt(.4);
    P.draw((g) => {
      g.strokeStyle = rgba(C.ink, .6); g.lineWidth = .03;
      g.beginPath(); g.moveTo(-.075, -.25); g.lineTo(-.075, .25); g.moveTo(.075, -.25); g.lineTo(.075, .25); g.stroke();
      g.fillStyle = rgba(C.coral, .9); g.fillRect(-.075, -.05, .15, .1);
    });
  }, .31, 2);
  collar.position.set(2.08 * CA, 2.08 * SA, .31); collar.rotation.z = ang;

  // cork: a tiny cream cylinder-card on the muzzle, with a coral thread
  const corkPts = rr(-.26, -.22, .52, .44, .13);
  const cork = add(corkPts, (P) => {
    P.fill('#e9dcc0'); P.felt(.6);
    P.layer((g) => {
      g.fillStyle = C.creamDeep; g.beginPath(); g.ellipse(0, .03, .18, .22, 0, 0, TAU); g.fill();
    }, C.creamDeep, { lip: .8, shadow: .6, depth: .8 });
    P.draw((g) => {
      g.strokeStyle = rgba(C.ink, .55); g.lineWidth = .028;
      g.beginPath(); g.ellipse(0, .03, .18, .22, 0, 0, TAU); g.stroke();
      g.strokeStyle = rgba(C.coral, .9); g.lineWidth = .04;
      g.beginPath(); g.moveTo(-.22, -.17); g.quadraticCurveTo(0, -.31, .22, -.17); g.stroke();
    });
  }, .30, 3);
  cork.position.set(-2.43, .51, .30); cork.rotation.z = ang;

  // stock: a chunky folded card; its broad left lobe reads under the barrel in the bottom-right corner
  const stockPts = [[-1.45, -.5], [-.6, -1.95], [.9, -1.8], [1.05, .12], [.7, .42], [-1.0, .36]];
  add(stockPts, (P) => {
    P.gradient(sh(C.creamDeep, .08), sh(C.ochre, -.06), .55); P.felt(.6);
    P.draw((g) => {
      g.strokeStyle = rgba(C.ink, .7); g.lineWidth = .05; g.lineJoin = 'round';
      g.beginPath(); stockPts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
      g.fillStyle = rgba(C.ink, .32);
      for (let y = -.5; y > -1.7; y -= .34) g.fillRect(-.55 + (y + 1.9) * .2, y, .85, .035);
    });
    P.innerShade(sh(C.ochreDeep, -.3), { alpha: .3, blurPx: 6 });
  }, 0, 4);

  // cheek plate: a coral-edged ochre overlay on the stock, a real second card
  add([[-1.18, -.2], [-.5, -1.45], [.4, -1.3], [.52, .04], [.2, .24], [-.92, .18]], (P) => {
    P.fill(C.ochre); P.felt(.5);
    P.draw((g) => {
      g.strokeStyle = rgba(C.ink, .6); g.lineWidth = .05; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-1.18, -.2); g.lineTo(-.5, -1.45); g.lineTo(.4, -1.3); g.lineTo(.52, .04); g.lineTo(.2, .24); g.lineTo(-.92, .18); g.closePath(); g.stroke();
      g.fillStyle = rgba(C.coral, .9); g.fillRect(-.8, -.36, 1.2, .11);
      g.fillStyle = rgba(C.gold, .95); D.poly(g, starPts(-.7, -.06, .13, .055, 5, PI / 2));
      g.fillStyle = rgba(C.cream, .9); g.beginPath(); g.arc(.12, -.08, .09, 0, TAU); g.fill();
      g.fillStyle = rgba(C.ink, .55); g.beginPath(); g.arc(.12, -.08, .035, 0, TAU); g.fill();
    });
    P.innerShade(sh(C.ochreDeep, -.2), { alpha: .25, blurPx: 4 });
  }, .08, 5);

  // trigger guard: a C-shaped paper ring hanging under the barrel, its lower arc in view
  const ringPts = [...arc(-.6, -.10, .28, .28, -PI * .15, PI * 1.15, 16), ...arc(-.6, -.10, .17, .17, PI * 1.15, -PI * .15, 12)];
  add(ringPts, (P) => {
    P.fill(C.ochreDeep); P.felt(.4);
    P.draw((g) => {
      g.strokeStyle = rgba(C.ink, .6); g.lineWidth = .035;
      g.beginPath(); g.arc(-.6, -.10, .225, -PI * .1, PI * 1.1); g.stroke();
      g.strokeStyle = rgba(C.ink, .75); g.lineWidth = .045; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-.52, .07); g.lineTo(-.69, -.14); g.stroke();   // the trigger inside the guard
    });
  }, .24, 6);

  // a paper puff on firing: one expanding cream ring and three scraps at the muzzle
  const puffRingGeo = new T.RingGeometry(.10, .175, 18);
  const puffRingMat = new T.MeshBasicMaterial({ color: '#f7ecd2', transparent: true, opacity: .9, depthWrite: false, side: T.DoubleSide });
  const puffGeo = new T.PlaneGeometry(.16, .09);
  const puffs = [];
  const muzzle = new T.Object3D(); muzzle.position.set(-2.62, .58, .16); aim.add(muzzle);

  const GRIP = { x: .90, y: -.70, depth: 13, at: 3.0 };   // NDC grip point, camera depth, half height at 16:9
  const yaw = { v: 0 }, pitchV = { v: 0 };
  let aimP = null, hasAim = false, recoilT = 99, shownScale = 1;
  const cvEl = document.querySelector('canvas');   // the displayed frame's own rect: a letterboxed phone still reads right
  const _r = new T.Vector3(), _u = new T.Vector3(), _f = new T.Vector3(), _d = new T.Vector3(), _q = new T.Quaternion();
  const _mw = new T.Vector3();

  function place(dt) {
    camera.updateMatrixWorld();
    const q = camera.quaternion;
    _r.set(1, 0, 0).applyQuaternion(q); _u.set(0, 1, 0).applyQuaternion(q); _f.set(0, 0, -1).applyQuaternion(q);
    const halfH = GRIP.depth * Math.tan(camera.fov * PI / 360), halfW = halfH * camera.aspect;
    // paperfair: the toy is ALWAYS visible. On a phone it is held small and tucked into the very bottom-right corner
    // (.6 at 400 CSS px of displayed width or less, .68 above it), clear of the rail and every standing target; a
    // desktop keeps the authored scale 1 at the authored grip. The 3D paper puff and the touch reticle flash remain.
    const phone = MOBILE;
    const shownW = cvEl.getBoundingClientRect().width;
    shownScale = phone ? (shownW <= 400 ? .6 : .68) : 1;
    rig.position.copy(camera.position)
      .addScaledVector(_r, (phone ? .95 : GRIP.x) * halfW)
      .addScaledVector(_u, (phone ? -.80 : GRIP.y) * halfH)
      .addScaledVector(_f, GRIP.depth);
    rig.quaternion.copy(q);
    rig.scale.setScalar(halfH / GRIP.at * shownScale);   // same screen size in any lens, scaled for a thumb
    rig.visible = true;

    // aim: the reticle's ground point, in the rig's own frame; small clamps keep it a held toy, never a windmill
    let wy = 0, wp = 0;
    if (hasAim && aimP) {
      _d.copy(aimP).sub(rig.position).applyQuaternion(_q.copy(q).invert());
      const fwd = Math.max(.001, -_d.z);
      wy = Math.max(-.30, Math.min(.30, Math.atan2(-_d.x, fwd)));
      wp = Math.max(-.18, Math.min(.18, Math.atan2(_d.y, fwd)));
    }
    const k = 1 - Math.exp(-7.5 * (dt || 0));
    yaw.v += (wy - yaw.v) * k; pitchV.v += (wp - pitchV.v) * k;

    // recoil: a kick rising for .12 s, springing back over .25 s
    recoilT += dt || 0;
    const rt = recoilT, rec = rt < .12 ? (rt / .12) ** 2 * (3 - 2 * (rt / .12)) : Math.max(0, 1 - ((rt - .12) / .25) ** 2 * (3 - 2 * Math.min(1, (rt - .12) / .25)));
    aim.rotation.set(pitchV.v, yaw.v, -.10 * rec);
    aim.position.set(0, .05 * rec, .18 * rec);

    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]; p.t += dt || 0;
      const u = Math.min(1, p.t / p.life);
      p.m.scale.setScalar(.8 + u * 1.8); p.mat.opacity = .9 * (1 - u);
      if (p.t >= p.life) { aim.remove(p.m); p.mat.dispose(); puffs.splice(i, 1); }
    }
  }

  function fire() {
    recoilT = 0;
    place(0);
    rig.updateMatrixWorld(true);
    aim.updateMatrixWorld(true);
    muzzle.getWorldPosition(_mw);
    const ring = new T.Mesh(puffRingGeo, puffRingMat.clone());
    ring.position.copy(muzzle.position); ring.position.z += .05;
    ring.renderOrder = 4; aim.add(ring); puffs.push({ m: ring, mat: ring.material, t: 0, life: .34 });
    for (let i = 0; i < 4; i++) {
      const mat = new T.MeshBasicMaterial({ color: i % 2 ? '#e8d6ae' : '#f8eed8', transparent: true, opacity: .95, depthWrite: false, side: T.DoubleSide });
      const m = new T.Mesh(puffGeo, mat);
      m.position.copy(muzzle.position); m.position.x += (Math.random() - .5) * .22; m.position.y += (Math.random() - .5) * .2;
      m.rotation.z = Math.random() * TAU; m.renderOrder = 4;
      aim.add(m); puffs.push({ m, mat, t: 0, life: .22 + Math.random() * .1, vx: (Math.random() - .5) * .9, vy: .35 + Math.random() * .5 });
    }
    return _mw.clone();
  }

  // the puffs drift in local x/y (simplest readable paper scraps in the near band)
  H.onStep((t, dt) => {
    for (const p of puffs) if (p.vx) { p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; }
    place(dt);
  });

  return {
    group: rig,
    aimAt: (p) => { if (p) { aimP = (aimP || new T.Vector3()).copy(p); hasAim = true; } },
    fire,
    hidden: () => !rig.visible,
    muzzleWorld: () => { aim.updateMatrixWorld(true); return muzzle.getWorldPosition(_mw).clone(); },
    state: () => ({ yaw: +yaw.v.toFixed(3), pitch: +pitchV.v.toFixed(3), scale: +shownScale.toFixed(2), hidden: !rig.visible,
      recoil: +Math.max(0, Math.min(1, recoilT < .12 ? recoilT / .12 : 1 - (recoilT - .12) / .25)).toFixed(2) }),
    muzzleScreen: () => { aim.updateMatrixWorld(true); const p = muzzle.getWorldPosition(_mw).clone().project(camera); const r = document.querySelector('canvas').getBoundingClientRect(); return [Math.round(r.left + (p.x + 1) / 2 * r.width), Math.round(r.top + (1 - p.y) / 2 * r.height)]; },
  };
})();

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
  // 8a. target prints: one shared print per kind, stamped on the pool's cards (several of a kind may stand at once).
  // Every target is a NON-LIVING fairground object: a tin can, a bottle, a pie tin, a balloon, a prize star.
  // Each print is a layered cut-paper collage with an accent layer (law 4), sized 15-20% up for readability at dusk.
  const enlarge = (draw, w, h, name, k = 1.18) => P2.drawnPiece((g, ink) => { g.save(); g.scale(k, k); draw(g, ink); g.restore(); }, { w: w * k, h: h * k, name });
  const can = (() => {
    const [pts, paint] = P2.drawnPiece((g, ink) => {
      g.fillStyle = ink('#a99f8a'); D.ell(g, 0, .15, .72, .13);            // base shadow ring
      g.fillStyle = ink('#d8cfba'); D.poly(g, [[-.7, .14], [.7, .14], [.64, 1.66], [-.64, 1.66]]);
      g.fillStyle = ink('#eae2cd'); D.poly(g, [[-.54, .2], [.54, .2], [.5, 1.62], [-.5, 1.62]]);
      g.fillStyle = ink(C.coral); D.rect(g, -.7, .82, 1.4, .35, .02);      // the red band
      g.fillStyle = ink(C.coralDeep); D.rect(g, -.7, .82, 1.4, .07);
      g.fillStyle = ink(C.cream); D.rect(g, -.66, .98, 1.32, .05);
      g.fillStyle = ink(C.gold); D.poly(g, starPts(0, 1.4, .2, .085, 5, PI / 2));
      g.fillStyle = ink('#f4edda'); D.ell(g, 0, 1.68, .7, .16);            // rolled top rim
      g.fillStyle = ink('#b8ae99'); D.ell(g, 0, 1.68, .57, .115);
      g.fillStyle = ink('#7e7664', 'print'); D.ell(g, 0, 1.66, .45, .075);
      g.fillStyle = ink(C.creamDeep); D.rect(g, -.7, .18, 1.4, .07);       // bottom seam
      g.fillStyle = ink(C.ink, 'print');
      for (const [x, y] of [[-.5, .55], [.5, .55], [-.5, 1.3], [.5, 1.3]]) D.ell(g, x, y, .04, .04);
      g.strokeStyle = 'rgba(51,33,29,.45)'; g.lineWidth = .028;
      g.beginPath(); g.moveTo(-.62, .42); g.lineTo(-.58, 1.5); g.stroke();
    }, { w: 1.6, h: 1.9, name: 'target tin can' });
    return { pts, mats: H.printed(pts, paint, { res: 1.1 }), h: P2.bbox(pts).h, w: P2.bbox(pts).w, points: 10, name: 'can' };
  })();
  const bottle = (() => {
    const [pts, paint] = P2.drawnPiece((g, ink) => {
      g.fillStyle = ink(C.tealDeep); D.ell(g, 0, .12, .55, .09);
      g.fillStyle = ink('#356b70'); D.rect(g, -.55, .1, 1.1, .16, .04);
      g.fillStyle = ink('#3e7c80'); D.poly(g, [[-.51, .14], [.51, .14], [.56, .96], [.34, 1.4], [.18, 1.62], [.18, 2.22], [.24, 2.32], [.24, 2.44], [-.24, 2.44], [-.24, 2.32], [-.18, 2.22], [-.18, 1.62], [-.34, 1.4], [-.56, .96]]);
      g.fillStyle = ink(C.teal); D.rect(g, -.38, .2, .62, .88, .16);       // the glass front
      g.fillStyle = ink('#8fb8ae'); D.rect(g, -.34, .26, .14, .9, .05);    // a pale highlight down the glass
      g.fillStyle = ink(C.cream); D.rect(g, -.45, .58, .9, .58, .04);      // the paper label
      g.fillStyle = ink(C.coral); D.rect(g, -.45, .58, .9, .07); D.rect(g, -.45, 1.09, .9, .07);
      g.fillStyle = ink(C.gold); D.poly(g, starPts(0, .87, .15, .065, 5, PI / 2));
      g.fillStyle = ink(C.ink, 'print');
      g.fillRect(-.34, .68, .36, .03); g.fillRect(-.34, .99, .5, .03);
      g.fillStyle = ink(C.ochreDeep); D.rect(g, -.27, 2.44, .54, .2, .05); // crimped cap
      g.fillStyle = ink(C.coral, 'print'); D.rect(g, -.27, 2.5, .54, .05);
      g.strokeStyle = 'rgba(51,33,29,.5)'; g.lineWidth = .03;
      g.beginPath(); g.moveTo(.2, 1.66); g.lineTo(.2, 2.22); g.stroke();
    }, { w: 1.4, h: 2.7, name: 'target bottle' });
    return { pts, mats: H.printed(pts, paint, { res: 1.1 }), h: P2.bbox(pts).h, w: P2.bbox(pts).w, points: 15, name: 'bottle' };
  })();
  const plate = (() => {
    const [pts, paint] = P2.drawnPiece((g, ink) => {
      g.fillStyle = ink(C.coralDeep); D.ell(g, 0, .8, 1.1, .8);             // the red enamel rim
      g.fillStyle = ink(C.coral); D.ell(g, 0, .81, 1.02, .73);
      g.fillStyle = ink(C.cream); D.ell(g, 0, .82, .94, .66);               // the tin face
      g.fillStyle = ink(C.creamDeep); D.ell(g, 0, .83, .78, .53);
      g.fillStyle = ink(C.gold); D.poly(g, starPts(0, .83, .2, .085, 5, PI / 2));
      g.fillStyle = ink(C.coral, 'print'); D.ell(g, 0, .83, .1, .1);
      g.fillStyle = ink(C.cream, 'print'); D.ell(g, 0, .83, .045, .045);
      g.strokeStyle = 'rgba(51,33,29,.5)'; g.lineWidth = .028;
      g.beginPath(); g.ellipse(0, .83, .62, .42, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(157,55,50,.85)'; g.lineWidth = .045;
      g.beginPath(); g.ellipse(0, .82, .87, .6, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(51,33,29,.4)'; g.lineWidth = .022;
      for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * .99, .81 + Math.sin(a) * .72); g.lineTo(Math.cos(a) * 1.09, .8 + Math.sin(a) * .8); g.stroke(); }
    }, { w: 2.25, h: 1.68, name: 'target pie tin' });
    return { pts, mats: H.printed(pts, paint, { res: 1.1 }), h: P2.bbox(pts).h, w: P2.bbox(pts).w, points: 10, name: 'plate' };
  })();
  const balloon = (() => {
    const [pts, paint] = enlarge((g, ink) => {
      g.fillStyle = ink(C.woodDark); D.rect(g, -.34, 0, .68, .13, .04);
      g.fillStyle = ink(C.wood); D.rect(g, -.055, .1, .11, .8, .03);
      g.fillStyle = ink(C.coralDeep); D.poly(g, [[-.12, .88], [.12, .88], [0, .68]]);
      g.fillStyle = ink(C.coral); D.ell(g, 0, 1.62, .68, .78);
      g.fillStyle = ink(C.coralSoft); D.ell(g, -.16, 1.77, .32, .52);
      g.fillStyle = ink(C.cream); D.ell(g, -.24, 1.85, .14, .27);
      g.fillStyle = ink(C.gold, 'print'); D.ell(g, 0, 1.52, .1, .1);
      g.fillStyle = ink(C.cream, 'print'); D.ell(g, 0, 1.52, .04, .04);
    }, 1.8, 2.55, 'target balloon');
    return { pts, mats: H.printed(pts, paint, { res: 1.1 }), h: P2.bbox(pts).h, w: P2.bbox(pts).w, points: 15, name: 'balloon' };
  })();
  const star = (() => {
    const [pts, paint] = enlarge((g, ink) => {
      g.fillStyle = ink(C.wood); D.rect(g, -.32, 0, .64, .5, .06);
      // the collar reaches y .78 so it actually overlaps the star's lowest points (y .612): a 0.01 gap used to
      // split the drawing in two and the tracer dropped the base
      g.fillStyle = ink(C.coral); D.poly(g, [[-.32, .46], [.32, .46], [.22, .78], [-.22, .78]]);
      g.fillStyle = ink(C.gold); D.poly(g, starPts(0, 1.3, .85, .38, 5, PI / 2));
      g.fillStyle = ink(C.cream); D.poly(g, starPts(0, 1.3, .55, .24, 5, PI / 2));
      g.fillStyle = ink(C.coral); D.ell(g, 0, 1.3, .13, .13);
      g.fillStyle = ink(C.cream, 'print'); D.ell(g, 0, 1.3, .055, .055);
    }, 2.0, 2.2, 'target star');
    return { pts, mats: H.printed(pts, paint, { res: 1.1 }), h: P2.bbox(pts).h, w: P2.bbox(pts).w, points: 25, name: 'star' };
  })();
  const KINDS = { can, bottle, plate, balloon, star };

  // 8b. seeded round state
  let seed = +(QP.get('seed') || 0) || 1 + Math.floor(Math.random() * 999);
  let waveRnd = P2.rng(seed * 7919 + 17);
  let fxRnd = P2.rng(seed * 7919 + 31);
  let gameTime = 0, roundStart = 0, score = 0, streak = 0, maxStreak = 0, lastShot = -1;
  let started = false, done = false, waveTimer = PGP ? .9 : 1.5, starterDone = false;
  let sliderAt = -1, flurryAt = -1, flurryStars = 0;
  let best = 0; try { best = +(localStorage.getItem('pf-best') || 0) || 0; } catch (e) { best = 0; }

  // 8c. the spots.
  // Desktop and phone-landscape: eleven free places along the one wide rail, never closer than 1.6 units. On a phone
  // landscape frame the pool is screen-checked in NDC against the harness's own frame (10% margin for the spot, 2% for
  // the card's top and sides) and the spacing tightens until 6-8 spots stand clear of the edges.
  // Portrait: twelve spots in THREE depth rows on the tall cabinet (four each). The near row is big and low, the middle
  // row a step up and back, the far row high and small; the award follows the row (10 / 15 / 25), so the screen reads
  // as a difficulty ladder. Each row's x offsets are authored against the 60-unit portrait lens; the far row can sit
  // wider in world because its cards print smaller. Desktop skips every check and keeps its authored 3.0-unit rail.
  const railBase = RAIL_TOP + .04, _rp = new T.Vector3();
  camera.updateMatrixWorld();
  const ndcAt = (x, y, z) => _rp.set(x, y, z).project(camera);
  const ndcAtRail = (x, y) => ndcAt(x, y, RAIL_Z);
  const tallestTop = Math.max(...Object.values(KINDS).map((k) => k.h)) * 1.08;
  // Portrait: the harness's 1.33 lens and the 60-unit camera; a 1.2 base bump times the row multiplier makes the near
  // row ~1.44x (can tap circle ~52 CSS px), the middle 1.2x and the far .875x (still >= 48 px because the far kinds,
  // balloons and stars, are the tall ones). A landscape phone keeps the authored 1.15 bump; desktop exactly 1.
  const TSCALE = MOBILE ? (PORTRAIT ? 1.2 : 1.15) : 1;
  const inBand = (x, y, m, z = RAIL_Z) => {   // NDC: x -1..1 across, y -1 bottom .. 1 top; a margin m of the frame
    if (!MOBILE) return true;
    const p = ndcAt(x, y, z);
    return p.x > -1 + 2 * m && p.x < 1 - 2 * m && p.y > -1 + 2 * m && p.y < 1 - 2 * m;
  };
  const makeSpots = (gap) => Array.from({ length: 11 }, (_, i) => ({ x: 2 + (i - 5) * gap, z: RAIL_Z, t: null }));
  // the spot itself sits in the 10% safe centre band; the tallest raised target and the widest target's sides must not
  // clip the frame (2% margin). On a 390 px portrait frame this seats seven spots with every card fully printed.
  const spotFits = (s) => inBand(s.x, railBase, .1)
    && inBand(s.x, railBase + tallestTop * TSCALE, .02)
    && inBand(s.x - 1.35 * TSCALE, railBase + 1.5 * TSCALE, .02)
    && inBand(s.x + 1.35 * TSCALE, railBase + 1.5 * TSCALE, .02);
  const fitSpots = () => {
    if (!MOBILE) return { list: makeSpots(3.0), gap: 3.0 };
    let fallback = null;
    for (const gap of [3.0, 2.6, 2.2, 1.9, 1.7]) {
      const list = makeSpots(gap).filter(spotFits);
      if (list.length >= 6 && list.length <= 8) return { list, gap };   // the widest rail that still seats 6-8
      if (list.length >= 6 && !fallback) fallback = { list, gap };
    }
    return fallback || { list: makeSpots(1.7).filter(spotFits), gap: 1.7 };
  };
  // rows: z (depth), y (the shelf top the cards hinge from), mult (on TSCALE), value (the row's award), offs (x from
  // the booth's centre at x=2), kinds (the visual mix that reads at that row's size).
  const portraitRows = PGP ? [
    { z: -9.70, y: railBase, mult: 1.20, value: 10, offs: [-5.5, -1.85, 1.85, 5.5], kinds: ['can', 'plate'] },
    { z: -11.70, y: railBase + 2.39, mult: 1.00, value: 15, offs: [-5.8, -2.1, 2.1, 5.8], kinds: ['bottle', 'plate'] },
    { z: -13.50, y: railBase + 4.79, mult: .875, value: 25, offs: [-5.9, -2.0, 2.0, 5.9], kinds: ['balloon', 'star'] },
  ] : null;
  const portraitSpots = () => {
    const out = [];
    portraitRows.forEach((r, ri) => r.offs.forEach((o, ci) => out.push({
      x: 2 + o, z: r.z, y: r.y, t: null, row: ri, col: ci, value: r.value, mult: r.mult, kinds: r.kinds,
      keep: ri === 1 && ci === 2,
      // one sliding can on the middle row's inner-right spot: a slow patrol along a short stretch of its own row, so
      // it never crosses a neighbouring card. It wraps at the lane ends (a paper cut-out on a hidden track).
      slide: ri === 1 && ci === 2 ? { a: 2 + o - 1.15, b: 2 + o + 1.15 } : null,
    })));
    return out;
  };
  const fitted = PGP ? { list: [], gap: 3.8 } : fitSpots();
  const spots = PGP ? portraitSpots() : (fitted.list.length ? fitted.list : makeSpots(1.7));
  const railGap = PGP ? 3.8 : fitted.gap;
  const centerSpot = PGP
    ? (spots.find((s) => s.row === 1 && s.col === 1) || spots[0])
    : spots.reduce((a, s) => (Math.abs(s.x - 2) < Math.abs(a.x - 2) ? s : a), spots[0]);
  const sliderSpot = PGP ? spots.find((s) => s.slide) || null : null;
  const pool = [];
  const flurryPool = [];
  let nextId = 0, slider = null;
  const addTarget = (kind) => {
    const k = KINDS[kind];
    const mesh = makeCard(k.pts, { materials: k.mats, paper: H.paper, thickness: .08, edgeWidth: .08, pxPerUnit: 44 });
    // the card's own hinge line is its base. `at` stays at the origin: spawn() places the whole group on the rail,
    // so a world offset here would move every target twice (the old 2x RAIL_TOP/RAIL_Z bug put them behind the board).
    const h = hinge(mesh, { at: new T.Vector3(0, 0, 0), yaw: 0, open: 0, size: .32, rest: (nextId % 3 - 1) * .018 });
    const t = { id: nextId++, kind, k, mesh, h, group: h.group, x: 0, z: RAIL_Z, baseY: railBase, scale: 1, standing: false,
      starter: false, hit: false, roseAt: 0, foldAt: 0, freeAt: -1, spot: null, row: 0, award: k.points, bonus: false,
      persistent: false, reserved: false, slide: null, slidePhase: 0 };
    h.group.visible = false;
    h.onStart = () => H.sound?.flap({ size: .22, up: h.open > .5, key: 'target' + t.id, seed: 1200 + t.id });
    scene.add(h.group);
    pool.push(t);
    return t;
  };
  for (const kind of ['can', 'can', 'can', 'can', 'bottle', 'bottle', 'bottle', 'bottle', 'plate', 'plate', 'plate', 'balloon', 'balloon', 'star', 'star']) addTarget(kind);
  if (PGP) {   // three dedicated gold stars for the final flurry: never spent by ordinary waves
    for (let i = 0; i < 3; i++) { const t = addTarget('star'); t.reserved = true; flurryPool.push(t); }
  }
  if (PGP) { slider = addTarget('can'); slider.reserved = true; }

  // 8d. the reticle: a two-layer print, unmistakable over busy ground. A cream dashed ring (3.0 world units
  // across) with an ink under-stroke, a thin ink ring and a small ink cross. It lies flat on the page print and is
  // drawn over every card (depthTest off, high renderOrder): the OS cursor is always visible too, so aiming is read
  // twice over. It is only shown while the pointer has a valid ground point; the last valid point is kept for firing.
  const ring = (() => {
    const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'); g.translate(s / 2, s / 2); g.lineCap = 'round';
    const R = s * .395, N = 12;
    const band = (col, w, pad) => {
      g.strokeStyle = col; g.lineWidth = w;
      for (let i = 0; i < N; i++) {
        const a0 = i / N * TAU + pad, a1 = (i + 1) / N * TAU - pad;
        g.beginPath(); g.arc(0, 0, R, a0, a1); g.stroke();
      }
    };
    band('rgba(51,33,29,.9)', s * .074, .075);       // the cut edge under each cream dash
    band('#f8eed6', s * .05, .09);                    // the cream dashed ring
    g.strokeStyle = 'rgba(51,33,29,.92)'; g.lineWidth = s * .018; // thin ink ring
    g.beginPath(); g.arc(0, 0, s * .275, 0, TAU); g.stroke();
    g.lineWidth = s * .026; g.strokeStyle = '#33211d';
    for (const [a, b] of [[-.135, -.045], [.045, .135]]) {
      g.beginPath(); g.moveTo(a * s, 0); g.lineTo(b * s, 0); g.moveTo(0, a * s); g.lineTo(0, b * s); g.stroke();
    }
    g.fillStyle = '#f8eed6'; g.beginPath(); g.arc(0, 0, s * .022, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(51,33,29,.95)'; g.lineWidth = s * .009; g.beginPath(); g.arc(0, 0, s * .022, 0, TAU); g.stroke();
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(new T.PlaneGeometry(3.0, 3.0), new T.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: T.DoubleSide, toneMapped: false,
    }));
    m.rotation.x = -PI / 2; m.position.y = .055; m.renderOrder = 20; m.visible = false;
    m.frustumCulled = false;
    scene.add(m); return m;
  })();
  let retTarget = 0, lastX = 0, lastZ = 0, retFlash = -1;
  // the aim: the last valid ground point under the pointer (kept for firing when the pointer leaves the page)
  const aim = { valid: false, shown: false, point: new T.Vector3(2, .055, -8), ndc: { x: 0, y: 0 } };
  const pointer = { x: 0, y: 0, inside: false };

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
  const targetCenter = (t) => [t.x, (t.baseY ?? railBase) + t.k.h * t.scale * .5, t.z];
  const targetScreen = (t) => {
    camera.updateMatrixWorld();
    const [cx, cy, cz] = targetCenter(t);
    const base = t.baseY ?? railBase;
    const hw = t.k.w * t.scale * .5;
    const p = project(cx, cy, cz), b = project(cx, base, cz), u = project(cx, base + t.k.h * t.scale, cz);
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
  // 8f-b. hit juice: a floating ink chip on a cream torn card, a quick scorecard bump and the NEW BEST stamp. The chips
  // live in a DOM layer above the canvas and below the end card; eight nodes are reused so a busy wave allocates nothing.
  const popLayer = $('popups'), newBestEl = $('newbest');
  const popNodes = [];
  let livePops = 0;
  function endPop(node) {
    if (node.classList.contains('live')) { node.classList.remove('live'); livePops = Math.max(0, livePops - 1); }
  }
  function popupAt(points, mult, x, y) {
    if (!popLayer) return;
    let node;
    if (popNodes.length < 8) {
      node = document.createElement('div'); node.className = 'pf-pop';
      node.addEventListener('animationend', () => endPop(node));
      popLayer.appendChild(node); popNodes.push(node);
    } else {
      node = popNodes.find((n) => !n.classList.contains('live')) || popNodes[0];
      endPop(node);
    }
    node.textContent = '+' + points;
    if (mult >= 2) {
      node.appendChild(document.createTextNode(' '));
      const m = document.createElement('span'); m.className = 'mult'; m.textContent = '\u00d7' + mult; node.appendChild(m);
    }
    node.style.left = Math.round(x) + 'px'; node.style.top = Math.round(y) + 'px';
    void node.offsetWidth;   // restart the CSS animation on a reused node
    node.classList.add('live'); livePops++;
  }
  function bumpScore() {
    if (!scoreEl) return;
    scoreEl.classList.remove('bump'); void scoreEl.offsetWidth; scoreEl.classList.add('bump');
  }
  if (scoreEl) scoreEl.addEventListener('animationend', () => scoreEl.classList.remove('bump'));
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
    const base = kind === 'star' ? 988 : kind === 'bottle' || kind === 'balloon' ? 784 : 659;
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

  // 8g. targets: rise, fold by themselves after 5.5 s on the portrait cabinet (3.5 s on the wide rail), fold at once
  // when hit. Portrait keeps a busier screen: one persistent sliding can, rows that spawn as a row / a diagonal / a
  // zigzag, and a cap of eight standing at once (waves never exceed it).
  function spawn(t, spot, scale, starter = false) {
    if (!spot || spot.t) return false;
    spot.t = t; t.spot = spot; t.x = spot.x; t.z = spot.z; t.baseY = spot.y ?? railBase;
    t.row = spot.row ?? 0; t.award = spot.value ?? t.k.points;
    t.scale = scale * TSCALE * (spot.mult ?? 1);
    t.standing = true; t.starter = !!starter; t.hit = false; t.bonus = false;
    t.persistent = !!t.reserved; t.slide = spot.slide || null; t.slidePhase = 0;
    t.roseAt = gameTime; t.foldAt = 0; t.freeAt = Infinity;
    t.group.position.set(t.x, t.baseY, t.z);
    t.group.rotation.y = ((t.id * .73) % 1 - .5) * .14;
    t.mesh.scale.setScalar(t.scale);
    t.group.visible = true;
    t.h.reset(0); t.h.set(1, .025);
    return true;
  }
  function freeTarget(kind) {
    const free = pool.filter((t) => !t.standing && !t.reserved && t.freeAt <= gameTime && (kind ? t.kind === kind : true));
    return free.length ? free[Math.floor(waveRnd() * free.length)] : null;
  }
  function standingCount() { let n = 0; for (const t of pool) if (t.standing) n++; return n; }
  function spawnStarter() {
    const t = freeTarget('can'); if (!t) return false;
    return spawn(t, centerSpot, 1.2, true);
  }
  const shuffled = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(waveRnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  function spawnAtSpot(s, kinds) {
    if (!s || s.t) return false;
    const mix = kinds || s.kinds;
    const kind = mix[Math.floor(waveRnd() * mix.length)];
    const t = freeTarget(kind) || freeTarget(null);
    return t ? (spawn(t, s, .96 + waveRnd() * .08) ? t : false) : false;
  }
  // the wide rail (desktop + phone landscape): unchanged kind-based waves
  function spawnWave(n) {
    const freeSpots = spots.filter((s) => !s.t);
    for (let i = freeSpots.length - 1; i > 0; i--) { const j = Math.floor(waveRnd() * (i + 1)); [freeSpots[i], freeSpots[j]] = [freeSpots[j], freeSpots[i]]; }
    let made = 0;
    for (const s of freeSpots) {
      if (made >= n) break;
      const r = waveRnd(), kind = r < .30 ? 'can' : r < .56 ? 'plate' : r < .76 ? 'bottle' : r < .92 ? 'balloon' : 'star';
      const t = freeTarget(kind) || freeTarget(null); if (!t) continue;
      if (spawn(t, s, .92 + waveRnd() * .16, false)) made++;
    }
    return made;
  }
  // portrait waves: the award is the row's, the kind is only the visual. 1-3 per wave, never past the cap.
  function spawnWavePortrait() {
    const cap = 8, room = cap - standingCount();
    if (room <= 0) return 0;
    const free = spots.filter((s) => !s.t && !s.keep);
    if (!free.length) return 0;
    const want = Math.min(room, 2 + Math.floor(waveRnd() * 2)), chosen = [];
    const p = waveRnd();
    if (p < .34) {              // a whole row (as many as will fit), so one shelf reads at once
      const rows = [0, 1, 2].filter((r) => free.some((s) => s.row === r));
      const r = rows[Math.floor(waveRnd() * rows.length)];
      chosen.push(...shuffled(free.filter((s) => s.row === r)).slice(0, want));
    } else if (p < .67) {       // a diagonal: one free spot per row, marching across
      const start = Math.floor(waveRnd() * 4), dir = waveRnd() < .5 ? 1 : -1;
      for (let k = 0; k < 4 && chosen.length < want; k++) {
        const col = (start + k * dir + 8) % 4;
        for (let r = 0; r < 3; r++) {
          const s = free.find((q) => q.row === r && q.col === col && !chosen.includes(q));
          if (s) { chosen.push(s); break; }
        }
      }
    } else {                    // alternating / zigzag: neighbouring rows take turns
      let r = Math.floor(waveRnd() * 3);
      for (let k = 0; k < 8 && chosen.length < want; k++) {
        const rowFree = free.filter((s) => s.row === r && !chosen.includes(s));
        if (rowFree.length) chosen.push(rowFree[Math.floor(waveRnd() * rowFree.length)]);
        r = (r + 1 + Math.floor(waveRnd() * 2)) % 3;
      }
    }
    let made = 0;
    for (const s of chosen.slice(0, want)) if (spawnAtSpot(s)) made++;
    return made;
  }
  // the golden flurry: a few bonus stars worth 25 in the last ~8 s of a portrait round, calm paper, no flashing
  function spawnFlurry(n) {
    let room = 8 - standingCount();
    if (flurryStars === 0 && room < n) {
      // open the cabinet: ordinary cards fold away so the golden stars have shelf space (calm, one last wave)
      const need = n - Math.max(0, room);
      for (const t of pool.filter((q) => q.standing && !q.bonus && !q.persistent).slice(0, need)) fold(t, false);
      room = 8 - standingCount();
    }
    if (room <= 0) return 0;
    const free = shuffled(spots.filter((s) => !s.t && !s.keep));
    let made = 0;
    for (const s of free) {
      if (made >= n || made >= room) break;
      const t = flurryPool.find((q) => !q.standing && q.freeAt <= gameTime); if (!t) continue;
      if (spawn(t, s, 1.0)) { t.award = 25; t.bonus = true; t.persistent = true; made++; }
    }
    flurryStars += made;
    return made;
  }
  function spawnSlider() {
    if (!sliderSpot || slider.standing) return false;
    slider.freeAt = -1;
    const ok = spawn(slider, sliderSpot, 1.4);   // a slightly larger can so its tap circle stays >= 48 px
    if (ok) { slider.award = sliderSpot.value; slider.persistent = true; slider.slidePhase = 0; }
    return ok;
  }
  // a card on every shelf at the bell: the three-row cabinet reads at once and a far-row target is always available
  function prefillPortrait() {
    if (!PGP) return;
    spawnAtSpot(spots.find((s) => s.row === 0 && s.col === 1));
    const far = spawnAtSpot(spots.find((s) => s.row === 2 && s.col === 1));
    if (far) far.persistent = true;   // the far prize star stays until it is hit: the top shelf always reads
  }
  function fold(t, hit) {
    if (!t.standing) return;
    t.standing = false; t.hit = !!hit; t.freeAt = gameTime + .68; t.foldAt = gameTime;
    if (t.spot) { t.spot.t = null; t.spot = null; }
    t.h.set(0);
    if (t === slider) sliderAt = gameTime + 1.5;
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
    const award = t.award ?? t.k.points;
    score += Math.round(award * mult);
    const sp = project(x, y, z);
    popupAt(award, streak, sp[0], sp[1] - 6);
    bumpScore();
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

  // 8h. firing: one path for a real pointerdown and for the test hook. The pellet leaves the POP-GUN MUZZLE (not the
  // bottom-centre of the frame); the reticle lands on the shot's ground point; the gun kicks and puffs paper. On a
  // touch the ring is held bright for .3 s (there is no hover to leave it under the finger). The toy is always visible
  // now, on every phone; the corner #muzzle paper flash stays only as the harness-hidden fallback.
  function muzzleFlash() {
    const mz = $('muzzle'); if (!mz) return;
    mz.classList.remove('flash'); void mz.offsetWidth; mz.classList.add('flash');
  }
  function fireAtPx(cssX, cssY, fromTouch = false) {
    if (done) return false;
    if (gameTime - lastShot < .1) return false;
    lastShot = gameTime;
    if (!started) { started = true; roundStart = gameTime; updateHud(); }
    const ndc = cssToNdc(cssX, cssY);
    let gp = H.groundAt(ndc.x, ndc.y);
    if (!gp && aim.valid) gp = aim.point;
    if (!gp) gp = new T.Vector3(2, 0, -8);
    aim.valid = true; aim.shown = true; aim.point.set(gp.x, .055, gp.z);
    ring.position.copy(aim.point);
    if (fromTouch) { retFlash = gameTime + .3; retTarget = 1; ring.material.opacity = .95; ring.visible = true; }
    GUN.aimAt(aim.point);
    const gy = Math.max(-13.1, Math.min(5.8, gp.z));
    const ground = new T.Vector3(gp.x, .06, gy);
    const target = findTargetAt(cssX, cssY);
    const to = target ? new T.Vector3(...targetCenter(target)) : ground;
    const from = GUN.fire();
    const m = new T.Mesh(pelletGeo, pelletMat);
    m.position.copy(from); m.castShadow = true; m.receiveShadow = false;
    scene.add(m);
    pellets.push({ m, from, to, t: 0, dur: .27, spin: (fxRnd() - .5) * 20, ground, ndc, target });
    H.sound?.flap({ size: .15, up: true, key: 'pop-gun' });
    if (GUN.hidden()) muzzleFlash();
    retTarget = done ? 0 : 1;
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
    const previousBest = best, isBest = score > previousBest && score > 0;
    best = Math.max(best, score);
    try { localStorage.setItem('pf-best', String(best)); } catch (e) { /* a private page may refuse */ }
    updateHud();
    const card = $('endcard');
    if (card) {
      $('final-score').textContent = String(score);
      $('final-best').textContent = String(best);
      $('final-streak').textContent = String(maxStreak);
      $('final-prizes').textContent = prizeLine();
      if (newBestEl) {
        newBestEl.classList.toggle('show', isBest);
        newBestEl.setAttribute('aria-hidden', String(!isBest));
        void newBestEl.offsetWidth;
      }
      card.classList.remove('hidden');
      refreshShare();
    }
    chime('star');
  }
  function resetRound() {
    score = 0; streak = 0; maxStreak = 0; started = false; done = false;
    gameTime = 0; roundStart = 0; lastShot = -1; waveTimer = PGP ? .9 : 1.5; starterDone = false;
    sliderAt = -1; flurryAt = -1; flurryStars = 0;
    waveRnd = P2.rng(seed * 7919 + 17);
    fxRnd = P2.rng(seed * 7919 + 31);
    for (const s of spots) s.t = null;
    for (const t of pool) {
      t.standing = false; t.starter = false; t.hit = false; t.spot = null; t.freeAt = -1; t.group.visible = false; t.h.reset(0);
      t.persistent = false; t.bonus = false; t.award = t.k.points; t.slide = null; t.baseY = railBase; t.row = 0;
    }
    for (const p of pellets) scene.remove(p.m); pellets.length = 0;
    for (const c of confetti) { scene.remove(c.m); c.mat.dispose(); } confetti.length = 0;
    for (const m of marks) { scene.remove(m.m); m.mat.dispose(); } marks.length = 0;
    for (const n of popNodes) endPop(n);
    retTarget = 0; retFlash = -1; ring.visible = false;
    const card = $('endcard'); if (card) card.classList.add('hidden');
    if (newBestEl) { newBestEl.classList.remove('show'); newBestEl.setAttribute('aria-hidden', 'true'); }
    if (PGP) { spawnSlider(); prefillPortrait(); }
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

  // 8i-b. the share card. A 1080 square PNG printed from the same paper: cream stock, a procedurally torn edge,
  // an ink neatline, the score huge, and one small coral/gold rule. Generated on demand (the end card and the first
  // share press), cached as a Blob, and exposed only as an object URL — a data URL is never stored or attached to the
  // page. Sharing is Web Share + plain intents: no backend, no trackers, no third-party script.
  const SHARE_URL = 'https://play.buildquietly.com/games/paperfair/?ref=share';
  const SHARE_FILE = 'paperfair-score.png';
  let shareBlob = null, shareUrl = '', shareKey = '';
  const shareInk = (a) => 'rgba(51, 33, 29, ' + a + ')';
  const shareRng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  function shareTorn(x, y, w, h, amp, rnd) {
    const pts = [];
    const side = (x0, y0, x1, y1, nx, ny, n) => {
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const deep = rnd() < .09 ? (rnd() - .34) * amp * 1.7 : 0;
        const j = (rnd() - .5) * amp * 1.15 + Math.sin(i * 2.1) * amp * .22 + deep;
        pts.push([x0 + (x1 - x0) * u + nx * j, y0 + (y1 - y0) * u + ny * j]);
      }
    };
    side(x, y, x + w, y, 0, -1, 46);
    side(x + w, y, x + w, y + h, 1, 0, 46);
    side(x + w, y + h, x, y + h, 0, 1, 46);
    side(x, y + h, x, y, -1, 0, 46);
    return pts;
  }
  function shareTrace(g, pts) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }
  function shareSpaced(g, text, x, y, font, gap) {
    g.font = font; g.textAlign = 'left';
    let total = -gap;
    for (const ch of text) total += g.measureText(ch).width + gap;
    let cx = x - total / 2;
    for (const ch of text) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + gap; }
    g.textAlign = 'center';
  }
  function drawShareCard(value) {
    const cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 1080;
    const g = cv.getContext('2d');
    if (!g) return null;
    const W = 1080, INK = '#33211d', CREAM = '#f1e1bd', CORAL = '#cf4f3e', GOLD = '#f0bd5a', GROUND = '#b7a88b';
    const rnd = shareRng((0x9e3779b9 ^ (value * 2654435761) ^ (best * 40503) ^ (maxStreak * 97)) >>> 0);
    g.fillStyle = GROUND; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 240; i++) {   // sawdust flecks on the backing sheet
      g.fillStyle = i % 2 ? 'rgba(51,33,29,.07)' : 'rgba(241,225,189,.10)';
      g.fillRect(rnd() * W, rnd() * W, 1.5 + rnd() * 3, 1.5 + rnd() * 3);
    }
    const pts = shareTorn(56, 56, 968, 968, 13, rnd);
    g.save();   // the card itself, with one soft paper shadow — no glow
    g.shadowColor = shareInk(.38); g.shadowBlur = 26; g.shadowOffsetY = 11;
    g.fillStyle = CREAM; shareTrace(g, pts); g.fill();
    g.restore();
    g.save(); shareTrace(g, pts); g.strokeStyle = 'rgba(223,200,152,.85)'; g.lineWidth = 3; g.stroke(); g.restore();
    g.save(); shareTrace(g, pts); g.clip();
    g.fillStyle = CREAM; g.fillRect(0, 0, W, W);
    g.lineCap = 'round';   // short ochre/ink fibres, then a fine dust of print grain
    for (let i = 0; i < 150; i++) {
      const x = rnd() * W, y = rnd() * W, l = 8 + rnd() * 26, a = (rnd() - .5) * .7;
      g.strokeStyle = i % 3 ? 'rgba(185,124,50,.10)' : 'rgba(51,33,29,.055)';
      g.lineWidth = .8 + rnd() * 1.1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 1100; i++) {
      g.fillStyle = i % 3 ? 'rgba(51,33,29,.032)' : 'rgba(255,248,228,.10)';
      g.fillRect(rnd() * W, rnd() * W, .8 + rnd() * 1.6, .8 + rnd() * 1.6);
    }
    g.restore();
    g.strokeStyle = shareInk(.52); g.lineWidth = 2; g.strokeRect(112, 112, 856, 856);   // the neatline, doubled thin
    g.strokeStyle = shareInk(.2); g.lineWidth = 1; g.strokeRect(126, 126, 828, 828);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = INK;
    shareSpaced(g, 'A POP-UP PAPER CARNIVAL', 540, 208, '600 22px Georgia, "Times New Roman", serif', 5.5);
    shareSpaced(g, 'PAPERFAIR', 540, 322, '600 100px Georgia, "Times New Roman", serif', 12);
    g.fillStyle = CORAL; g.fillRect(482, 351, 42, 5);
    g.fillStyle = GOLD; g.fillRect(530, 351, 68, 5);
    const s = String(value), fs = s.length >= 4 ? 226 : s.length === 3 ? 264 : 292;
    g.fillStyle = INK; g.font = 'italic ' + fs + 'px Georgia, "Times New Roman", serif';
    g.fillText(s, 540, 634);
    g.fillStyle = shareInk(.6);
    shareSpaced(g, 'POINTS', 540, 712, '600 20px Georgia, "Times New Roman", serif', 6);
    g.fillStyle = INK; g.font = 'italic 33px Georgia, "Times New Roman", serif';
    g.fillText('best ' + best + ' \u00b7 streak \u00d7' + maxStreak, 540, 780);
    g.strokeStyle = shareInk(.25); g.lineWidth = 1;
    g.beginPath(); g.moveTo(390, 824); g.lineTo(690, 824); g.stroke();
    g.fillStyle = shareInk(.72);
    shareSpaced(g, 'play.buildquietly.com', 540, 918, '600 26px Georgia, "Times New Roman", serif', 3.2);
    return cv;
  }
  function shareDataBlob(dataUrl) {
    const comma = dataUrl.indexOf(','), bin = atob(dataUrl.slice(comma + 1));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: 'image/png' });
  }
  function shareKeyNow() { return score + '|' + best + '|' + maxStreak; }
  function buildCard() {
    try {
      const cv = drawShareCard(score);
      if (!cv) return null;
      // transient PNG encode: the string lives only in this function; the page keeps the Blob and its object URL.
      const blob = shareDataBlob(cv.toDataURL('image/png'));
      if (shareUrl) { try { URL.revokeObjectURL(shareUrl); } catch (e) { /* an old page may refuse */ } }
      shareBlob = blob; shareUrl = URL.createObjectURL(blob); shareKey = shareKeyNow();
      return blob;
    } catch (e) { return null; }
  }
  function getShareBlob() { return shareBlob && shareKey === shareKeyNow() ? shareBlob : buildCard(); }
  function shareCaption() {
    let t = 'I scored ' + score + ' in Paperfair \u2014 a pop-up paper carnival shooting gallery. Beat me:';
    if (maxStreak >= 2) t += ' (streak \u00d7' + maxStreak + ')';
    return t;
  }
  function paintShareLinks() {
    const t = shareCaption(), u = SHARE_URL;
    const x = $('share-x'), wa = $('share-wa'), tg = $('share-tg');
    if (x) x.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t) + '&url=' + encodeURIComponent(u);
    if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(t + ' ' + u);
    if (tg) tg.href = 'https://t.me/share/url?url=' + encodeURIComponent(u) + '&text=' + encodeURIComponent(t);
  }
  function refreshShare() { paintShareLinks(); if (!shareBlob || shareKey !== shareKeyNow()) buildCard(); }
  function nativeShareCard(blob) {
    if (typeof navigator.share !== 'function') return Promise.resolve(false);
    const text = shareCaption(), url = SHARE_URL, title = 'Paperfair';
    let file = null;
    try { if (blob) file = new File([blob], SHARE_FILE, { type: 'image/png' }); } catch (e) { file = null; }
    const payload = { title, text, url };
    let canFiles = false;
    try { canFiles = !!(file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })); } catch (e) { canFiles = false; }
    return (async () => {
      try {
        if (canFiles) { await navigator.share({ files: [file], title, text, url }); return true; }
        await navigator.share(payload); return true;
      } catch (err) {
        if (err && err.name === 'AbortError') return true;   // the player closed the sheet: say nothing
        if (canFiles) {
          try { await navigator.share(payload); return true; }
          catch (e2) { if (e2 && e2.name === 'AbortError') return true; }
        }
        return false;
      }
    })();
  }
  function downloadShareCard(blob) {
    if (!blob) return false;
    const href = shareUrl || URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href; a.download = SHARE_FILE; a.style.display = 'none';
    document.body.appendChild(a);
    try { a.click(); } catch (e) { /* a very strict page may refuse */ }
    a.remove();
    return true;
  }
  function legacyCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) { return false; }
  }
  async function copyShareCaption(silent) {
    const text = shareCaption();
    let ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
    if (!ok) ok = legacyCopy(text);
    if (!silent) toast(ok ? 'caption copied' : 'the caption could not be copied');
    return ok;
  }
  const shareBtn = $('share-score');
  if (shareBtn) shareBtn.addEventListener('click', async () => {
    const blob = getShareBlob();
    if (await nativeShareCard(blob)) return;
    downloadShareCard(blob);
    await copyShareCaption(true);
    toast('the card is saved and the caption copied \u2014 post it where you like');
  });
  const shareIg = $('share-ig');
  if (shareIg) shareIg.addEventListener('click', async () => {
    const blob = getShareBlob();
    if (typeof navigator.share === 'function' && await nativeShareCard(blob)) return;
    downloadShareCard(blob);
    await copyShareCaption(true);
    toast('the card is saved and the caption copied \u2014 post it on Instagram');
  });
  const shareCopy = $('share-copy');
  if (shareCopy) shareCopy.addEventListener('click', () => { copyShareCaption(false); });
  const paperShare = {
    get text() { return shareCaption(); },
    get url() { return SHARE_URL; },
    get cardBytes() { return shareBlob ? shareBlob.size : 0; },
    get canNative() { return typeof navigator.share === 'function'; },
    get cardUrl() { return shareUrl; },
    buildCard,
  };
  window.__paperShare = paperShare;
  paintShareLinks();

  // 8j. the clock: waves, target life, pellets, confetti, marks and the HUD all run on the harness's fixed step
  H.onStep((time, dt) => {
    gameTime += dt;
    for (const t of pool) t.h.update(dt);   // targets are not in H.hinges: their springs run here, on the same clock
    if (started && !done && gameTime - roundStart >= 60) endRound();
    if (!done) {
      const tl = timeLeft();
      waveTimer -= dt;
      if (waveTimer <= 0) {
        if (PGP) {
          if (!starterDone) {
            starterDone = true; spawnStarter();
            const extra = Math.min(2, 8 - standingCount());
            for (let i = 0; i < extra; i++) spawnAtSpot(shuffled(spots.filter((s) => !s.t && !s.keep))[0]);
            waveTimer = 1.0;
          } else {
            spawnWavePortrait();
            waveTimer = (tl <= 15 ? 1.05 : 1.6) + waveRnd() * (tl <= 15 ? .55 : .8);
            if (tl <= 8.05 && flurryStars < 6) { if (flurryAt < 0) flurryAt = gameTime; spawnFlurry(flurryAt === gameTime ? 3 : 1); }
          }
        } else {
          if (!starterDone) { starterDone = true; spawnStarter(); waveTimer = 1.9; }
          else { const n = 1 + (waveRnd() < .55 ? 1 : 0) + (waveRnd() < .2 ? 1 : 0); spawnWave(n); waveTimer = 1.6 + waveRnd() * .8; }
        }
      }
      // the flurry opens on the clock, not only on a wave boundary: stepping to 52 s leaves the stars standing
      if (PGP && starterDone && tl <= 8.05 && flurryAt < 0) { flurryAt = gameTime; spawnFlurry(3); }
      // never let the cabinet read half-empty: when a batch folds at once, the next wave tops the screen back to six
      if (PGP && starterDone && standingCount() < 6 && waveTimer > .55) { spawnWavePortrait(); waveTimer = .55; }
      // the sliding can patrols its short middle-row lane and wraps; it folds and returns on the normal hit path
      if (PGP && slider) {
        if (!slider.standing && sliderAt >= 0 && gameTime >= sliderAt) { sliderAt = -1; spawnSlider(); }
        if (slider.standing && slider.slide) {
          slider.slidePhase += dt;
          const { a, b } = slider.slide, span = b - a;
          slider.x = a + (((slider.slidePhase * .42) % span) + span) % span;
          slider.group.position.x = slider.x;
        }
      }
    }
    const life = PGP ? 5.5 : 3.5;
    for (const t of pool) {
      if (!t.standing) {
        if (t.group.visible && gameTime - t.foldAt > .72) t.group.visible = false;
        continue;
      }
      if (!t.persistent && gameTime - t.roseAt > life) fold(t, false);
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
    // reticle: refind the ground point of the last pointer NDC each step (the harness camera drifts a little), then
    // fade in under the pointer and out when there is no valid point. The last valid point stays in `aim` for firing.
    if (pointer.inside && !done) {
      const gp = H.groundAt(aim.ndc.x, aim.ndc.y);
      if (gp) {
        aim.valid = true; aim.shown = true; aim.point.set(gp.x, .055, gp.z);
        ring.position.copy(aim.point);
        GUN.aimAt(aim.point);
      } else if (aim.valid) {
        aim.shown = false; retTarget = 0; ring.visible = false; ring.material.opacity = 0;
      }
    }
    if (retFlash > 0 && gameTime >= retFlash) { retFlash = -1; retTarget = 0; pointer.inside = false; }
    const want = retFlash > 0 ? 1 : retTarget;
    ring.material.opacity += (want * .95 - ring.material.opacity) * Math.min(1, dt * 12);
    ring.visible = ring.material.opacity > .02;
    updateHud();
  });
  H.onRestart(resetRound);

  // 8k. pointer input. ONE conversion for everything: client px -> the canvas rect -> NDC -> H.groundAt. The canvas is
  // letterboxed (its CSS position/size differ from the window's), so the rect — never innerWidth/innerHeight — is the
  // source of truth. Anywhere over the canvas aims and shoots; UI (the ? tab, the end card, buttons) is excluded by
  // element, and the help card/debug box are pointer-events:none so they never swallow the pointer.
  const overCanvas = (e) => {
    const t = e.target;
    if (t && t.closest && t.closest('#help-tab, #endcard, button, #loading')) return false;
    const r = rectOf();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };
  function hideReticle() {
    aim.shown = false; retTarget = 0; ring.visible = false; ring.material.opacity = 0;
  }
  function updateAim(cssX, cssY) {
    const ndc = cssToNdc(cssX, cssY), gp = H.groundAt(ndc.x, ndc.y);
    aim.ndc = ndc;
    if (!gp) { hideReticle(); return null; }   // past the page edge / over the letterbox: no stale ring
    aim.valid = true; aim.shown = true; aim.point.set(gp.x, .055, gp.z);
    if (Math.hypot(gp.x - lastX, gp.z - lastZ) > .35) {
      lastX = gp.x; lastZ = gp.z;
      ring.rotation.z = (Math.abs(Math.sin(gp.x * 12.9898 + gp.z * 78.233) * 43758.5453) % 1) * TAU;
    }
    ring.position.copy(aim.point);
    GUN.aimAt(aim.point);
    retTarget = done ? 0 : 1;
    return aim.point;
  }
  addEventListener('pointermove', (e) => {
    if (!overCanvas(e)) { pointer.inside = false; hideReticle(); return; }
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
    updateAim(e.clientX, e.clientY);
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!overCanvas(e)) return;
    e.stopImmediatePropagation();   // the harness may not start a drag or fold the page under a shot
    e.preventDefault();
    H.sound?.unlock();
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
    aim.ndc = cssToNdc(e.clientX, e.clientY);
    updateAim(e.clientX, e.clientY);
    fireAtPx(e.clientX, e.clientY, e.pointerType !== 'mouse');   // a touch gets the bright reticle flash at its point
  }, { capture: true });
  addEventListener('pointercancel', () => { pointer.inside = false; hideReticle(); }, { passive: true });
  addEventListener('blur', () => { pointer.inside = false; hideReticle(); });

  resetRound();
  return {
    ver: 2,
    get seed() { return seed; },
    state: () => ({ score, best, streak, timeLeft: +timeLeft().toFixed(2), done, running: started && !done }),
    targets: () => {
      camera.updateMatrixWorld();
      return pool.map((t) => {
        const s = targetScreen(t);
        return { id: t.id, kind: t.kind, points: t.award ?? t.k.points, x: +t.x.toFixed(2), z: +t.z.toFixed(2), standing: t.standing,
          starter: t.starter, scale: +t.scale.toFixed(2), screen: [Math.round(s.screen[0]), Math.round(s.screen[1])], hit: t.hit,
          row: t.row ?? 0, bonus: !!t.bonus };
      });
    },
    probe: () => {
      const r = rectOf();
      const ret = pointer.inside && aim.shown && !done
        ? { x: +aim.point.x.toFixed(3), y: +aim.point.y.toFixed(3), z: +aim.point.z.toFixed(3) } : null;
      return { canvas: [r.left, r.top, r.width, r.height], standing: pool.filter((t) => t.standing).length, popups: livePops,
        reticle: ret, gun: { ...GUN.state(), muzzleScreen: GUN.muzzleScreen() },
        pointer: { x: Math.round(pointer.x), y: Math.round(pointer.y), inside: pointer.inside, ndc: { x: +aim.ndc.x.toFixed(3), y: +aim.ndc.y.toFixed(3) } },
        targets: pool.filter((t) => t.standing).map((t) => { const s = targetScreen(t); return { id: t.id, kind: t.kind, points: t.award, row: t.row, bonus: t.bonus, screen: s.screen.map(Math.round), radius: +s.radius.toFixed(1) }; }) };
    },
    shootAt: (cssX, cssY) => {
      pointer.x = cssX; pointer.y = cssY; pointer.inside = true;
      updateAim(cssX, cssY);
      return fireAtPx(cssX, cssY);
    },
    // the mobile readout for the main session's stepped tests (additive; also window.__pfMobile): the portrait rail's
    // chosen spacing and safe spot pool, the target scale and the projected height of every standing target in CSS px,
    // and the toy gun's live size/visibility. Desktop reports mobile:false with the authored values.
    mobile: () => {
      camera.updateMatrixWorld();
      const up = pool.filter((t) => t.standing);
      const px = (t) => Math.round(Math.abs(project(t.x, (t.baseY ?? railBase) + t.k.h * t.scale, t.z)[1] - project(t.x, t.baseY ?? railBase, t.z)[1]));
      const tap = (t) => Math.round(targetScreen(t).radius * 2);
      return { mobile: MOBILE, portrait: PORTRAIT, dist: +H.view.dist.toFixed(2), railGap, spots: spots.map((s) => +s.x.toFixed(2)),
        // portrait cabinet readout: three rows, the award ladder, the standing cap, the sliding can and the flurry.
        // Desktop reports rows 1, no row values and a null slider, so a wide page keeps its authored shape.
        rows: PGP ? 3 : 1,
        rowValues: PGP ? [10, 15, 25] : null,
        standingCap: PGP ? 8 : spots.length,
        rowSpots: PGP ? spots.map((s) => ({ x: +s.x.toFixed(2), z: +s.z.toFixed(2), y: +(s.y ?? railBase).toFixed(2), row: s.row, value: s.value, slide: !!s.slide })) : null,
        sliding: PGP ? { active: !!(slider && slider.standing), id: slider ? slider.id : null, x: slider ? +slider.x.toFixed(2) : null, row: 1, value: 15,
          lane: sliderSpot && sliderSpot.slide ? [+sliderSpot.slide.a.toFixed(2), +sliderSpot.slide.b.toFixed(2)] : null } : null,
        flurry: { active: flurryAt >= 0, stars: flurryStars },
        targetScale: +TSCALE.toFixed(2),
        // minCardPx: the shortest standing card's printed height; minTapPx: the smallest tap circle (the hit test is
        // targetScreen.radius, so a card reads as a comfortable thumb target even when it is a wide, short pie tin).
        minCardPx: up.length ? Math.min(...up.map(px)) : null,
        minTapPx: up.length ? Math.min(...up.map(tap)) : null,
        minTargetPx: up.length ? Math.min(...up.map(tap)) : null, standing: up.length,
        targets: up.map((t) => ({ kind: t.kind, row: t.row, points: t.award, bonus: t.bonus, px: px(t), tap: tap(t), screen: targetScreen(t).screen.map(Math.round) })),
        gun: GUN.state(), gunHidden: GUN.hidden(), flash: retFlash > 0, reticleOpacity: +ring.material.opacity.toFixed(2),
        muzzle: !!document.getElementById('muzzle') };
    },
    newRound, toast,
  };
})();
window.__paperfair = GAME;
window.__pfMobile = GAME.mobile;   // additive portrait-rail / target-px / gun readout: see GAME.mobile()
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
