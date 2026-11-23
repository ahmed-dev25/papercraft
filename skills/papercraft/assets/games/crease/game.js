// crease / game.js — a paper folding puzzle, phase 1.
//
// The page is the world: a naturalist's plate with a die-cut card and a shaped window cut through to a deep teal layer.
// The card is a stack of faces derived from an ordered list of folds (see geometry.js). Drag a flap across its crease;
// the flap turns about the crease (foreshortened by cos, kraft back after 90) and lands flat. The folded silhouette
// must match the window at the same scale. Everything is seeded; no wall-clock decisions.

import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { PaperSound } from 'papercraft/lib/paper-sound.js';
import { LEVELS } from './levels.js';
import * as G from './geometry.js';
import { buildCardArt } from './prints.js';

const PI = Math.PI, TAU = PI * 2;
const QP = new URLSearchParams(location.search);
const SEED_P = parseInt(QP.get('seed'), 10);
const SEED = Number.isFinite(SEED_P) ? SEED_P : 7;
const LEVEL_P = parseInt(QP.get('level'), 10);
const START_LEVEL = Number.isFinite(LEVEL_P) ? Math.max(1, Math.min(LEVELS.length, LEVEL_P)) : 1;
const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const CAPTURE = QP.has('capture');
const COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
// a level deep link (and the capture harness) goes straight to the page; the book opens on the cover otherwise
const START_ON_TITLE = !Number.isFinite(LEVEL_P) && !CAPTURE;

// the printed marginalia, in the book's own voice
const PLATE_NOTES = {
  1: 'The right wing is carried over the body and the seam printed a little off the centre, so a narrow margin of the upper surface stays face up.',
  2: 'The wing bar turns down first; the right half then folds over it, leaving the long body bare and the left wing doubled on the page.',
  3: 'The midrib is creased first, then the overhanging tip is turned back beneath itself until the two veins meet at the point.',
  4: 'The wing is printed wide of the body; carried in, its shadow lies along the breast and the bird stands at rest.',
  5: 'The chimney is printed on the fold; turned down it lies on the roof, its tip tucked under the ridge.',
  6: 'The rudder folds across the transom; the little overhang is turned back beneath the keel.',
  7: 'The fletching is printed beyond the shaft; folded in, its barb is tucked behind the nock.',
  8: 'The chin is scored below the muzzle; lifted, the small whisker tucks under the jaw.',
  9: 'The needle is printed past the south point; folded up, its tip is tucked beneath the rose.',
  10: 'The ribbon is scored at the shield\u2019s edge; turned over, its tail tucks beneath the crest.',
};

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = document.getElementById('ui');
const playUI = document.getElementById('play-ui');
const hud = document.getElementById('hud');
const pageNum = document.getElementById('page-num');
const foldCount = document.getElementById('fold-count');
const dotsEl = document.getElementById('dots');
const plateEl = document.getElementById('plate');
const captionEl = document.getElementById('caption');
const hintEl = document.getElementById('hint');
const toolsEl = document.getElementById('tools');
const crumbsEl = document.getElementById('crumbs');
const crumbText = document.getElementById('crumb-text');
const crumbFill = document.getElementById('crumb-fill');
const unfoldBtn = document.getElementById('unfold');
const restartBtn = document.getElementById('restart');
const nextBtn = document.getElementById('next');
const coverEl = document.getElementById('cover');
const coverSpecimenEl = document.getElementById('cover-specimen');
const openBtn = document.getElementById('open-book');
const endEl = document.getElementById('end');
const endGrid = document.getElementById('end-grid');
const endStats = document.getElementById('end-stats');
const againBtn = document.getElementById('again');
const toCoverBtn = document.getElementById('to-cover');
const loading = document.getElementById('loading');

// DOM: the three progress dots
const dots = [];
for (let i = 0; i < LEVELS.length; i++) {
  const d = document.createElement('span');
  d.className = 'dot';
  d.setAttribute('aria-hidden', 'true');
  dots.push(d);
  dotsEl.appendChild(d);
}
dotsEl.setAttribute('role', 'img');
dotsEl.setAttribute('aria-label', 'page progress');

let screen = START_ON_TITLE ? 'title' : 'play';
let complete = false;
const solvedPages = new Set();
const plateFolds = new Map();
let bookOpenedAt = 0;
let finishedAt = 0;
let turn = null;

let levelIndex = START_LEVEL - 1;
let currentLevel = LEVELS[levelIndex];
let folds = [];
let anim = null;
let seat = null;
let solved = false;
let lastEval = null;
let layout = null;
let viewW = 1, viewH = 1;
let dpr = 1;
let manual = false;
let dirty = true;
let hintFaded = false;
let dragging = null;
let pendingUnfold = null;
let activePointer = null;
let sfx = null;
let acc = 0;
let lastFrame = 0;
let started = false;

const artCache = new Map();
let pageSheet = null, cardFrontSheet = null, cardBackSheet = null, tealSheet = null, coverSheet = null;
let pagePattern = null, tealPattern = null, coverPattern = null;

const sceneRng = P2.rng((SEED * 2654435761) >>> 0);

// ---------------------------------------------------------------------------------------------------------------
// tiny helpers
// ---------------------------------------------------------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function easeOutBack(u, c1 = 1.7) {
  const t = clamp(u, 0, 1), c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function localPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function rectOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
function isShown(el) { return !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none'); }

// ---------------------------------------------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------------------------------------------
function boot() {
  try {
    pageSheet = P2.paperSheet({ size: 512, color: '#efe0c2', seed: SEED * 3 + 1, fibres: 1.15, mottle: 0.065, grain: 0.035, tooth: 0.06 });
    cardFrontSheet = P2.paperSheet({ size: 384, color: '#f4e6c8', seed: SEED * 3 + 2, fibres: 1.0, mottle: 0.05, grain: 0.03, tooth: 0.05 });
    cardBackSheet = P2.paperSheet({ size: 384, color: '#c7a16b', seed: SEED * 3 + 3, fibres: 1.6, mottle: 0.095, grain: 0.03, tooth: 0.07 });
    tealSheet = P2.paperSheet({ size: 256, color: '#1d4044', seed: SEED * 3 + 4, fibres: 1.4, mottle: 0.10, grain: 0.04, tooth: 0.06 });
    coverSheet = P2.paperSheet({ size: 256, color: '#2b1f16', seed: SEED * 3 + 5, fibres: 1.15, mottle: 0.075, grain: 0.03, tooth: 0.055 });
    pagePattern = ctx.createPattern(pageSheet, 'repeat');
    tealPattern = ctx.createPattern(tealSheet, 'repeat');
    coverPattern = ctx.createPattern(coverSheet, 'repeat');
    try { sfx = new PaperSound({ spacing: 0.55, volume: 0.8 }); } catch { sfx = null; }

    resizeCanvas();
    loadLevel(START_LEVEL, { initial: true });
    buildEndGrid();
    applyScreenVisibility();
    computeLayout();
    applyScreenLayout();
    updateHud();
    if (CAPTURE) { hintEl.style.display = 'none'; }
    requestAnimationFrame(frame);
    if (loading) loading.remove();
    started = true;
    render();
  } catch (err) {
    showError(err);
    throw err;
  }
}

function showError(err) {
  const msg = err && err.message ? err.message : String(err);
  let box = document.getElementById('loading');
  if (!box) {
    box = document.createElement('div');
    box.id = 'loading';
    box.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#efe0c2;z-index:99';
    document.body.appendChild(box);
  }
  box.style.display = 'flex';
  box.innerHTML = `<div class="loading-sheet">the plate could not be printed: ${msg.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</div>`;
}

window.addEventListener('error', (e) => { if (!started) showError(e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { if (!started) showError(e.reason || 'unknown error'); });

// ---------------------------------------------------------------------------------------------------------------
// level + state
// ---------------------------------------------------------------------------------------------------------------
function loadLevel(n, { initial = false } = {}) {
  levelIndex = clamp(n, 1, LEVELS.length) - 1;
  currentLevel = LEVELS[levelIndex];
  folds = [];
  anim = null;
  seat = null;
  solved = false;
  lastEval = null;
  dragging = null;
  pendingUnfold = null;
  hintFaded = false;
  ensureArt(currentLevel);
  resizeCanvas();
  computeLayout();
  lastEval = G.evaluate(currentLevel, folds);
  setHint(currentLevel.hint);
  hintEl.classList.remove('faded');
  if (CAPTURE) hintEl.style.display = 'none';
  updateHud();
  syncButtons();
  updateUrl();
  dirty = true;
  if (!initial) render();
}

function setHint(text) {
  hintEl.replaceChildren();
  const tag = document.createElement('span');
  tag.className = 'hint-tag';
  tag.textContent = text;
  hintEl.appendChild(tag);
}

function ensureArt(level) {
  if (artCache.has(level.id)) return;
  const art = buildCardArt(level, {
    frontSheet: cardFrontSheet,
    backSheet: cardBackSheet,
    seed: SEED,
    pxPerUnit: 300,
  });
  artCache.set(level.id, art);
}

function resetLevel() {
  folds = [];
  anim = null;
  seat = null;
  solved = false;
  dragging = null;
  pendingUnfold = null;
  hintFaded = false;
  setHint(currentLevel.hint);
  hintEl.classList.remove('faded');
  if (CAPTURE) hintEl.style.display = 'none';
  lastEval = G.evaluate(currentLevel, folds);
  updateHud();
  syncButtons();
  dirty = true;
}

function markSolved() {
  if (!solvedPages.has(currentLevel.id)) {
    solvedPages.add(currentLevel.id);
    plateFolds.set(currentLevel.id, folds.length);
  }
  if (solvedPages.size >= LEVELS.length) {
    complete = true;
    if (!finishedAt) finishedAt = Date.now();
  }
}

function startSeat() {
  solved = true;
  markSolved();
  seat = { t: 0, dur: REDUCED ? 0.012 : 0.95, done: false, stampT: 0, stampDone: false };
  hintEl.classList.add('faded');
  if (REDUCED) { seat.t = seat.dur; seat.done = true; seat.stampT = 0.25; seat.stampDone = true; }
  updateHud();
  dirty = true;
  publishLayout();
}

function updateHud() {
  pageNum.textContent = `page ${levelIndex + 1} of ${LEVELS.length}`;
  foldCount.textContent = `folds ${folds.length}`;
  dots.forEach((d, i) => {
    d.classList.toggle('on', i === levelIndex);
    d.classList.toggle('done', solvedPages.has(LEVELS[i].id) || i < levelIndex || (i === levelIndex && solved));
  });
  dotsEl.setAttribute('aria-label', `page ${levelIndex + 1} of ${LEVELS.length}`);
  plateEl.replaceChildren();
  const plateNo = document.createElement('span');
  plateNo.className = 'plate-no';
  plateNo.textContent = `plate ${currentLevel.page}`;
  const plateTitle = document.createElement('span');
  plateTitle.className = 'plate-title';
  plateTitle.textContent = currentLevel.title;
  plateEl.append(plateNo, plateTitle);
  captionEl.textContent = solved ? 'the specimen, folded' : 'the shape to make';
  const last = levelIndex === LEVELS.length - 1;
  nextBtn.textContent = last ? 'see the menagerie' : 'next page';
  nextBtn.setAttribute('aria-label', last ? 'see the menagerie' : 'go to the next page');
  if (crumbText) {
    crumbText.textContent = complete ? 'the menagerie is complete' : `folded ${solvedPages.size} of ${LEVELS.length}`;
    if (crumbFill) crumbFill.style.width = `${Math.round(100 * solvedPages.size / LEVELS.length)}%`;
  }
  if (solved || hintFaded) hintEl.classList.add('faded');
  syncButtons();
}

function syncButtons() {
  const busy = !!anim || !!(seat && !seat.done);
  unfoldBtn.disabled = !folds.length || solved || busy;
  restartBtn.disabled = false;
  nextBtn.classList.toggle('show', !!(solved && seat && seat.done));
  updateButtonRects();
  publishLayout();
}

function updateButtonRects() {
  if (!layout) return;
  layout.buttons = {
    unfold: rectOf(unfoldBtn),
    restart: rectOf(restartBtn),
    next: nextBtn.classList.contains('show') ? rectOf(nextBtn) : null,
  };
  layout.plate = rectOf(plateEl);
  layout.caption = rectOf(captionEl);
  layout.hint = rectOf(hintEl);
}

function updateUrl() {
  try {
    const u = new URL(location.href);
    u.searchParams.set('seed', String(SEED));
    if (screen === 'play') u.searchParams.set('level', String(levelIndex + 1));
    else u.searchParams.delete('level');
    history.replaceState(null, '', u);
  } catch { /* file:// or a restricted history: the game still works */ }
}

// ---------------------------------------------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------------------------------------------
function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  viewW = Math.max(1, r.width || window.innerWidth || 1);
  viewH = Math.max(1, r.height || window.innerHeight || 1);
  const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.max(1, Math.round(viewW * nextDpr));
  const H = Math.max(1, Math.round(viewH * nextDpr));
  if (canvas.width !== W || canvas.height !== H || dpr !== nextDpr) {
    canvas.width = W;
    canvas.height = H;
    dpr = nextDpr;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  pagePattern = pageSheet ? ctx.createPattern(pageSheet, 'repeat') : null;
  tealPattern = tealSheet ? ctx.createPattern(tealSheet, 'repeat') : null;
  coverPattern = coverSheet ? ctx.createPattern(coverSheet, 'repeat') : null;
}

function reachBBox(level) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const eat = (poly) => {
    for (const [x, y] of poly) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  };
  eat(level.sheet);
  for (let i = 1; i <= level.solution.length; i++) {
    const s = G.deriveState(level, level.solution.slice(0, i));
    if (s) for (const f of s.faces) eat(f.poly);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function safeInsets() {
  const el = document.getElementById('safe-area');
  if (!el) return { l: 0, r: 0, t: 0, b: 0 };
  const cs = getComputedStyle(el);
  const n = (v) => parseFloat(v) || 0;
  return { l: n(cs.paddingLeft), r: n(cs.paddingRight), t: n(cs.paddingTop), b: n(cs.paddingBottom) };
}

function computeLayout() {
  const W = viewW, H = viewH;
  const mobile = W < 760;
  const base = mobile ? 12 : Math.max(22, Math.min(42, H * 0.04));
  const ins = safeInsets();
  const left = Math.max(base, ins.l + 8);
  const right = Math.max(base, ins.r + 8);
  const top = Math.max(base, ins.t + 8);
  const bottom = Math.max(base, ins.b + 8);
  let pageH = H - top - bottom;
  let pageW = mobile ? W - left - right : Math.min(620, pageH * 0.76);
  pageW = Math.min(pageW, W - left - right);
  pageH = Math.min(pageH, H - top - bottom);
  const pageX = left + (W - left - right - pageW) / 2;
  const pageY = top + (H - top - bottom - pageH) / 2;

  const hudH = mobile ? 38 : 42;
  const winW = pageW - (mobile ? 54 : 96);
  const winH = pageH * (mobile ? 0.265 : 0.32);
  const winX = pageX + (pageW - winW) / 2;
  const winY = pageY + hudH + 38;

  const toolsH = mobile ? 78 : 64;
  const toolsY = pageY + pageH - toolsH;
  const cardTop = winY + winH + (mobile ? 30 : 32);
  const cardBottom = toolsY - (mobile ? 36 : 34);
  const cardW = pageW - (mobile ? 34 : 80);
  const cardH = Math.max(48, cardBottom - cardTop);

  const tb = G.bbox(currentLevel.target);
  const cb = G.bbox(currentLevel.sheet);
  const rb = reachBBox(currentLevel);
  let scale = Math.min(winW / tb.w, winH / tb.h, cardW / rb.w, cardH / rb.h);
  scale = Math.max(4, scale * 0.96);

  const winRect = { w: tb.w * scale, h: tb.h * scale, x: 0, y: 0 };
  winRect.x = winX + (winW - winRect.w) / 2;
  winRect.y = winY + (winH - winRect.h) / 2;

  const cardAreaX = pageX + (pageW - cardW) / 2;
  const cardAreaCX = cardAreaX + cardW / 2;
  const cardAreaCY = cardTop + cardH / 2;
  const cardOrigin = [cardAreaCX - rb.cx * scale, cardAreaCY + rb.cy * scale];
  const cardRect = { w: cb.w * scale, h: cb.h * scale, x: 0, y: 0 };
  cardRect.x = cardOrigin[0] + cb.x0 * scale;
  cardRect.y = cardOrigin[1] - cb.y1 * scale;

  const targetOrigin = [
    winRect.x + winRect.w / 2 - tb.cx * scale,
    winRect.y + winRect.h / 2 + tb.cy * scale,
  ];

  // the printed note block sits in the empty band under the card, never on it
  const noteW = Math.min(pageW - (mobile ? 86 : 140), mobile ? 250 : 480);
  const noteX = pageX + (mobile ? 28 : 32);
  const noteTop = cardRect.y + cardRect.h + 14;
  const noteBottom = Math.min(toolsY - (mobile ? 56 : 42), pageY + pageH - (mobile ? 64 : 50));
  const note = {
    x: noteX,
    y: noteTop,
    w: noteW,
    h: Math.max(0, noteBottom - noteTop),
    text: PLATE_NOTES[currentLevel.id] || '',
  };

  const pr = P2.rng((SEED * 17 + 3) >>> 0);
  const pageOutline = pageDeckle(pageX, pageY, pageW, pageH, pr);
  const ornament = ornamentPoly(pageX + pageW - (mobile ? 30 : 34), pageY + pageH - (mobile ? 44 : 48), mobile ? 11 : 13);
  const windowPoly = currentLevel.target.map(([x, y]) => [targetOrigin[0] + x * scale, targetOrigin[1] - y * scale]);

  const tealX = Math.min(winRect.x, pageX + pageW - 80) - 46;
  const tealY = Math.min(winRect.y, pageY + pageH - 120) - 46;
  const tealR = pageX + pageW;
  const tealB = pageY + pageH;
  const tealRect = {
    x: Math.max(-20, tealX),
    y: Math.max(-20, tealY),
    w: tealR - Math.max(-20, tealX) + 20,
    h: tealB - Math.max(-20, tealY) + 20,
  };
  const stars = [];
  const sr = P2.rng((SEED * 31 + 7) >>> 0);
  for (let y = tealRect.y + 12; y < tealRect.y + tealRect.h; y += 24) {
    for (let x = tealRect.x + 12; x < tealRect.x + tealRect.w; x += 24) {
      if (sr() < 0.58) {
        stars.push({
          x: x + (sr() - 0.5) * 14,
          y: y + (sr() - 0.5) * 14,
          r: 1.4 + sr() * 2.8,
          a: 0.12 + sr() * 0.22,
          c: sr() < 0.7 ? '#3f6c68' : '#c9b78f',
        });
      }
    }
  }

  const fringe = [];
  const fr = P2.rng((SEED * 13 + 9) >>> 0);
  const topCount = Math.min(26, Math.floor(pageW / 14));
  for (let i = 0; i < topCount; i++) {
    const t = 0.06 + fr() * 0.88;
    const x = pageX + pageW * t;
    const y = pageY + Math.sin(t * PI * 2.3 + 1.2) * 1.8 + (fr() - 0.5) * 1.2;
    fringe.push({ x, y, dx: (fr() - 0.5) * 4, dy: -(2 + fr() * 6), c: fr() < 0.55 ? 'rgba(248,238,212,.38)' : 'rgba(93,66,40,.26)' });
  }

  const specimenSide = W - (pageX + pageW);
  const specimenLeft = pageX;
  let specimen = null;
  if (!mobile) {
    const side = Math.max(specimenSide, specimenLeft);
    const sw = Math.min(176, side - 72);
    const sh = Math.min(520, pageH * 0.68);
    if (sw >= 96) {
      specimen = {
        x: specimenSide >= specimenLeft ? pageX + pageW + (specimenSide - sw) / 2 : pageX - sw - (specimenLeft - sw) / 2,
        y: pageY + (pageH - sh) / 2,
        w: sw,
        h: sh,
      };
    }
  }

  layout = {
    viewport: { w: W, h: H },
    dpr,
    mobile,
    page: { x: pageX, y: pageY, w: pageW, h: pageH },
    window: { x: winRect.x, y: winRect.y, w: winRect.w, h: winRect.h },
    card: { x: cardRect.x, y: cardRect.y, w: cardRect.w, h: cardRect.h },
    cardNow: { x: cardRect.x, y: cardRect.y, w: cardRect.w, h: cardRect.h },
    tools: { x: pageX + 18, y: toolsY, w: pageW - 36, h: toolsH },
    buttons: {},
    plate: { x: pageX, y: winRect.y - (mobile ? 28 : 46), w: pageW, h: mobile ? 16 : 34 },
    caption: { x: pageX, y: winRect.y + winRect.h + 10, w: pageW, h: 22 },
    hint: { x: pageX + 20, y: toolsY - 6, w: pageW - 40, h: 34 },
    note,
    foot: { x: pageX, y: pageY + pageH - (mobile ? 16 : 10), w: pageW, h: 12 },
    specimen,
    scale,
    targetOrigin,
    cardOrigin,
    windowPoly,
    pageOutline,
    ornamentPoly: ornament,
    tealRect,
    stars,
    fringe,
    pageX, pageY, pageW, pageH,
    winX, winY, winW, winH, winRect,
    cardRect, cardOriginX: cardOrigin[0], cardOriginY: cardOrigin[1],
    solved,
    seated: !!(solved && seat && seat.done),
  };

  // DOM placement
  hud.style.left = `${pageX + 22}px`;
  hud.style.top = `${pageY + 14}px`;
  hud.style.width = `${pageW - 44}px`;
  plateEl.style.left = `${pageX}px`;
  plateEl.style.top = `${winRect.y - (mobile ? 28 : 46)}px`;
  plateEl.style.width = `${pageW}px`;
  captionEl.style.left = `${pageX}px`;
  captionEl.style.top = `${winRect.y + winRect.h + 10}px`;
  captionEl.style.width = `${pageW}px`;
  hintEl.style.left = `${pageX + 20}px`;
  hintEl.style.top = `${toolsY - 6}px`;
  hintEl.style.width = `${pageW - 40}px`;
  crumbsEl.style.left = `${pageX + 22}px`;
  crumbsEl.style.top = `${pageY + 29}px`;
  crumbsEl.style.width = `${pageW - 44}px`;
  toolsEl.style.left = `${pageX + 18}px`;
  toolsEl.style.top = `${toolsY}px`;
  toolsEl.style.width = `${pageW - 36}px`;
  toolsEl.style.height = `${toolsH}px`;

  updateButtonRects();
  publishLayout();
  dirty = true;
}

function publishLayout() {
  if (!layout) return;
  layout.solved = solved;
  layout.seated = !!(solved && seat && seat.done);
  if (window.__crease) window.__crease.layout = layout;
}

// ---------------------------------------------------------------------------------------------------------------
// screens: cover, play, completion
// ---------------------------------------------------------------------------------------------------------------
function applyScreenVisibility() {
  const play = screen === 'play';
  if (playUI) playUI.hidden = !play;
  if (coverEl) coverEl.hidden = screen !== 'title';
  if (endEl) endEl.hidden = screen !== 'end';
  if (canvas) canvas.style.cursor = play ? '' : 'default';
}

function applyScreenLayout() {
  if (!layout) return;
  const p = layout.page;
  for (const el of [coverEl, endEl]) {
    if (!el) continue;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.width = `${p.w}px`;
    el.style.height = `${p.h}px`;
  }
}

function setScreen(next) {
  const s = next === 'title' || next === 'end' ? next : 'play';
  if (s === 'play' && !bookOpenedAt) bookOpenedAt = Date.now();
  screen = s;
  applyScreenVisibility();
  computeLayout();
  applyScreenLayout();
  if (s === 'end') {
    for (const lv of LEVELS) {
      solvedPages.add(lv.id);
      if (!plateFolds.has(lv.id)) plateFolds.set(lv.id, lv.par);
    }
    complete = true;
    if (!finishedAt) finishedAt = Date.now();
    buildEndGrid();
    updateEndStats();
  }
  updateHud();
  updateUrl();
  dirty = true;
  render();
}

function formatTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function buildEndGrid() {
  if (!endGrid || endGrid.childElementCount) return;
  for (const lv of LEVELS) {
    const tb = G.bbox(lv.target);
    const sc = 88 / Math.max(tb.w, tb.h);
    const pts = lv.target.map(([x, y]) => `${(50 + (x - tb.cx) * sc).toFixed(2)},${(50 - (y - tb.cy) * sc).toFixed(2)}`).join(' ');
    const cell = document.createElement('div');
    cell.className = 'end-cell';
    cell.setAttribute('role', 'listitem');
    cell.setAttribute('aria-label', `plate ${lv.page}, ${lv.title}`);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    shadow.setAttribute('points', pts);
    shadow.setAttribute('transform', 'translate(1.7,1.7)');
    shadow.setAttribute('fill', 'rgba(58,39,24,.16)');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', '#f4e6c8');
    poly.setAttribute('stroke', '#3a2718');
    poly.setAttribute('stroke-width', '1.3');
    poly.setAttribute('stroke-linejoin', 'round');
    svg.append(shadow, poly);
    const no = document.createElement('span');
    no.className = 'end-cell-no';
    no.textContent = lv.page;
    cell.append(svg, no);
    endGrid.append(cell);
  }
}

function updateEndStats() {
  if (!endStats) return;
  let total = 0;
  for (const v of plateFolds.values()) total += v;
  if (!total) for (const lv of LEVELS) total += lv.par;
  const secs = finishedAt && bookOpenedAt ? (finishedAt - bookOpenedAt) / 1000 : 0;
  endStats.textContent = `${LEVELS.length} plates · ${total} folds${secs > 0 ? ` · ${formatTime(secs)}` : ''}`;
}

function resetRun() {
  solvedPages.clear();
  plateFolds.clear();
  complete = false;
  finishedAt = 0;
  bookOpenedAt = Date.now();
  levelIndex = 0;
}

function startTurn() {
  if (REDUCED) { turn = null; return; }
  turn = { t: 0, dur: 0.36 };
}

function openBook() {
  unlockAudio();
  if (complete || solvedPages.size >= LEVELS.length) {
    resetRun();
    loadLevel(1);
  }
  bookOpenedAt = bookOpenedAt || Date.now();
  setScreen('play');
  startTurn();
  manual = false;
  render();
}

function startAgain() {
  unlockAudio();
  resetRun();
  loadLevel(1);
  setScreen('play');
  startTurn();
  manual = false;
  render();
}

function goCover() {
  unlockAudio();
  turn = null;
  setScreen('title');
  manual = false;
  render();
}

function finishHook() {
  for (const lv of LEVELS) {
    solvedPages.add(lv.id);
    if (!plateFolds.has(lv.id)) plateFolds.set(lv.id, lv.par);
  }
  complete = true;
  if (!bookOpenedAt) bookOpenedAt = Date.now();
  finishedAt = Date.now();
  setScreen('end');
  return state();
}

function pageDeckle(x, y, w, h, r) {
  const pts = [];
  const n = 54;
  const ph1 = r() * TAU, ph2 = r() * TAU, ph3 = r() * TAU;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const yy = y + Math.sin(u * PI * 2.3 + ph1) * 1.7 + Math.sin(u * PI * 7.1 + ph2) * 0.7 + (r() - 0.5) * 1.15;
    pts.push([x + w * u, yy]);
  }
  for (let i = 1; i <= 9; i++) pts.push([x + w + (r() - 0.5) * 1.2, y + h * i / 9]);
  for (let i = 1; i <= 16; i++) pts.push([x + w * (1 - i / 16), y + h + (r() - 0.5) * 1.1]);
  for (let i = 1; i < 9; i++) pts.push([x + (r() - 0.5) * 1.2, y + h * (1 - i / 9)]);
  return pts;
}

function ornamentPoly(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU - PI / 2;
    const rr = i % 2 ? r * 0.62 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

// ---------------------------------------------------------------------------------------------------------------
// drawing helpers
// ---------------------------------------------------------------------------------------------------------------
function addPolyPath(path, pts) {
  if (!pts || pts.length < 3) return;
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
}
function polyPath(pts) {
  const p = new Path2D();
  addPolyPath(p, pts);
  return p;
}

/** Add a polygon with a consistent winding, so overlapping faces union in the shadow rather than cancel. */
function addOrientedPoly(path, pts) {
  if (!pts || pts.length < 3) return;
  const area = G.polyArea(pts);
  if (area >= 0) addPolyPath(path, pts);
  else addPolyPath(path, pts.slice().reverse());
}

function drawCutEdges(poly, {
  hole = false, light = [-0.55, 0.83], dark = 'rgba(74,44,26,.82)', pale = 'rgba(246,231,198,.55)',
  width = 2, paleWidth = 1.1, paleOffset = 1.5, skip = null, eps = null,
} = {}) {
  const scale = layout ? layout.scale : 1;
  const edgeEps = eps == null ? 0.3 / Math.max(1, scale) : eps;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    if (skip && skip(p, q)) continue;
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    let nx = dy / len, ny = -dx / len;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const inside = G.pointInPoly([mx + nx * edgeEps, my + ny * edgeEps], poly);
    if (!inside) { nx = -nx; ny = -ny; }
    // nx,ny points into the polygon (the hole's air, or the solid's paper). The material is the other side for a hole.
    const imx = hole ? -nx : nx, imy = hole ? -ny : ny;
    const cnx = -imx, cny = -imy;
    const lit = cnx * light[0] + cny * light[1] > 0.10;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (lit) {
      ctx.strokeStyle = pale;
      ctx.lineWidth = paleWidth;
      ctx.beginPath();
      ctx.moveTo(p[0] + imx * paleOffset, p[1] + imy * paleOffset);
      ctx.lineTo(q[0] + imx * paleOffset, q[1] + imy * paleOffset);
      ctx.stroke();
    }
    ctx.strokeStyle = dark;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
    ctx.restore();
  }
}

function pathContainsEdgeOnSheet(p, q, inv) {
  if (!currentLevel) return false;
  const op = G.matApply(inv, p), oq = G.matApply(inv, q);
  const mid = [(op[0] + oq[0]) / 2, (op[1] + oq[1]) / 2];
  if (G.distToPolyEdge(mid, currentLevel.sheet) > 0.006) return false;
  // a fold that coincides with the sheet edge (the bar crease) is still a fold, not a cut
  for (const cr of currentLevel.creases) {
    const n = G.norm(G.sub(cr.b, cr.a));
    const d1 = Math.abs(G.cross(n, G.sub(op, cr.a)));
    const d2 = Math.abs(G.cross(n, G.sub(oq, cr.a)));
    if (d1 < 0.008 && d2 < 0.008) return false;
  }
  return true;
}

function applyCardTransform(origin, scale) {
  ctx.setTransform(dpr * scale, 0, 0, -dpr * scale, dpr * origin[0], dpr * origin[1]);
}

function drawFace(face, art, origin, { edges = true, lead = false, crease = null, tone = 1, leadAlpha = 0.62 } = {}) {
  const scale = layout.scale;
  applyCardTransform(origin, scale);
  ctx.save();
  ctx.clip(polyPath(face.poly));
  ctx.save();
  const M = face.M;
  ctx.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
  ctx.translate(art.box.x0, art.box.y1);
  ctx.scale(1 / art.pxPerUnit, -1 / art.pxPerUnit);
  ctx.drawImage(face.side === 'back' ? art.back : art.front, 0, 0);
  ctx.restore();
  if (tone < 0.998) {
    // multiply the printed face toward a warm shadow; never a flat brown veil
    const v = Math.max(0, Math.min(255, Math.round(255 * clamp(tone, 0, 1))));
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${v},${Math.round(v * 0.975)},${Math.round(v * 0.93)})`;
    ctx.fillRect(-100, -100, 200, 200);
  }
  ctx.restore();

  if (!edges) return;
  const inv = G.matInv(M);
  applyCardTransform(origin, scale);
  drawCutEdges(face.poly, {
    hole: false,
    light: [-0.55, 0.83],
    dark: 'rgba(70,42,24,.84)',
    pale: 'rgba(248,233,202,.58)',
    width: 2 / scale,
    paleWidth: 1.1 / scale,
    paleOffset: 1.6 / scale,
    skip: (p, q) => !pathContainsEdgeOnSheet(p, q, inv),
  });

  if (lead && crease) {
    // the edge furthest from the crease is the leading cut edge: a brighter pale lip there
    let best = null;
    for (let i = 0; i < face.poly.length; i++) {
      const p = face.poly[i], q = face.poly[(i + 1) % face.poly.length];
      if (!pathContainsEdgeOnSheet(p, q, inv)) continue;
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      const d = Math.abs(G.cross(G.norm(G.sub(crease[1], crease[0])), G.sub([mx, my], crease[0])));
      if (!best || d > best.d) best = { p, q, d };
    }
    if (best) {
      const dx = best.q[0] - best.p[0], dy = best.q[1] - best.p[1], len = Math.hypot(dx, dy) || 1;
      let nx = dy / len, ny = -dx / len;
      const mx = (best.p[0] + best.q[0]) / 2, my = (best.p[1] + best.q[1]) / 2;
      if (!G.pointInPoly([mx + nx * 0.001, my + ny * 0.001], face.poly)) { nx = -nx; ny = -ny; }
      ctx.save();
      ctx.strokeStyle = `rgba(255,243,214,${leadAlpha})`;
      ctx.lineWidth = 1.1 / scale;
      ctx.lineCap = 'round';
      const off = 2.2 / scale;
      ctx.beginPath();
      ctx.moveTo(best.p[0] + nx * off, best.p[1] + ny * off);
      ctx.lineTo(best.q[0] + nx * off, best.q[1] + ny * off);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// card state + display state
// ---------------------------------------------------------------------------------------------------------------
function cardOriginNow() {
  if (!layout) return [0, 0];
  if (!solved) return layout.cardOrigin;
  if (!seat) return layout.targetOrigin;
  const u = Math.min(1, seat.t / 0.72);
  const e = easeInOut(u);
  const lift = Math.sin(PI * Math.min(1, u)) * (layout.mobile ? 10 : 14);
  const settle = seat.t > 0.72 ? Math.sin(PI * Math.min(1, (seat.t - 0.72) / 0.2)) * 2.2 : 0;
  return [
    lerp(layout.cardOrigin[0], layout.targetOrigin[0], e),
    lerp(layout.cardOrigin[1], layout.targetOrigin[1], e) - lift + settle,
  ];
}

function displayState() {
  const base = G.deriveState(currentLevel, folds);
  if (!base) return { faces: [], flap: null };
  if (!anim) return { faces: base.faces, flap: null };
  if (anim.kind === 'fold') {
    const faces = base.faces.slice(0, -1);
    faces.push({ ...base.top, poly: anim.split.keep, M: anim.parentM, side: anim.parentSide });
    return { faces, flap: flapState() };
  }
  // unfold: the base parent face is whole underneath; the moving flap lies on top
  return { faces: base.faces, flap: flapState() };
}

function flapState() {
  if (!anim) return null;
  const P = G.perpScaleMatrix(anim.a, anim.b, anim.theta);
  const poly = anim.split.flapBefore.map((p) => G.matApply(P, p));
  const M = G.matMul(P, anim.parentM);
  const side = Math.cos(anim.theta) >= 0 ? anim.parentSide : (anim.parentSide === 'front' ? 'back' : 'front');
  return { poly, M, side };
}

function maxDepthOf(poly, a, b) {
  const n = G.leftNormal(a, b);
  let d = 0;
  for (const p of poly) d = Math.max(d, Math.abs(G.dot(G.sub(p, a), n)));
  return d;
}

function availableInfo(id) {
  const c = currentLevel.creases.find((k) => k.id === id);
  if (!c) return null;
  return { crease: c, info: G.creaseOnTop(currentLevel, folds, c) };
}

function startFoldAnim(info, crease, mode = 'settle') {
  const d = maxDepthOf(info.split.flapBefore, info.a, info.b);
  anim = {
    kind: 'fold', id: crease.id, a: info.a, b: info.b, split: info.split,
    parentM: info.top.M, parentSide: info.top.side,
    theta: 0, targetTheta: 0, from: 0, to: PI, t: 0, dur: 0.38,
    mode, maxDepth: d,
  };
  if (mode === 'settle') playFlap(true);
  updateHud();
  dirty = true;
}

function releaseDrag() {
  if (!anim || anim.kind !== 'fold' || anim.mode !== 'drag') return;
  const commit = Math.max(anim.theta, anim.targetTheta) >= PI / 2;
  anim.mode = 'settle';
  anim.from = anim.theta;
  anim.to = commit ? PI : 0;
  anim.t = 0;
  anim.dur = 0.43;
  if (commit) playFlap(true);
  if (REDUCED) finishAnim();
  dirty = true;
}
function beginUnfold() {
  if (anim || (seat && !seat.done) || solved || !folds.length) return false;
  const id = folds[folds.length - 1];
  const crease = currentLevel.creases.find((c) => c.id === id);
  if (!crease) return false;
  const baseFolds = folds.slice(0, -1);
  const info = G.creaseOnTop(currentLevel, baseFolds, crease);
  if (!info.available) return false;
  folds = baseFolds;
  anim = {
    kind: 'unfold', id, a: info.a, b: info.b, split: info.split,
    parentM: info.top.M, parentSide: info.top.side,
    theta: PI, targetTheta: 0, from: PI, to: 0, t: 0, dur: 0.42,
    mode: 'settle', maxDepth: maxDepthOf(info.split.flapBefore, info.a, info.b),
  };
  playFlap(false);
  updateHud();
  dirty = true;
  if (REDUCED) finishAnim();
  return true;
}

function finishAnim() {
  if (!anim) return;
  const a = anim;
  anim = null;
  if (a.kind === 'fold') {
    if (a.to >= PI - 1e-6) {
      folds.push(a.id);
      lastEval = G.evaluate(currentLevel, folds);
      if (lastEval.solved) startSeat();
      else { solved = false; seat = null; }
    }
  } else {
    if (a.to <= 1e-6) {
      solved = false;
      seat = null;
      lastEval = G.evaluate(currentLevel, folds);
    } else {
      // an unfold that was pulled back: keep the fold
      folds.push(a.id);
      lastEval = G.evaluate(currentLevel, folds);
    }
  }
  updateHud();
  syncButtons();
  dirty = true;
}

// ---------------------------------------------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------------------------------------------
function update(dt) {
  if (turn && screen === 'play') {
    turn.t += dt;
    if (turn.t >= turn.dur) turn = null;
    dirty = true;
  }
  if (seat && !seat.done) {
    seat.t += dt;
    if (seat.t >= seat.dur) {
      seat.t = seat.dur;
      seat.done = true;
      updateHud();
      syncButtons();
    }
    dirty = true;
  } else if (seat && seat.done && !seat.stampDone) {
    // the ink stamp is applied a quarter second after the piece has landed
    seat.stampT = Math.min(0.25, (seat.stampT || 0) + dt);
    if (seat.stampT >= 0.25) seat.stampDone = true;
    dirty = true;
  }
  if (anim) {
    if (anim.mode === 'drag') {
      anim.theta += (anim.targetTheta - anim.theta) * Math.min(1, dt * 18);
    } else {
      anim.t += dt;
      const u = Math.min(1, anim.t / anim.dur);
      anim.theta = anim.from + (anim.to - anim.from) * easeOutBack(u);
      if (u >= 1) finishAnim();
    }
    dirty = true;
  }
}

function playFlap(up) {
  if (!sfx || sfx.muted) return;
  try {
    sfx.flap({ size: 0.46, up, seed: (SEED + currentLevel.id * 97 + folds.length * 13) >>> 0 });
  } catch { /* audio is optional */ }
}

// ---------------------------------------------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------------------------------------------
function render() {
  if (!layout) return;
  const W = viewW, H = viewH;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);

  if (screen !== 'play') {
    drawScreenPage();
    if (screen === 'title') drawCoverArt();
    dirty = false;
    return;
  }

  drawSurround(W, H);
  drawPageShadow();
  drawTeal();
  drawPage();
  drawHoleInnerShadows();
  drawSpecimen();
  drawCard();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPageHoleEdges();
  drawSeatMarks();
  drawTurn();
  refreshCardNow();
  dirty = false;
}

/** A bare printed page for the cover and the completion card: no window, the same deckle and cloth. */
function drawScreenPage() {
  const L = layout;
  ctx.save();
  drawSurround(viewW, viewH);

  // a warm reading light on the cloth, then the page
  const warm = ctx.createRadialGradient(L.pageX + L.pageW * 0.5, L.pageY + L.pageH * 0.34, 10, L.pageX + L.pageW * 0.5, L.pageY + L.pageH * 0.42, L.pageW * 0.9);
  warm.addColorStop(0, 'rgba(216,177,112,.12)');
  warm.addColorStop(1, 'rgba(216,177,112,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, viewW, viewH);

  drawPageShadow();
  ctx.save();
  ctx.clip(polyPath(L.pageOutline));
  ctx.fillStyle = pagePattern || '#efe0c2';
  ctx.fillRect(L.pageX - 30, L.pageY - 30, L.pageW + 60, L.pageH + 60);
  const g = ctx.createLinearGradient(L.pageX, L.pageY, L.pageX + L.pageW, L.pageY + L.pageH);
  g.addColorStop(0, 'rgba(255,247,226,.12)');
  g.addColorStop(0.55, 'rgba(255,247,226,0)');
  g.addColorStop(1, 'rgba(105,72,40,.10)');
  ctx.fillStyle = g;
  ctx.fillRect(L.pageX - 20, L.pageY - 20, L.pageW + 40, L.pageH + 40);
  // a printed keyline, clear of the content
  ctx.strokeStyle = 'rgba(58,39,24,.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(L.pageX + 13.5, L.pageY + 13.5, L.pageW - 27, L.pageH - 27);
  ctx.strokeStyle = 'rgba(58,39,24,.09)';
  ctx.strokeRect(L.pageX + 18.5, L.pageY + 18.5, L.pageW - 37, L.pageH - 37);
  if (screen === 'end') {
    ctx.fillStyle = 'rgba(58,39,24,.42)';
    ctx.font = `italic 11.5px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0.16em';
    ctx.fillText('FINIS', L.pageX + L.pageW / 2, L.pageY + L.pageH - 26);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  }
  ctx.restore();

  drawCutEdges(L.pageOutline, {
    hole: false, light: [-0.55, -0.83],
    dark: 'rgba(72,44,26,.72)', pale: 'rgba(248,236,208,.46)',
    width: 1.5, paleWidth: 1.0, paleOffset: 1.4, eps: 0.6,
  });
  for (const f of L.fringe) {
    ctx.strokeStyle = f.c;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(f.x + f.dx * 0.4, f.y + f.dy * 0.5, f.x + f.dx, f.y + f.dy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCoverArt() {
  if (!artCache.has(LEVELS[0].id)) ensureArt(LEVELS[0]);
  const art = artCache.get(1);
  if (!art || !coverSpecimenEl || coverEl.hidden) return;
  const r = rectOf(coverSpecimenEl);
  if (r.w < 8 || r.h < 8) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const labelH = 22;
  const availW = r.w - 12;
  const availH = r.h - labelH - 10;
  const src = art.front;
  const sc = Math.min(availW / src.width, availH / src.height);
  const w = src.width * sc, h = src.height * sc;
  const cx = r.x + r.w / 2, cy = r.y + (r.h - labelH) / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.012);
  ctx.shadowColor = 'rgba(40,24,12,.42)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#f4e6c8';
  ctx.fillRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.drawImage(src, -w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(58,39,24,.38)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2 - 5.5, -h / 2 - 5.5, w + 11, h + 11);
  ctx.strokeStyle = 'rgba(255,248,232,.4)';
  ctx.strokeRect(-w / 2 - 2.5, -h / 2 - 2.5, w + 5, h + 5);
  ctx.restore();
}

function drawTurn() {
  if (!turn) return;
  const L = layout;
  const u = clamp(turn.t / turn.dur, 0, 1);
  const e = easeInOut(u);
  const x = lerp(L.pageX - L.pageW * 0.55, L.pageX + L.pageW * 1.15, e);
  const band = L.pageW * 0.42;
  ctx.save();
  ctx.clip(polyPath(L.pageOutline));
  const g = ctx.createLinearGradient(x - band, 0, x + band, 0);
  g.addColorStop(0, 'rgba(58,39,24,0)');
  g.addColorStop(0.36, 'rgba(58,39,24,.10)');
  g.addColorStop(0.5, 'rgba(58,39,24,.22)');
  g.addColorStop(0.64, 'rgba(58,39,24,.09)');
  g.addColorStop(1, 'rgba(58,39,24,0)');
  ctx.fillStyle = g;
  ctx.fillRect(L.pageX, L.pageY, L.pageW, L.pageH);
  ctx.strokeStyle = 'rgba(255,246,222,.36)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + band * 0.3, L.pageY + 6);
  ctx.lineTo(x + band * 0.3, L.pageY + L.pageH - 6);
  ctx.stroke();
  ctx.restore();
}

function drawSurround(W, H) {
  // a page on a book: deep warm cloth, never a void
  ctx.fillStyle = '#2b1f16';
  ctx.fillRect(0, 0, W, H);
  if (coverPattern) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = coverPattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const g = ctx.createRadialGradient(W * 0.24, H * 0.12, Math.min(W, H) * 0.06, W * 0.5, H * 0.52, Math.max(W, H) * 0.78);
  g.addColorStop(0, 'rgba(118,86,56,.14)');
  g.addColorStop(0.52, 'rgba(43,31,22,0)');
  g.addColorStop(1, 'rgba(14,9,6,.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawPageShadow() {
  const outer = polyPath(layout.pageOutline);
  ctx.save();
  ctx.fillStyle = 'rgba(16,10,6,.52)';
  ctx.shadowColor = 'rgba(8,5,3,.62)';
  ctx.shadowBlur = 30 * dpr;
  ctx.shadowOffsetX = 8 * dpr;
  ctx.shadowOffsetY = 15 * dpr;
  ctx.fill(outer);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(24,15,9,.30)';
  ctx.shadowColor = 'rgba(10,6,4,.48)';
  ctx.shadowBlur = 5 * dpr;
  ctx.shadowOffsetX = 2 * dpr;
  ctx.shadowOffsetY = 3 * dpr;
  ctx.fill(outer);
  ctx.restore();
}

function drawTeal() {
  const t = layout.tealRect;
  ctx.save();
  ctx.clip(polyPath(layout.pageOutline));
  ctx.beginPath();
  ctx.rect(t.x, t.y, t.w, t.h);
  ctx.clip();
  ctx.fillStyle = tealPattern || '#1d4044';
  ctx.fillRect(t.x, t.y, t.w, t.h);
  const g = ctx.createLinearGradient(t.x, t.y, t.x + t.w, t.y + t.h);
  g.addColorStop(0, 'rgba(94,140,130,.18)');
  g.addColorStop(0.5, 'rgba(8,28,30,.06)');
  g.addColorStop(1, 'rgba(4,16,18,.34)');
  ctx.fillStyle = g;
  ctx.fillRect(t.x, t.y, t.w, t.h);
  for (const s of layout.stars) {
    ctx.strokeStyle = P2.rgba(s.c, s.a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x - s.r, s.y); ctx.lineTo(s.x + s.r, s.y);
    ctx.moveTo(s.x, s.y - s.r); ctx.lineTo(s.x, s.y + s.r);
    ctx.stroke();
    if (s.r > 3.2) {
      ctx.beginPath();
      ctx.moveTo(s.x - s.r * 0.55, s.y - s.r * 0.55); ctx.lineTo(s.x + s.r * 0.55, s.y + s.r * 0.55);
      ctx.moveTo(s.x + s.r * 0.55, s.y - s.r * 0.55); ctx.lineTo(s.x - s.r * 0.55, s.y + s.r * 0.55);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPage() {
  const L = layout;
  const pagePath = new Path2D();
  addPolyPath(pagePath, L.pageOutline);
  addPolyPath(pagePath, L.windowPoly);
  addPolyPath(pagePath, L.ornamentPoly);

  ctx.save();
  ctx.clip(pagePath, 'evenodd');
  ctx.fillStyle = pagePattern || '#efe0c2';
  ctx.fillRect(L.pageX - 30, L.pageY - 30, L.pageW + 60, L.pageH + 60);
  const g = ctx.createLinearGradient(L.pageX, L.pageY, L.pageX + L.pageW, L.pageY + L.pageH);
  g.addColorStop(0, 'rgba(255,247,226,.10)');
  g.addColorStop(0.55, 'rgba(255,247,226,0)');
  g.addColorStop(1, 'rgba(105,72,40,.075)');
  ctx.fillStyle = g;
  ctx.fillRect(L.pageX - 20, L.pageY - 20, L.pageW + 40, L.pageH + 40);

  // quiet printed page furniture; no running head, only a foot
  const ink = '#3a2718';
  drawPageFurniture(L, ink);

  if (!L.mobile) {
    ctx.fillStyle = P2.rgba(ink, 0.5);
    ctx.font = `italic 11.5px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`No. ${currentLevel.page}`, L.pageX + L.pageW - 28, L.pageY + L.pageH - 18);
  }
  ctx.restore();

  // the page's cut edge and the torn deckle fringe
  ctx.save();
  drawCutEdges(L.pageOutline, {
    hole: false, light: [-0.55, -0.83],
    dark: 'rgba(72,44,26,.72)', pale: 'rgba(248,236,208,.46)',
    width: 1.5, paleWidth: 1.0, paleOffset: 1.4, eps: 0.6,
  });
  for (const f of L.fringe) {
    ctx.strokeStyle = f.c;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(f.x + f.dx * 0.4, f.y + f.dy * 0.5, f.x + f.dx, f.y + f.dy);
    ctx.stroke();
  }
  ctx.restore();
}

function wrapLines(text, maxW, font) {
  ctx.save();
  ctx.font = font;
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (!cur || ctx.measureText(test).width <= maxW) cur = test;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
}

function drawPageFurniture(L, ink) {
  const mobile = L.mobile;
  // a small running foot, clear of the tools at the page's bottom edge
  ctx.save();
  if (mobile) {
    // a printed plate rule under the one-line mobile header
    const cx = L.pageX + L.pageW / 2;
    const y = L.winRect.y - 7;
    ctx.strokeStyle = P2.rgba(ink, 0.24);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 52, y);
    ctx.lineTo(cx + 52, y);
    ctx.stroke();
    ctx.fillStyle = P2.rgba(ink, 0.3);
    ctx.beginPath();
    ctx.moveTo(cx, y - 3); ctx.lineTo(cx + 3, y);
    ctx.lineTo(cx, y + 3); ctx.lineTo(cx - 3, y);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = P2.rgba(ink, 0.55);
  ctx.font = `600 11.5px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = mobile ? '1.2px' : '1.5px';
  ctx.fillText('A MENAGERIE OF FOLDED SPECIMENS', L.pageX + L.pageW / 2, L.foot.y);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  ctx.restore();

  // the plate note, ruled, in the empty band under the card
  const n = L.note;
  if (n && n.h >= 20 && n.text) {
    const hasCap = n.h >= 34;
    const capH = hasCap ? 15 : 0;
    let font = `italic ${mobile ? 11.5 : 12}px Georgia, 'Times New Roman', serif`;
    let lead = mobile ? 13 : 14;
    let lines = wrapLines(n.text, n.w, font);
    let need = capH + lines.length * lead;
    if (need > n.h) {
      // 11.5px is the floor; shorten the leading before the type
      lead = mobile ? 12.5 : 13;
      lines = wrapLines(n.text, n.w, font);
      need = capH + lines.length * lead;
    }
    if (need <= n.h) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      if (hasCap) {
        ctx.fillStyle = P2.rgba(ink, 0.44);
        ctx.font = `600 11.5px Georgia, 'Times New Roman', serif`;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '1.2px';
        ctx.fillText('NOTES ON THE PLATE', n.x, n.y + 9);
        const capW = ctx.measureText('NOTES ON THE PLATE').width;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
        ctx.strokeStyle = P2.rgba(ink, 0.2);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(n.x + capW + 9, n.y + 5);
        ctx.lineTo(n.x + capW + 31, n.y + 5);
        ctx.stroke();
      }
      ctx.font = font;
      ctx.fillStyle = P2.rgba(ink, 0.55);
      let baseline = n.y + (hasCap ? 24 : 10);
      for (const line of lines) {
        if (baseline > n.y + n.h) break;
        ctx.fillText(line, n.x, baseline);
        const tw = Math.min(n.w, ctx.measureText(line).width + 8);
        ctx.strokeStyle = P2.rgba(ink, 0.16);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(n.x - 1, baseline + 2.5);
        ctx.lineTo(n.x + tw, baseline + 2.5);
        ctx.stroke();
        baseline += lead;
      }
      ctx.restore();
    }
  }

  // a printer's registration mark in the upper-left margin
  ctx.save();
  const rx = L.pageX + 30, ry = L.pageY + (L.mobile ? 60 : 66);
  ctx.strokeStyle = P2.rgba(ink, 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rx - 6, ry); ctx.lineTo(rx + 6, ry);
  ctx.moveTo(rx, ry - 6); ctx.lineTo(rx, ry + 6);
  ctx.stroke();
  ctx.fillStyle = P2.rgba('#b9553a', 0.34);
  ctx.beginPath();
  ctx.arc(rx, ry, 1.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawSpecimen() {
  const s = layout.specimen;
  if (!s) return;
  const ink = '#3a2718';
  const cx = s.x + s.w / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(14,9,6,.44)';
  ctx.shadowColor = 'rgba(8,5,3,.52)';
  ctx.shadowBlur = 17 * dpr;
  ctx.shadowOffsetX = 5 * dpr;
  ctx.shadowOffsetY = 9 * dpr;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = pagePattern || '#efe0c2';
  ctx.fillRect(s.x, s.y, s.w, s.h);
  // the page's deckled edge, kept square like a bound plate
  ctx.strokeStyle = P2.rgba(ink, 0.42);
  ctx.lineWidth = 1;
  ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
  ctx.strokeStyle = P2.rgba(ink, 0.14);
  ctx.strokeRect(s.x + 4.5, s.y + 4.5, s.w - 9, s.h - 9);

  // heading and rule
  ctx.fillStyle = P2.rgba(ink, 0.64);
  ctx.font = `600 11.5px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '1.9px';
  ctx.fillText('SPECIMENS', cx, s.y + 20);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  ctx.strokeStyle = P2.rgba(ink, 0.24);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s.x + 13, s.y + 30.5);
  ctx.lineTo(s.x + s.w - 13, s.y + 30.5);
  ctx.stroke();
  ctx.fillStyle = P2.rgba(ink, 0.3);
  ctx.beginPath();
  ctx.moveTo(cx, s.y + 27); ctx.lineTo(cx + 3.5, s.y + 30.5);
  ctx.lineTo(cx, s.y + 34); ctx.lineTo(cx - 3.5, s.y + 30.5);
  ctx.closePath(); ctx.fill();

  // ten framed recesses: two columns of five
  const cols = 2, rows = 5, gap = 7;
  const padX = 10;
  const top = s.y + 40;
  const bottom = s.y + s.h - 30;
  const sw = (s.w - padX * 2 - gap) / cols;
  const sh = Math.max(18, (bottom - top - gap * (rows - 1)) / rows);
  for (let i = 0; i < LEVELS.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const x = s.x + padX + col * (sw + gap);
    const y = top + row * (sh + gap);
    const lv = LEVELS[i];
    ctx.fillStyle = 'rgba(255,247,226,.16)';
    ctx.fillRect(x, y, sw, sh);
    ctx.strokeStyle = P2.rgba(ink, 0.26);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, sw - 1, sh - 1);
    ctx.strokeStyle = P2.rgba(ink, 0.1);
    ctx.strokeRect(x + 3.5, y + 3.5, sw - 7, sh - 7);
    // the recess: dark on the upper-left, pale on the lower-right
    ctx.strokeStyle = 'rgba(74,48,28,.16)';
    ctx.beginPath();
    ctx.moveTo(x + 1, y + sh - 1); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x + sw - 1, y + 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,247,226,.34)';
    ctx.beginPath();
    ctx.moveTo(x + 1, y + sh - 1); ctx.lineTo(x + sw - 1, y + sh - 1); ctx.lineTo(x + sw - 1, y + 1);
    ctx.stroke();
    ctx.fillStyle = P2.rgba(ink, 0.52);
    ctx.font = `italic 11.5px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(lv.page, x + 5.5, y + 9);

    if (solvedPages.has(lv.id)) {
      const tb = G.bbox(lv.target);
      const sc = Math.min((sw - 16) / tb.w, (sh - 25) / tb.h);
      ctx.beginPath();
      lv.target.forEach(([px, py], k) => {
        const X = x + sw / 2 + (px - tb.cx) * sc;
        const Y = y + sh / 2 + 3 - (py - tb.cy) * sc;
        if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(95,107,58,.28)';
      ctx.fill();
      ctx.strokeStyle = P2.rgba(ink, 0.58);
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.strokeStyle = P2.rgba(ink, 0.15);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + sw / 2 - 5, y + sh / 2 + 4);
      ctx.lineTo(x + sw / 2 + 5, y + sh / 2 + 4);
      ctx.stroke();
    }
  }

  // the count at the foot of the specimen page
  const done = solvedPages.size;
  ctx.fillStyle = P2.rgba(ink, 0.55);
  ctx.font = `italic 11.5px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(done >= LEVELS.length ? 'ten of ten folded' : `${done} of ${LEVELS.length} folded`, cx, s.y + s.h - 15);
  ctx.restore();
}

function drawCard() {
  const art = artCache.get(currentLevel.id);
  if (!art || !layout) return;
  const origin = cardOriginNow();
  const scale = layout.scale;
  const display = displayState();

  // contact + cast shadow for the whole current silhouette
  const union = new Path2D();
  for (const f of display.faces) addOrientedPoly(union, f.poly);
  if (display.flap) addOrientedPoly(union, display.flap.poly);
  applyCardTransform(origin, scale);
  const liftPx = solved && seat && !seat.done ? Math.sin(PI * Math.min(1, seat.t / 0.72)) * (layout.mobile ? 10 : 14) : 0;
  ctx.save();
  ctx.fillStyle = 'rgba(90,60,35,.34)';
  ctx.shadowColor = 'rgba(58,36,19,.42)';
  ctx.shadowBlur = (18 + liftPx * 1.2) * dpr;
  ctx.shadowOffsetX = (4 + liftPx * 0.3) * dpr;
  ctx.shadowOffsetY = (7 + liftPx * 0.6) * dpr;
  ctx.fill(union);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(90,60,35,.24)';
  ctx.shadowColor = 'rgba(58,36,19,.35)';
  ctx.shadowBlur = 4 * dpr;
  ctx.shadowOffsetX = 1 * dpr;
  ctx.shadowOffsetY = 2 * dpr;
  ctx.fill(union);
  ctx.restore();

  for (const f of display.faces) {
    drawFace(f, art, origin, { edges: true });
  }

  if (display.flap) {
    const flap = display.flap;
    drawFlapLift(flap, origin, scale);
    const th = anim ? anim.theta : 0;
    drawFace(flap, art, origin, {
      edges: true,
      lead: !!anim,
      crease: anim ? [anim.a, anim.b] : null,
      tone: anim ? flapTone(th) : 1,
      leadAlpha: 0.16 + 0.52 * Math.max(0, Math.sin(th)),
    });
    drawCreaseGlow(origin, scale);
  }

  if (!anim && !(seat && !seat.done) && !solved) drawCreasesAndTabs();
}

/** The turned face loses light toward the fold: 1.0 flat, 0.82 at 60 deg, 0.62 edge-on, then the kraft back recovers. */
function flapTone(theta) {
  const cs = Math.cos(theta);
  if (cs >= 0) return 0.62 + 0.38 * cs;
  return 0.62 + 0.38 * Math.min(1, -cs);
}

function drawFlapLift(flap, origin, scale) {
  if (!anim) return;
  const th = anim.theta;
  const sn = Math.abs(Math.sin(th));
  const gap = anim.maxDepth * sn;
  if (gap < 0.015) return;
  const dir = G.mul(G.leftNormal(anim.a, anim.b), anim.split.side);
  const cs = Math.cos(th);
  // the cast shadow sweeps with the face's projection and tightens as it lands
  const sweepX = dir[0] * cs;
  const sweepY = -dir[1] * cs;
  const dx = (sweepX * 0.13 + 0.10) * gap * scale;
  const dy = (sweepY * 0.13 + 0.18) * gap * scale;
  applyCardTransform(origin, scale);
  const b = G.bbox(flap.poly);
  const cx = b.cx, cy = b.cy;
  // feathered layers: a soft swept shadow that never reads as a grey card
  const layers = 6;
  const a = 0.028 + 0.020 * sn;
  for (let k = layers - 1; k >= 0; k--) {
    const grow = 1 + k * 0.05;
    ctx.save();
    ctx.translate(dx / scale, -dy / scale);
    ctx.translate(cx, cy);
    ctx.scale(grow, grow);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = `rgba(58,38,22,${a.toFixed(3)})`;
    ctx.fill(polyPath(flap.poly));
    ctx.restore();
  }
}

function drawCreaseGlow(origin, scale) {
  if (!anim) return;
  const sn = Math.max(0, Math.sin(anim.theta));
  if (sn < 0.025) return;
  const a = [origin[0] + anim.a[0] * scale, origin[1] - anim.a[1] * scale];
  const b = [origin[0] + anim.b[0] * scale, origin[1] - anim.b[1] * scale];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(255,241,211,${0.42 * sn})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  ctx.restore();
}

function drawCreasesAndTabs() {
  const state = G.deriveState(currentLevel, folds);
  if (!state) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const origin = cardOriginNow();
  const scale = layout.scale;
  const avail = G.availableCreases(currentLevel, folds).filter((c) => c.available);
  for (const c of avail) {
    const aCss = [origin[0] + c.a[0] * scale, origin[1] - c.a[1] * scale];
    const bCss = [origin[0] + c.b[0] * scale, origin[1] - c.b[1] * scale];
    const mid = [(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2];
    const n = G.leftNormal(c.a, c.b);
    const depth = maxDepthOf(c.split.flapBefore, c.a, c.b);
    const off = Math.min(22 / scale, Math.max(11 / scale, depth * 0.45));
    const tabCard = [mid[0] + n[0] * c.side * off, mid[1] + n[1] * c.side * off];
    const tabCss = [origin[0] + tabCard[0] * scale, origin[1] - tabCard[1] * scale];

    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(248,233,204,.36)';
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(aCss[0], aCss[1]); ctx.lineTo(bCss[0], bCss[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(58,39,24,.76)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(aCss[0], aCss[1]); ctx.lineTo(bCss[0], bCss[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(58,39,24,.72)';
    for (const p of [aCss, bCss]) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.7, 0, TAU); ctx.fill(); }
    ctx.restore();

    drawTab(tabCss, Math.atan2(-(c.b[1] - c.a[1]), c.b[0] - c.a[0]));
  }
}

function drawTab(pos, angle) {
  ctx.save();
  ctx.translate(pos[0], pos[1]);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(60,38,20,.38)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1.5;
  ctx.shadowOffsetY = 2.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-11, -6.5, 22, 13, 3.5);
  else ctx.rect(-11, -6.5, 22, 13);
  ctx.fillStyle = '#b18a4c';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(74,44,26,.78)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-8, -4.5);
  ctx.lineTo(7, -4.5);
  ctx.strokeStyle = 'rgba(242,224,180,.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(74,44,26,.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, 0.5); ctx.lineTo(0, 3); ctx.lineTo(4, 0.5);
  ctx.stroke();
  ctx.restore();
}

function edgeOutward(poly, p, q) {
  const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
  let nx = dy / len, ny = -dx / len;
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
  if (G.pointInPoly([mx + nx * 0.5, my + ny * 0.5], poly)) { nx = -nx; ny = -ny; }
  return [nx, ny];
}

/** The window as a die-cut recess: pale lip on the upper-left walls, dark on the lower-right, warm depth inside. */
function drawWindowCut(poly) {
  if (!poly || poly.length < 3) return;
  const uplOf = (o) => o[0] * -0.62 + o[1] * -0.78 > 0;

  // embossed edge on the page surface, outside the cut
  ctx.save();
  ctx.lineCap = 'butt';
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const o = edgeOutward(poly, p, q);
    const upl = uplOf(o);
    ctx.strokeStyle = upl ? 'rgba(255,247,226,.24)' : 'rgba(58,38,22,.15)';
    ctx.lineWidth = upl ? 1.7 : 1.2;
    const off = 2.2;
    ctx.beginPath();
    ctx.moveTo(p[0] + o[0] * off, p[1] + o[1] * off);
    ctx.lineTo(q[0] + o[0] * off, q[1] + o[1] * off);
    ctx.stroke();
  }
  ctx.restore();

  // warm inner depth, then the cut lip, both inside the opening
  ctx.save();
  ctx.clip(polyPath(poly));
  ctx.lineCap = 'butt';
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const o = edgeOutward(poly, p, q);
    const upl = uplOf(o);
    ctx.strokeStyle = `rgba(56,40,26,${upl ? 0.07 : 0.15})`;
    ctx.lineWidth = 7;
    const off = -3.2;
    ctx.beginPath();
    ctx.moveTo(p[0] + o[0] * off, p[1] + o[1] * off);
    ctx.lineTo(q[0] + o[0] * off, q[1] + o[1] * off);
    ctx.stroke();
  }
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const o = edgeOutward(poly, p, q);
    const upl = uplOf(o);
    ctx.strokeStyle = upl ? 'rgba(249,238,211,.84)' : 'rgba(54,34,20,.56)';
    ctx.lineWidth = upl ? 3.1 : 2.5;
    const off = -1.9;
    ctx.beginPath();
    ctx.moveTo(p[0] + o[0] * off, p[1] + o[1] * off);
    ctx.lineTo(q[0] + o[0] * off, q[1] + o[1] * off);
    ctx.stroke();
  }
  ctx.restore();

  // the crisp cut line itself
  ctx.save();
  ctx.strokeStyle = 'rgba(54,34,20,.55)';
  ctx.lineWidth = 1;
  ctx.stroke(polyPath(poly));
  ctx.restore();
}

function drawPageHoleEdges() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWindowCut(layout.windowPoly);
  drawCutEdges(layout.ornamentPoly, {
    hole: true, light: [-0.55, -0.83],
    dark: 'rgba(66,40,23,.78)', pale: 'rgba(248,235,205,.48)',
    width: 1.6, paleWidth: 1.0, paleOffset: 1.4, eps: 0.6,
  });
}

function drawHoleInnerShadows() {
  drawHoleInnerShadow(layout.ornamentPoly);
}

function drawHoleInnerShadow(poly) {
  if (!poly || poly.length < 3) return;
  ctx.save();
  ctx.clip(polyPath(poly));
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    let nx = dy / len, ny = -dx / len;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (!G.pointInPoly([mx + nx * 0.2, my + ny * 0.2], poly)) { nx = -nx; ny = -ny; }
    const lit = nx * -0.55 + ny * -0.83;
    if (lit > 0.05) continue;
    const off = 3.2;
    ctx.strokeStyle = 'rgba(56,40,26,.18)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p[0] + nx * off, p[1] + ny * off);
    ctx.lineTo(q[0] + nx * off, q[1] + ny * off);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSeatMarks() {
  if (!solved || !seat) return;
  const a = clamp((seat.stampT || 0) / 0.25, 0, 1);
  if (a <= 0) return;
  const L = layout;
  const ink = '#3a2718';
  const cx = L.pageX + L.pageW - 58;
  const cy = L.pageY + L.pageH - (L.mobile ? 166 : 158);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-4 * PI / 180);
  ctx.globalAlpha = a;
  ctx.lineCap = 'round';
  ctx.strokeStyle = P2.rgba(ink, 0.75);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 15, 0.015, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = P2.rgba(ink, 0.55);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0.3, -0.2, 26.6, 12.2, 0.015, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = P2.rgba(ink, 0.78);
  ctx.font = `600 11.5px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0.8px';
  ctx.fillText('FOLDED', 0, 0.5);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  ctx.restore();
}

function refreshCardNow() {
  if (!layout) return;
  const display = displayState();
  const pts = [];
  for (const f of display.faces) pts.push(...f.poly);
  if (display.flap) pts.push(...display.flap.poly);
  if (!pts.length) { layout.cardNow = null; return; }
  const b = G.bbox(pts);
  const o = cardOriginNow();
  layout.cardNow = {
    x: o[0] + b.x0 * layout.scale,
    y: o[1] - b.y1 * layout.scale,
    w: b.w * layout.scale,
    h: b.h * layout.scale,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------------------------------------------
function cssToCard(x, y) {
  if (!layout) return null;
  const o = cardOriginNow();
  return [(x - o[0]) / layout.scale, (o[1] - y) / layout.scale];
}
function cardToCss(p, o) {
  return [o[0] + p[0] * layout.scale, o[1] - p[1] * layout.scale];
}
function tabFor(c, o) {
  const mid = [(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2];
  const n = G.leftNormal(c.a, c.b);
  const depth = maxDepthOf(c.split ? c.split.flapBefore : [c.a, c.b], c.a, c.b);
  const off = Math.min(22 / layout.scale, Math.max(11 / layout.scale, depth * 0.45));
  return cardToCss([mid[0] + n[0] * c.side * off, mid[1] + n[1] * c.side * off], o);
}

function findCreaseAt(cssX, cssY) {
  if (!layout) return null;
  const cp = cssToCard(cssX, cssY);
  if (!cp) return null;
  const o = cardOriginNow();
  const avail = G.availableCreases(currentLevel, folds).filter((c) => c.available);
  let best = null;
  for (const c of avail) {
    const tab = tabFor(c, o);
    const tabDist = Math.hypot(cssX - tab[0], cssY - tab[1]);
    const inFlap = G.pointInPoly(cp, c.split.flapBefore);
    if (!inFlap && tabDist > 23) continue;
    const d = G.distPointSeg(cp, c.a, c.b);
    if (!best || d < best.d) best = { c, d };
  }
  return best;
}

function onPointerDown(e) {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  if (!started || screen !== 'play') return;
  sfx?.unlock();
  if (hintFaded === false) { hintFaded = true; hintEl.classList.add('faded'); }
  if (anim || (seat && !seat.done) || solved) return;
  const { x, y } = localPoint(e);
  const hit = findCreaseAt(x, y);
  if (hit) {
    e.preventDefault();
    startFoldAnim(hit.c, hit.c, 'drag');
    const cp = cssToCard(x, y);
    const n = G.leftNormal(anim.a, anim.b);
    const side = Math.sign(G.cross(G.sub(anim.b, anim.a), G.sub(cp, anim.a))) || 1;
    const d0 = Math.max(0.02, G.dot(G.sub(cp, anim.a), n) * side);
    dragging = { pointerId: e.pointerId, startX: x, startY: y, moved: 0, d0, n, side, id: hit.c.id };
    activePointer = e.pointerId;
    canvas.classList.add('dragging');
    try { canvas.setPointerCapture(e.pointerId); } catch { /* no capture: the drag still follows while inside */ }
    dirty = true;
    return;
  }
  // a tap on the folded stack unfolds the last fold
  if (folds.length) {
    const st = G.deriveState(currentLevel, folds);
    const cp = cssToCard(x, y);
    if (st && cp && G.pointInPoly(cp, st.top.poly)) {
      e.preventDefault();
      pendingUnfold = { pointerId: e.pointerId, startX: x, startY: y, moved: 0 };
      activePointer = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* optional */ }
    }
  }
}

function onPointerMove(e) {
  if (activePointer !== e.pointerId) return;
  const { x, y } = localPoint(e);
  const moved = dragging ? Math.hypot(x - dragging.startX, y - dragging.startY) : (pendingUnfold ? Math.hypot(x - pendingUnfold.startX, y - pendingUnfold.startY) : 0);
  if (dragging) dragging.moved = Math.max(dragging.moved, moved);
  if (pendingUnfold) pendingUnfold.moved = Math.max(pendingUnfold.moved, moved);
  if (dragging && anim && anim.kind === 'fold' && anim.mode === 'drag') {
    const cp = cssToCard(x, y);
    if (!cp) return;
    const s = G.dot(G.sub(cp, anim.a), dragging.n) * dragging.side;
    const span = Math.max(0.35, anim.maxDepth * 0.8);
    const u = clamp((dragging.d0 - s) / span, 0, 1);
    anim.targetTheta = u * PI;
    dirty = true;
  }
}

function onPointerUp(e) {
  if (activePointer !== e.pointerId) return;
  if (dragging && anim && anim.kind === 'fold' && anim.mode === 'drag') {
    if (dragging.moved < 6) {
      // a quick tap gets the same fold, played as a short hinge turn rather than an instant jump
      anim.mode = 'settle';
      anim.from = 0;
      anim.to = PI;
      anim.t = 0;
      anim.theta = 0;
      playFlap(true);
      if (REDUCED) finishAnim();
    } else {
      releaseDrag();
    }
  } else if (pendingUnfold && pendingUnfold.moved < 6) {
    beginUnfold();
  }
  if (dragging) {
    dragging = null;
  }
  pendingUnfold = null;
  activePointer = null;
  canvas.classList.remove('dragging');
  try { canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  dirty = true;
}

function onPointerCancel(e) {
  if (activePointer !== e.pointerId) return;
  if (dragging && anim && anim.kind === 'fold' && anim.mode === 'drag') {
    anim.mode = 'settle';
    anim.from = anim.theta;
    anim.to = 0;
    anim.t = 0;
    anim.dur = 0.4;
  }
  dragging = null;
  pendingUnfold = null;
  activePointer = null;
  canvas.classList.remove('dragging');
  dirty = true;
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
canvas.addEventListener('pointermove', onPointerMove, { passive: true });
canvas.addEventListener('pointerup', onPointerUp, { passive: true });
canvas.addEventListener('pointercancel', onPointerCancel, { passive: true });
canvas.addEventListener('pointerleave', (e) => { if (activePointer === e.pointerId && !dragging) onPointerUp(e); }, { passive: true });
window.addEventListener('resize', () => {
  if (anim && (anim.mode === 'drag')) { releaseDrag(); }
  resizeCanvas();
  computeLayout();
  applyScreenVisibility();
  applyScreenLayout();
  render();
}, { passive: true });
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => {
  if (anim && (anim.mode === 'drag')) { releaseDrag(); }
  resizeCanvas();
  computeLayout();
  applyScreenVisibility();
  applyScreenLayout();
  render();
}, { passive: true });

// buttons
function unlockAudio() { sfx?.unlock(); }
unfoldBtn.addEventListener('click', () => {
  unlockAudio();
  if (screen !== 'play') return;
  if (beginUnfold()) { manual = false; }
});
restartBtn.addEventListener('click', () => {
  unlockAudio();
  if (screen !== 'play') return;
  resetLevel();
  manual = false;
  render();
});
nextBtn.addEventListener('click', () => {
  unlockAudio();
  if (screen !== 'play') return;
  if (levelIndex >= LEVELS.length - 1) {
    setScreen('end');
    return;
  }
  loadLevel(levelIndex + 2);
  startTurn();
  manual = false;
  render();
});
openBtn.addEventListener('click', openBook);
againBtn.addEventListener('click', startAgain);
toCoverBtn.addEventListener('click', goCover);

// ---------------------------------------------------------------------------------------------------------------
// clock
// ---------------------------------------------------------------------------------------------------------------
function frame(now) {
  requestAnimationFrame(frame);
  if (!started) return;
  if (manual) { lastFrame = now; return; }
  if (!lastFrame) lastFrame = now;
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (!Number.isFinite(dt)) dt = 0;
  dt = clamp(dt, 0, 0.05);
  acc += dt;
  const h = 1 / 120;
  let guard = 0;
  while (acc >= h && guard < 8) {
    update(h);
    acc -= h;
    guard++;
  }
  if (guard >= 8) acc = 0;
  if (dirty || anim || (seat && (!seat.done || !seat.stampDone))) render();
}

function step(sec) {
  manual = true;
  let left = Math.max(0, Math.min(6, sec || 0));
  const h = 1 / 120;
  let guard = 0;
  while (left > 1e-9 && guard < 900) {
    const d = Math.min(h, left);
    update(d);
    left -= d;
    guard++;
  }
  render();
}

// ---------------------------------------------------------------------------------------------------------------
// test hooks
// ---------------------------------------------------------------------------------------------------------------
function state() {
  refreshCardNow();
  const s = G.deriveState(currentLevel, folds);
  const ev = G.evaluate(currentLevel, folds);
  return {
    level: levelIndex + 1,
    levels: LEVELS.length,
    folds: folds.length,
    faces: s ? s.faces.length : 0,
    solved,
    coverage: ev.coverage,
    protrusion: ev.protrusion,
    par: currentLevel.par,
    target: currentLevel.target.map((p) => [p[0], p[1]]),
    foldIds: folds.slice(),
    faceSides: s ? s.faces.map((f) => f.side) : [],
    silhouette: s ? s.faces.map((f) => f.poly.map((p) => [p[0], p[1]])) : [],
    anim: anim ? { kind: anim.kind, id: anim.id, theta: +anim.theta.toFixed(4), progress: +(anim.theta / PI).toFixed(4), mode: anim.mode } : null,
    seated: !!(solved && seat && seat.done),
    hint: currentLevel.hint,
    screen,
    complete,
    solvedPages: solvedPages.size,
    totalFolds: [...plateFolds.values()].reduce((a, b) => a + b, 0),
  };
}

function creases() {
  if (!layout) return [];
  const o = cardOriginNow();
  return currentLevel.creases.map((c) => {
    const info = G.creaseOnTop(currentLevel, folds, c);
    const aCard = info.a || c.a;
    const bCard = info.b || c.b;
    const a = cardToCss(aCard, o);
    const b = cardToCss(bCard, o);
    const mid = [(aCard[0] + bCard[0]) / 2, (aCard[1] + bCard[1]) / 2];
    const n = G.leftNormal(aCard, bCard);
    const side = info.available ? info.side : c.side;
    const depth = info.available && info.split ? maxDepthOf(info.split.flapBefore, aCard, bCard) : 0.3;
    const off = Math.min(22 / layout.scale, Math.max(11 / layout.scale, depth * 0.45));
    const tab = cardToCss([mid[0] + n[0] * side * off, mid[1] + n[1] * side * off], o);
    return {
      id: c.id,
      a,
      b,
      tab,
      tabRect: { x: tab[0] - 22, y: tab[1] - 22, w: 44, h: 44 },
      available: !!info.available,
      reason: info.reason || null,
    };
  });
}

function foldHook(id) {
  if (anim || (seat && !seat.done) || solved) return false;
  const hit = availableInfo(id);
  if (!hit || !hit.info.available) return false;
  startFoldAnim(hit.info, hit.crease, 'settle');
  if (REDUCED) {
    anim.theta = PI;
    finishAnim();
    render();
  }
  return true;
}

function unfoldHook() {
  return beginUnfold();
}

function tapHook(x, y) {
  if (anim || (seat && !seat.done) || solved) return null;
  const hit = findCreaseAt(x, y);
  if (hit) {
    startFoldAnim(hit.c, hit.c, 'settle');
    if (REDUCED) { anim.theta = PI; finishAnim(); }
    render();
    return hit.c.id;
  }
  if (folds.length) {
    const st = G.deriveState(currentLevel, folds);
    const cp = cssToCard(x, y);
    if (st && cp && G.pointInPoly(cp, st.top.poly)) {
      if (beginUnfold()) {
        render();
        return 'unfold';
      }
    }
  }
  return null;
}

function dragHook(id, t) {
  if (anim || (seat && !seat.done) || solved) return false;
  const hit = availableInfo(id);
  if (!hit || !hit.info.available) return false;
  startFoldAnim(hit.info, hit.crease, 'drag');
  anim.theta = PI * clamp(Number.isFinite(t) ? t : 1, 0, 1);
  anim.targetTheta = anim.theta;
  releaseDrag();
  render();
  return true;
}

function solveHook() {
  manual = true;
  anim = null;
  seat = null;
  solved = false;
  const isPrefix = folds.length <= currentLevel.solution.length && folds.every((id, i) => id === currentLevel.solution[i]);
  if (!isPrefix) folds = [];
  let ok = true;
  for (const id of currentLevel.solution.slice(folds.length)) {
    const hit = availableInfo(id);
    if (!hit || !hit.info.available) { ok = false; break; }
    folds.push(id);
  }
  if (!ok) {
    folds = [];
    for (const id of currentLevel.solution) {
      const hit = availableInfo(id);
      if (!hit || !hit.info.available) { folds = []; break; }
      folds.push(id);
    }
  }
  lastEval = G.evaluate(currentLevel, folds);
  solved = !!lastEval.solved;
  if (solved) {
    markSolved();
    seat = { t: 0.95, dur: 0.95, done: true, stampT: 0.25, stampDone: true };
    hintEl.classList.add('faded');
  }
  updateHud();
  syncButtons();
  dirty = true;
  render();
  return state();
}

function restartHook() {
  resetLevel();
  manual = true;
  render();
  return state();
}

function setLevelHook(n) {
  loadLevel(Number.isFinite(n) ? n : 1);
  manual = true;
  render();
  return state();
}

// expose before boot so computeLayout can publish the layout
window.__crease = {
  state,
  creases,
  fold: foldHook,
  unfold: unfoldHook,
  tap: tapHook,
  drag: dragHook,
  step,
  restart: restartHook,
  setLevel: setLevelHook,
  target: () => currentLevel.target.map((p) => [p[0], p[1]]),
  solve: solveHook,
  setScreen: (s) => { setScreen(s); manual = true; render(); return state(); },
  finish: () => { const st = finishHook(); manual = true; render(); return st; },
  layout: null,
};
window.__papercraft = {
  step: (sec) => step(sec),
  restart: () => restartHook(),
  resume: () => { manual = false; lastFrame = 0; acc = 0; },
};

setTimeout(boot, 30);
