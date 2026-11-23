// crease / levels.js — the ten hand-checked pages.
//
// Coordinates are card units, y up, the same units the card and the window share. Every crease is a printed segment
// with a flap side: side +1 = flap on the left of a -> b, -1 = flap on the right. The fold line is the infinite line
// through the segment; a crease is available only when that whole chord of the top face lies inside the printed
// segment (see geometry.creaseOnTop).
//
// Solutions (verified by the model in geometry.js and by solve.js):
//   I    the moth      half             -> rectangle ......... par 1, unique (the cross crease is a decoy)
//   II   the dragonfly bar, half        -> L ................. par 2, unique order (the stem crease is a decoy)
//   III  the leaf      diag, trim       -> triangle .......... par 2, unique order (trimming first dead-ends)
//   IV   the heron     wing             -> heron ............. par 1, unique (the bar is a decoy)
//   V    the house     corner, tuck     -> house ............. par 2, unique order (the centre score is a decoy)
//   VI   the boat      corner, tuck     -> hull .............. par 2, unique order (the mast score is a decoy)
//   VII  the arrow     corner, tuck     -> arrow ............. par 2, unique order (the flight score is a decoy)
//   VIII the fox       corner, tuck     -> fox head .......... par 2, unique order (the muzzle score is a decoy)
//   IX   the compass   corner, tuck     -> gem ............... par 2, unique order (the equator score is a decoy)
//   X    the crest     corner, tuck     -> shield ............ par 2, unique order (band and pale are decoys)
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
  {
    id: 4,
    page: 'IV',
    title: 'the heron',
    kicker: 'a wading bird, folded from its wing',
    print: 'heron',
    par: 1,
    sheet: [[-0.55, -1.4], [0.7, -1.4], [1.3821, -1.1455], [1.5321, -0.5455], [0.95, -0.4], [0.4, 0.55], [0.2, 1.25], [0, 1.45], [-0.5, 1.3], [-1, 1.05], [-0.45, 0.85], [-0.35, 0.4], [-0.9, -0.1], [-1, -0.8]],
    creases: [
      { id: 'wing', a: [0.7, -1.4], b: [0.95, -0.4], side: -1, name: 'the wing fold' },
      { id: 'bar', a: [-0.66, 0.1], b: [0.64, 0.1], side: 1, name: 'a printer mark' },
    ],
    target: [[-0.55, -1.4], [0.7, -1.4], [0.95, -0.4], [0.4, 0.55], [0.2, 1.25], [0, 1.45], [-0.5, 1.3], [-1, 1.05], [-0.45, 0.85], [-0.35, 0.4], [-0.9, -0.1], [-1, -0.8]],
    solution: ['wing'],
    hint: 'fold the wing in across the breast',
    stampAt: [1.15, -0.85],
  },
  {
    id: 5,
    page: 'V',
    title: 'the house',
    kicker: 'a house with its chimney folded down',
    print: 'house',
    par: 2,
    sheet: [[-1.2, -1], [1.2, -1], [1.2, 0.4], [0, 1.2], [0.1022, 1.3014], [-0.0831, 1.6246], [-0.36, 0.96], [-1.2, 0.4]],
    creases: [
      { id: 'corner', a: [0, 1.2], b: [-1.2, 0.4], side: -1, name: 'the chimney fold' },
      { id: 'tuck', a: [0, 1.2], b: [-0.0831, 1.6246], side: -1, name: 'the chimney tip' },
      { id: 'centre', a: [0, -1], b: [0, 1.25], side: 1, name: 'a corner score' },
    ],
    target: [[-1.2, -1], [1.2, -1], [1.2, 0.4], [0, 1.2], [-1.2, 0.4]],
    solution: ['corner', 'tuck'],
    hint: 'fold the chimney, then tuck its tip',
    stampAt: [-0.08, 1.3],
  },
  {
    id: 6,
    page: 'VI',
    title: 'the boat',
    kicker: 'a hull, folded from its rudder',
    print: 'boat',
    par: 2,
    sheet: [[-0.6, -0.86], [0, -1.1], [1, -0.7], [1.4, 0.9], [-1.4, 0.9], [-1, -0.7], [-1.2682, -0.7045], [-1.6966, -1.1414]],
    creases: [
      { id: 'corner', a: [-1, -0.7], b: [0, -1.1], side: -1, name: 'the rudder fold' },
      { id: 'tuck', a: [-1, -0.7], b: [-1.6966, -1.1414], side: -1, name: 'the rudder tip' },
      { id: 'mast', a: [0, -1.1], b: [0, 0.9], side: 1, name: 'a mast score' },
    ],
    target: [[-1, -0.7], [0, -1.1], [1, -0.7], [1.4, 0.9], [-1.4, 0.9]],
    solution: ['corner', 'tuck'],
    hint: 'fold the rudder over, then tuck the tip',
    stampAt: [-1.3, -0.82],
  },
  {
    id: 7,
    page: 'VII',
    title: 'the arrow',
    kicker: 'an arrow, fletched and folded',
    print: 'arrow',
    par: 2,
    sheet: [[0.2, -1.2], [0.2, -0.5], [1.7, -0.5], [1.8125, -0.8], [1.925, -0.5], [1.7, 0.1], [1.7, 0.5], [0.2, 0.5], [0.2, 1.2], [-1.7, 0]],
    creases: [
      { id: 'corner', a: [1.7, -0.5], b: [1.7, 0.5], side: -1, name: 'the fletching fold' },
      { id: 'tuck', a: [1.7, -0.5], b: [1.925, -0.5], side: -1, name: 'the fletching tip' },
      { id: 'flight', a: [-1.7, 0], b: [1.7, 0], side: 1, name: 'a flight score' },
    ],
    target: [[0.2, -1.2], [0.2, -0.5], [1.7, -0.5], [1.7, 0.5], [0.2, 0.5], [0.2, 1.2], [-1.7, 0]],
    solution: ['corner', 'tuck'],
    hint: 'fold the fletching in, then tuck the barb',
    stampAt: [1.78, -0.42],
  },
  {
    id: 8,
    page: 'VIII',
    title: 'the fox',
    kicker: 'a fox, folded at the chin',
    print: 'fox',
    par: 2,
    sheet: [[-0.3825, -0.88], [0, -1.05], [0.45, -0.85], [0.75, -0.2], [0.95, 0.95], [0.35, 0.45], [-0.35, 0.45], [-0.95, 0.95], [-0.75, -0.2], [-0.45, -0.85], [-0.6358, -0.8824], [-0.8601, -0.9777]],
    creases: [
      { id: 'corner', a: [-0.45, -0.85], b: [0, -1.05], side: -1, name: 'the chin fold' },
      { id: 'tuck', a: [-0.45, -0.85], b: [-0.8601, -0.9777], side: -1, name: 'the whisker tuck' },
      { id: 'muzzle', a: [-0.8, 0.2], b: [0.8, 0.2], side: 1, name: 'a muzzle score' },
    ],
    target: [[-0.45, -0.85], [0, -1.05], [0.45, -0.85], [0.75, -0.2], [0.95, 0.95], [0.35, 0.45], [-0.35, 0.45], [-0.95, 0.95], [-0.75, -0.2]],
    solution: ['corner', 'tuck'],
    hint: 'fold the chin up, then tuck the whisker',
    stampAt: [-0.65, -0.9],
  },
  {
    id: 9,
    page: 'IX',
    title: 'the compass',
    kicker: 'a compass rose, folded from its needle',
    print: 'compass',
    par: 2,
    sheet: [[-0.85, 0.45], [-0.85, -0.45], [0, -1.45], [0.0284, -1.5881], [0.1686, -1.5517], [0.17, -1.25], [0.85, -0.45], [0.85, 0.45], [0, 1.45]],
    creases: [
      { id: 'corner', a: [0, -1.45], b: [0.85, -0.45], side: -1, name: 'the needle fold' },
      { id: 'tuck', a: [0, -1.45], b: [0.1686, -1.5517], side: -1, name: 'the needle tip' },
      { id: 'equator', a: [-0.85, 0], b: [0.85, 0], side: 1, name: 'an equator score' },
    ],
    target: [[-0.85, 0.45], [-0.85, -0.45], [0, -1.45], [0.85, -0.45], [0.85, 0.45], [0, 1.45]],
    solution: ['corner', 'tuck'],
    hint: 'fold the needle up, then tuck its point',
    stampAt: [0.09, -1.45],
  },
  {
    id: 10,
    page: 'X',
    title: 'the crest',
    kicker: 'the menagerie crest, folded at the ribbon',
    print: 'crest',
    par: 2,
    sheet: [[-1.15, 0.1], [-0.8, -0.7], [0, -1.3], [0.8, -0.7], [0.7928, -0.945], [0.8614, -1.2969], [0.8525, -0.58], [1.15, 0.1], [1.05, 1], [-1.05, 1]],
    creases: [
      { id: 'corner', a: [0.8, -0.7], b: [1.15, 0.1], side: -1, name: 'the ribbon fold' },
      { id: 'tuck', a: [0.8, -0.7], b: [0.8614, -1.2969], side: -1, name: 'the ribbon tail' },
      { id: 'band', a: [-1.1, 0.35], b: [1.1, 0.35], side: 1, name: 'a band score' },
      { id: 'pale', a: [0, -1.3], b: [0, 1], side: -1, name: 'a pale score' },
    ],
    target: [[-1.15, 0.1], [-0.8, -0.7], [0, -1.3], [0.8, -0.7], [1.15, 0.1], [1.05, 1], [-1.05, 1]],
    solution: ['corner', 'tuck'],
    hint: 'fold the ribbon over, then tuck its tail',
    stampAt: [0.83, -0.88],
  },
];
