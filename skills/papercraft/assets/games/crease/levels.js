// crease / levels.js — the three hand-checked pages.
//
// Coordinates are card units, y up, the same units the card and the window share. Every crease is a printed segment
// with a flap side: side +1 = flap on the left of a -> b, -1 = flap on the right. The fold line is the infinite line
// through the segment; a crease is available only when that whole chord of the top face lies inside the printed
// segment (see geometry.creaseOnTop).
//
// Solutions (verified by the model in geometry.js):
//   I  the moth       half            -> rectangle ......... par 1, unique (the cross crease is a decoy)
//   II the dragonfly  bar, half       -> L ................. par 2, unique order (the stem crease is a decoy)
//   III the leaf      diag, trim      -> triangle .......... par 2, unique order (trimming first dead-ends)
//
// The targets are the exact settled silhouettes; the window is cut to them and the folded card fits them exactly.

const A = [-1.7, -1.1], B = [1.7, -1.1], C = [1.7, 1.1], D = [-1.7, 1.1];

// Level III's second crease: the reflection of E = (121/170, -1.1) on A-C back onto the original card, so the line
// A-F becomes the horizontal A-E after the diagonal fold. Exact fractions keep the authored data readable.
const F = [-121 / 170, 11 / 10];

export const LEVELS = [
  {
    id: 1,
    page: 'I',
    title: 'the moth',
    kicker: 'a moth, folded to one wing',
    print: 'moth',
    par: 1,
    sheet: [[-1.7, -1.1], [1.7, -1.1], [1.7, 1.1], [-1.7, 1.1]],
    // the crease at x = 0.2 is not the middle: the folded wing lands offset, leaving a strip of the front print.
    creases: [
      { id: 'half', a: [0.2, -1.1], b: [0.2, 1.1], side: -1, name: 'the wing fold' },
      { id: 'cross', a: [-1.7, 0.35], b: [1.7, 0.35], side: 1, name: 'a decoy crease' },
    ],
    target: [[-1.7, -1.1], [0.2, -1.1], [0.2, 1.1], [-1.7, 1.1]],
    solution: ['half'],
    hint: 'drag the right wing across the crease',
    stampAt: [0.95, 0.05],
  },
  {
    id: 2,
    page: 'II',
    title: 'the dragonfly',
    kicker: 'wings down, then folded in half',
    print: 'dragonfly',
    par: 2,
    // a T-shaped die-cut card: broad wing bar over a narrow body
    sheet: [
      [-1.7, 0.35], [-0.6, 0.35], [-0.6, -1.35], [0.6, -1.35], [0.6, 0.35], [1.7, 0.35],
      [1.7, 1.15], [-1.7, 1.15],
    ],
    creases: [
      { id: 'bar', a: [-1.7, 0.35], b: [1.7, 0.35], side: 1, name: 'the wing bar' },
      { id: 'half', a: [0, 0.35], b: [0, 1.15], side: -1, name: 'the half fold' },
      { id: 'stem', a: [-0.6, -0.6], b: [0.6, -0.6], side: -1, name: 'a decoy crease' },
    ],
    // stem + the left half of the folded bar: an L
    target: [
      [-1.7, -0.45], [-1.7, 0.35], [0.6, 0.35], [0.6, -1.35], [-0.6, -1.35], [-0.6, -0.45],
    ],
    solution: ['bar', 'half'],
    hint: 'fold the wing bar down, then the right half over',
    stampAt: [0.95, 0.75],
  },
  {
    id: 3,
    page: 'III',
    title: 'the leaf',
    kicker: 'the diagonal, then the overhanging tip',
    print: 'leaf',
    par: 2,
    sheet: [A, B, C, D],
    creases: [
      { id: 'diag', a: A, b: C, side: 1, name: 'the midrib' },
      { id: 'trim', a: A, b: F, side: 1, name: 'the tip fold' },
    ],
    // the lower-right half of the sheet; the diagonal flap overhangs the bottom edge until the tip is folded back
    target: [A, B, C],
    solution: ['diag', 'trim'],
    hint: 'fold along the midrib, then tuck the overhanging tip back',
    stampAt: [-0.55, 0.45],
  },
];
