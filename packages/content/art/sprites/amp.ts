// Riff's amp stack: a head on a 4x12 cabinet, in 3/4 view facing down-left like Riff: front face,
// lit top faces, shaded right sides. Black tolex, chrome corners, woven grille over four speakers,
// a brushed-metal control panel with knobs and a red power LED, and a little horned crest.
import { canvas, ellipse, fromGrid, get, outline, paste, rect, set, type Canvas, type Pixel, type SpriteDef } from '../canvas.ts';
import type { PaletteColor } from '../../src/palette.ts';

const FW = 32;
const FH = 40;

type State = 'idle' | 'push' | 'back' | 'broken';

const L: Record<string, Pixel> = {
  '0': 'ink-0', '1': 'ink-1', '2': 'ink-2', '3': 'ink-3', '4': 'ink-4', '5': 'ink-5', '6': 'ink-6', '7': 'ink-7',
  R: 'red-0', r: 'red-1', s: 'red-2', t: 'red-3',
  y: 'amber-3', o: 'amber-2',
};
const g = (rows: readonly string[]): Canvas => fromGrid(rows, L);

// Boxes: the front face spans x0..x1, y0..y1; the top face rises 2 rows going right 4 px (a 1:2
// slope), the right side face is 4 px deep.
interface Box { x0: number; y0: number; x1: number; y1: number }
const CAB: Box = { x0: 5, y0: 16, x1: 24, y1: 35 };
const HEAD: Box = { x0: 6, y0: 7, x1: 23, y1: 13 };
const DEPTH = 4;

/** Tolex box: front ink-2 with a lit ink-5 rim on its top edge, top face ink-3/ink-4, side ink-1. */
function box(c: Canvas, b: Box): void {
  rect(c, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, 'ink-2');
  // top face: the front row catches the light
  for (let k = 1; k <= DEPTH / 2; k++) {
    for (let x = b.x0 + 2 * k - 1; x <= b.x1 + 2 * k; x++) set(c, x, b.y0 - k, k === 1 ? 'ink-4' : 'ink-3');
  }
  // right side, in shadow
  for (let k = 1; k <= DEPTH; k++) {
    const lift = Math.ceil(k / 2);
    for (let y = b.y0 - lift; y <= b.y1 - lift; y++) set(c, b.x1 + k, y, 'ink-1');
  }
  // the edge between front and side
  for (let y = b.y0; y <= b.y1; y++) set(c, b.x1, y, 'ink-1');
  // lit rim along the front's top and left edges
  for (let x = b.x0; x < b.x1; x++) set(c, x, b.y0, 'ink-3');
  for (let y = b.y0; y < b.y1; y++) set(c, b.x0, y, 'ink-3');
}

// Chrome corner caps for the front face (hard jumps: ink-7 right next to ink-3).
const CAP_TL = g(['775', '73.', '5..']);
const CAP_TR = g(['553', '.30', '..3']);
const CAP_BL = g(['5..', '73.', '553']);
const CAP_BR = g(['..3', '.30', '330']);
function caps(c: Canvas, b: Box): void {
  paste(c, CAP_TL, b.x0, b.y0);
  paste(c, CAP_TR, b.x1 - 2, b.y0);
  paste(c, CAP_BL, b.x0, b.y1 - 2);
  paste(c, CAP_BR, b.x1 - 2, b.y1 - 2);
  // the back corner of the top face
  set(c, b.x1 + DEPTH, b.y0 - DEPTH / 2, 'ink-5');
  set(c, b.x1 + DEPTH - 1, b.y0 - DEPTH / 2, 'ink-6');
}

// Speakers seen through the grille cloth: a dark ring and a dust cap, 7x7.
const CONE_IDLE = g(['..333..', '.31112.', '3111112', '3114312', '3113212', '.21112.', '..222..']);
// pushed out: the cone face and cap catch the light
const CONE_PUSH = g(['..555..', '.53334.', '5322224', '5326524', '5325424', '.42224.', '..444..']);
// sucked back: the ring sinks
const CONE_BACK = g(['..222..', '.20001.', '2000001', '2002101', '2001101', '.10001.', '..111..']);
// stripped bare: an ink-5 rim cracked at the top-right, the crack running into the dust cap
const CONE_BARE = g(['..555..', '.5110..', '5112104', '5130314', '5113114', '.41114.', '..444..']);
const CONES: [number, number][] = [[8, 21], [16, 21], [8, 28], [16, 28]];

function grille(c: Canvas, state: State): void {
  const x0 = CAB.x0 + 2;
  const x1 = CAB.x1 - 2;
  const y0 = CAB.y0 + 4;
  const y1 = CAB.y1 - 2;
  // weave
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(c, x, y, (x + y) % 2 === 0 ? 'ink-1' : 'ink-0');
  const cone = state === 'push' ? CONE_PUSH : state === 'back' ? CONE_BACK : CONE_IDLE;
  CONES.forEach(([x, y], i) => {
    if (state === 'broken' && i === 2) {
      paste(c, CONE_BARE, x, y);
      return;
    }
    const pc = clone7(cone);
    // the weave shows through the darkest cone pixels
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (get(pc, i, j) === 'ink-1' && (x + i + y + j) % 2 === 1) set(pc, i, j, 'ink-0');
    paste(c, pc, x, y);
  });
  // piping: ink-3 frame with ink-6 corner caps
  rect(c, x0 - 1, y0 - 1, x1 - x0 + 3, y1 - y0 + 3, 'ink-3', false);
  for (const [x, y] of [[x0 - 1, y0 - 1], [x1 + 1, y0 - 1], [x0 - 1, y1 + 1], [x1 + 1, y1 + 1]] as [number, number][]) set(c, x, y, 'ink-6');
  if (state === 'broken') {
    for (const [y, x, w] of RIP) {
      rect(c, x, y, w, 1, 'ink-0');
      // the lower lip of cloth curls up into the light
      set(c, x - 1, y, 'ink-4');
    }
    for (const [x, y] of FRAY) set(c, x, y, 'ink-6');
    paste(c, FLAP, 16, 30);
  }
}
function clone7(c: Canvas): Canvas {
  const out = canvas(c.width, c.height);
  paste(out, c, 0, 0);
  return out;
}

// Torn grille: a diagonal rip, 2 px wide (3 where it gapes), from (9, 21) to (21, 31); thread ends fray
// off both lips and a flap of cloth hangs from its lower end.
const RIP: [number, number, number][] = [
  // y, x, width
  [21, 9, 2], [22, 10, 2], [23, 11, 2], [24, 12, 3], [25, 13, 3], [26, 15, 2], [27, 16, 2], [28, 17, 2], [29, 18, 2], [30, 19, 2], [31, 20, 2],
];
const FRAY: [number, number][] = [[12, 21], [15, 23], [11, 25], [18, 26], [16, 29]];
const FLAP = g(['33..', '343.', '.33.', '..3.']);
// A little horned crest on the cabinet's top band (no lettering).
const CREST = g(['t...t', 'sR.Rs', '.sss.', '..r..']);

// Brushed-metal control panel with five knobs and the power LED.
function panel(c: Canvas, state: State): void {
  const x0 = HEAD.x0 + 2;
  const x1 = HEAD.x1 - 2;
  const y0 = HEAD.y0 + 2;
  rect(c, x0, y0, x1 - x0 + 1, 3, 'ink-4');
  for (let x = x0; x <= x1; x++) {
    set(c, x, y0, 'ink-6');
    set(c, x, y0 + 3, 'ink-1');
  }
  // brushed streaks
  for (let x = x0 + 1; x <= x1 - 3; x++) if (x % 5 !== 0) set(c, x, y0 + 2, 'ink-5');
  for (let k = 0; k < 4; k++) {
    const kx = x0 + 1 + k * 3;
    if (state === 'broken' && k === 2) {
      // the knob's gone: an empty socket
      set(c, kx, y0 + 1, 'ink-2');
      set(c, kx + 1, y0 + 2, 'ink-3');
      continue;
    }
    set(c, kx, y0 + 1, 'ink-6');
    set(c, kx + 1, y0 + 1, 'ink-1');
    set(c, kx, y0 + 2, 'ink-1');
    set(c, kx + 1, y0 + 2, 'ink-0');
  }
  // power LED: a red core ringed by red-1
  const lx = x1 - 1;
  set(c, lx, y0 + 1, state === 'broken' ? 'ink-1' : 'red-3');
  set(c, lx, y0 + 2, state === 'broken' ? 'ink-2' : 'red-1');
  set(c, lx - 1, y0 + 1, state === 'broken' ? 'ink-3' : 'red-1');
}

// Smoke puffs with cut corners: ink-6 top-left, ink-5 body, ink-4 bottom-right.
const PUFF_S = g(['.65.', '6554', '.54.']);
const PUFF_L = g(['.665.', '66555', '65554', '.544.']);

// Sound pushed out of the cones toward the stage front (left), opening right like '('.
const WAVE_S = g(['.5', '6.', '7.', '6.', '.5']);
const WAVE_L = g(['..5', '.6.', '7..', '7..', '7..', '.6.', '..5']);

function draw(state: State): Canvas {
  const f = canvas(FW, FH);
  ellipse(f, 2, 31, 30, 8, 'ink-1');
  const a = canvas(FW, FH);
  // cabinet
  box(a, CAB);
  grille(a, state);
  caps(a, CAB);
  if (state === 'broken') {
    // the top-left chrome cap is knocked off: bare tolex and a screw hole
    rect(a, CAB.x0, CAB.y0, 3, 1, 'ink-3');
    rect(a, CAB.x0, CAB.y0, 1, 3, 'ink-3');
    set(a, CAB.x0 + 1, CAB.y0 + 1, 'ink-2');
    set(a, CAB.x0 + 2, CAB.y0 + 1, 'ink-2');
    set(a, CAB.x0 + 1, CAB.y0 + 2, 'ink-0');
  }
  paste(a, CREST, 12, CAB.y0 + 1);
  // a leather side handle
  for (let y = 24; y <= 27; y++) set(a, CAB.x1 + 2, y - 1, 'ink-0');
  set(a, CAB.x1 + 2, 22, 'ink-3');
  // head: the push jolts it up a pixel
  const h = canvas(FW, FH);
  box(h, HEAD);
  caps(h, HEAD);
  panel(h, state);
  // handle on the head's top
  for (let x = 12; x <= 17; x++) set(h, x, HEAD.y0 - 3, 'ink-1');
  set(h, 12, HEAD.y0 - 3, 'ink-3');
  set(h, 11, HEAD.y0 - 2, 'ink-0');
  set(h, 18, HEAD.y0 - 2, 'ink-0');
  paste(a, h, 0, state === 'push' ? -1 : 0);
  if (state === 'broken') {
    // a crack across the head
    for (const [x, y] of [[13, 7], [14, 8], [14, 9], [15, 10], [16, 11], [16, 12]] as [number, number][]) set(a, x, y, 'ink-0');
  }
  outline(a);
  relight(a);
  paste(f, a, 0, 0);
  if (state === 'push') {
    paste(f, WAVE_S, 2, 21);
    paste(f, WAVE_S, 2, 28);
  } else if (state === 'back') {
    paste(f, WAVE_L, 0, 20);
    paste(f, WAVE_L, 0, 27);
  } else if (state === 'broken') {
    // smoke rising out of the cracked head and drifting right, growing as it goes
    paste(f, PUFF_S, 13, 2);
    paste(f, PUFF_L, 17, 0);
  }
  return f;
}

/** Selective outline: silhouette outline pixels on lit (top/left) edges become ink-1. */
function relight(c: Canvas): void {
  const src = canvas(FW, FH);
  paste(src, c, 0, 0);
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const p: PaletteColor | null = get(src, x, y);
      if (p !== 'ink-0') continue;
      if (get(src, x - 1, y) === null || get(src, x, y - 1) === null) set(c, x, y, 'ink-1');
    }
  }
}

export default {
  name: 'amp',
  frameWidth: FW,
  frameHeight: FH,
  frames: [draw('idle'), draw('push'), draw('back'), draw('broken')],
  durations: [150, 110, 140, 150],
  tags: [
    { name: 'amp-idle', from: 0, to: 0 },
    { name: 'amp-attack', from: 1, to: 2 },
    { name: 'amp-broken', from: 3, to: 3 },
  ],
  source: 'drawn by code: 3/4 tolex boxes, chrome corner grids, woven grille, speaker rings, control panel',
} satisfies SpriteDef;
