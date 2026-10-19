// Scratch Boy's DJ table, seen in 3/4 from behind-above (the DJ's side): a thick wooden top laid
// across milk crates turned on their side, each crate full of records, block-party style.
// Built left to right: the DJ end (Scratch Boy stands behind it; a monitor speaker under it), one
// 42 px module per turntable (top section plus a crate of records), a 4 px end cap. table(n) builds
// a table for n turntables; the sprite's one frame is table(2), 112x36. Modules have the same shape,
// so a longer table is table(3) or table(4). The top is 19 rows deep (five planks), deep enough
// for a turntable's plinth to sit on the wood.
// Battle layering: draw this table, the turntables and their records, Scratch Boy (frame top-left at
// HERO_DX, HERO_DY from the table's top-left), then this frame again cropped to x 0..DJ_END-1: the
// DJ end then hides his legs, while his scratching hand still lies on top of the first record.
import type { PaletteColor } from '../../src/palette.ts';
import { canvas, fromGrid, paste, rect, set, type Canvas, type Pixel, type SpriteDef } from '../canvas.ts';

/** The DJ end on the left: Scratch Boy stands behind it. */
export const DJ_END = 24;
export const MODULE_W = 42;
export const CAP = 4;
const H = 36;

/** Rows of the top surface: the back edge (outline) and the front lip. */
export const TOP_BACK_Y = 0;
export const LIP_Y = 19;
/**
 * Where a turntable goes: its frame's top-left is (moduleX(i) + DECK_DX, DECK_Y) in table pixels,
 * so its contact-shadow row (turntable row 27) lands on table row 17, two rows behind the lip.
 */
export const DECK_DX = 1;
export const DECK_Y = -10;
/** Scratch Boy's frame top-left relative to the table's: his frame row 46 (scratch-boy.ts TABLE_ROW) meets the back edge. */
export const HERO_DX = -10;
export const HERO_DY = -46;
export function moduleX(i: number): number {
  return DJ_END + i * MODULE_W;
}
export function tableWidth(decks: number): number {
  return DJ_END + decks * MODULE_W + CAP;
}

const INK: Readonly<Record<string, Pixel>> = {
  '0': 'ink-0', '1': 'ink-1', '2': 'ink-2', '3': 'ink-3', '4': 'ink-4', '5': 'ink-5', '6': 'ink-6', '7': 'ink-7',
};

function stamp(c: Canvas, x: number, y: number, rows: readonly string[]): void {
  paste(c, fromGrid(rows, INK), x, y);
}

const CRATE_W = 30;
const CRATE_DX = (MODULE_W - CRATE_W) / 2; // 6
const CRATE_Y = LIP_Y + 5; // 24
const CRATE_H = 11;

/** Deterministic 0..1 noise from integer coordinates (no Math.random: rebuilds must be identical). */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Plank seams (amber-0). The row under each one is the next plank's lit back edge. Five planks. */
const SEAMS = [3, 7, 11, 15] as const;
/**
 * Hand-placed breaks in each lit plank edge, as [x, length]: one list per seam, for the DJ end
 * (x from the table's left) and for a deck module (x from the module's left; every module is alike).
 */
const END_BREAKS: readonly (readonly (readonly [number, number])[])[] = [
  [[8, 2], [19, 1]],
  [[3, 1], [15, 3]],
  [[10, 2]],
  [[5, 2], [18, 1]],
];
const MODULE_BREAKS: readonly (readonly (readonly [number, number])[])[] = [
  [[6, 2], [21, 1], [34, 3]],
  [[12, 3], [29, 1]],
  [[3, 1], [17, 2], [36, 2]],
  [[9, 2], [25, 3]],
];
/** Butt joints (1 px amber-0 across a plank), staggered per plank: [plank first row, last row, x in module]. */
const JOINTS: readonly (readonly [number, number, number])[] = [
  [1, 2, 28],
  [4, 6, 10],
  [8, 10, 38],
  [12, 14, 20],
  [16, 18, 33],
];

function top(c: Canvas, w: number): void {
  rect(c, 0, TOP_BACK_Y, w, 1, 'brick-0');
  rect(c, 0, 1, w, LIP_Y - 1, 'amber-1');
  // plank seams; the plank edge just in front of each seam catches the light, with a few breaks
  SEAMS.forEach((y, i) => {
    rect(c, 0, y, w, 1, 'amber-0');
    rect(c, 1, y + 1, w - 2, 1, 'amber-2');
    for (const [x, n] of END_BREAKS[i] ?? []) rect(c, x, y + 1, n, 1, 'amber-1');
    for (let m = 0; moduleX(m) < w - CAP; m++) {
      for (const [x, n] of MODULE_BREAKS[i] ?? []) rect(c, moduleX(m) + x, y + 1, n, 1, 'amber-1');
    }
  });
  // butt joints, staggered per plank, same place in every module; one in the DJ end
  for (let m = 0; moduleX(m) < w - CAP; m++) {
    for (const [y0, y1, x] of JOINTS) rect(c, moduleX(m) + x, y0, 1, y1 - y0 + 1, 'amber-0');
  }
  rect(c, 14, 8, 1, 3, 'amber-0');
  // sparse grain dashes, only on rows clear of the seams and highlights, never two close together
  for (const y of [2, 5, 9, 13, 17]) {
    for (let x = 3; x < w - 8; x++) {
      if (hash(x, y * 7) < 0.035) {
        rect(c, x, y, 3 + Math.floor(hash(y, x) * 3), 1, 'amber-0');
        x += 10;
      }
    }
  }
  // front: lit lip with a warm glint toward the left, the plank's face, its underside outline
  rect(c, 0, LIP_Y, w, 1, 'amber-2');
  rect(c, 3, LIP_Y, 9, 1, 'amber-3');
  rect(c, 0, LIP_Y + 1, w, 3, 'amber-1');
  for (let x = 1; x < w - 4; x++) {
    if (hash(x, 99) < 0.06) rect(c, x, LIP_Y + 2 + (x % 2), 4, 1, 'amber-0');
  }
  rect(c, 0, LIP_Y + 4, w, 1, 'brick-0');
  // ends: outline, lit (brick-1) on the left
  for (let y = 0; y <= LIP_Y + 4; y++) {
    set(c, 0, y, 'brick-1');
    set(c, w - 1, y, 'brick-0');
  }
  set(c, 0, 0, null);
  set(c, w - 1, 0, null);
}

/** Records standing in a crate: 1 px sleeves in runs of one colour, dark gaps between runs. */
const SLEEVES: readonly PaletteColor[] = ['ink-6', 'red-2', 'amber-2', 'blue-2', 'ink-4', 'pink-1', 'green-1', 'dusk-2', 'brick-3', 'amber-3', 'blue-1'];

function crate(c: Canvas, x0: number, which: number): void {
  const plastic: readonly PaletteColor[] = which % 2 === 0 ? ['red-0', 'red-1', 'red-2'] : ['blue-0', 'blue-1', 'blue-2'];
  const [dark, base, lit] = plastic as [PaletteColor, PaletteColor, PaletteColor];
  const y0 = CRATE_Y;
  const y1 = CRATE_Y + CRATE_H - 1;
  // frame: 2 px bars round the opening, outlined in the plastic's -0
  rect(c, x0, y0, CRATE_W, CRATE_H, dark);
  rect(c, x0 + 1, y0 + 1, CRATE_W - 2, CRATE_H - 2, base);
  // the top bar sits in the table's shadow; light reaches the bottom-left bar
  rect(c, x0 + 1, y0 + 1, CRATE_W - 2, 1, dark);
  rect(c, x0 + 2, y1 - 1, 10, 1, lit);
  // grip slot in the side bars
  set(c, x0 + 1, y0 + 4, dark);
  set(c, x0 + 1, y0 + 5, dark);
  set(c, x0 + CRATE_W - 2, y0 + 4, dark);
  set(c, x0 + CRATE_W - 2, y0 + 5, dark);
  // the opening: dark inside, sleeves standing in it
  const ix = x0 + 3;
  const iw = CRATE_W - 6;
  const iy = y0 + 3;
  const ih = CRATE_H - 5;
  rect(c, ix - 1, iy - 1, iw + 2, ih + 1, 'ink-0');
  let x = ix;
  let run = 0;
  while (x < ix + iw) {
    const len = 2 + Math.floor(hash(run, which + 11) * 3);
    const col = SLEEVES[Math.floor(hash(which * 31 + run, 5) * SLEEVES.length)] ?? 'ink-4';
    for (let k = 0; k < len && x < ix + iw; k++, x++) {
      const dip = hash(x, which) < 0.25 ? 1 : 0;
      for (let y = iy + dip; y < iy + ih; y++) set(c, x, y, col);
    }
    x++; // dark gap between runs
    run++;
  }
}

/** A woofer seen face-on: rubber surround lit top-left, dark cone, dust cap with a glint. */
const WOOFER = [
  '..00000..',
  '.0444430.',
  '043111130',
  '041453130',
  '041532130',
  '031322130',
  '031111130',
  '.0333330.',
  '..00000..',
];

/** A small monitor speaker under the DJ end: black box, woofer, tweeter, bass port. */
function speaker(c: Canvas, x0: number): void {
  const y0 = CRATE_Y - 1;
  rect(c, x0, y0, 20, 12, 'ink-0');
  rect(c, x0 + 1, y0 + 1, 18, 10, 'ink-2');
  rect(c, x0 + 1, y0 + 1, 18, 1, 'ink-3');
  rect(c, x0 + 1, y0 + 1, 1, 10, 'ink-3');
  rect(c, x0 + 18, y0 + 2, 1, 9, 'ink-1');
  stamp(c, x0 + 3, y0 + 2, WOOFER);
  stamp(c, x0 + 13, y0 + 2, ['.000.', '04530', '03310', '.000.']);
  stamp(c, x0 + 13, y0 + 7, ['00000', '01110', '00000']);
}

export function table(decks: number): Canvas {
  const w = tableWidth(decks);
  const c = canvas(w, H);
  // under the table: the ground in the table's shadow, and the ground shadow row
  rect(c, 1, LIP_Y + 5, w - 2, H - LIP_Y - 5, 'ink-1');
  top(c, w);
  speaker(c, 2);
  for (let i = 0; i < decks; i++) crate(c, moduleX(i) + CRATE_DX, i);
  return c;
}

export default {
  name: 'dj-table',
  frameWidth: tableWidth(2),
  frameHeight: H,
  frames: [table(2)],
  tags: [{ name: 'dj-table-idle', from: 0, to: 0 }],
  source: 'drawn by code: five-plank top with hand-placed highlight breaks and hashed grain, milk crates of records under each deck module',
} satisfies SpriteDef;
