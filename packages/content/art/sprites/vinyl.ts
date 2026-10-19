// The record laid on a turntable platter (drawn at turntable.ts RECORD_X/Y): a black disc with
// groove rings and a fixed sheen on its top-left (the light does not turn with the record), a
// transparent centre where vinyl-label.ts shows, and one bright cue sticker in the grooves.
// Frame k has the sticker turned k * 45 degrees clockwise (the way a record spins, seen from above)
// from its rest position at 3 o'clock, the tonearm side.
import type { PaletteColor } from '../../src/palette.ts';
import { canvas, ellipse, get, set, type Canvas, type SpriteDef } from '../canvas.ts';
import { RECORD_H, RECORD_W } from './turntable.ts';

export const W = RECORD_W; // 25
export const H = RECORD_H; // 15
/** Centre pixel of the record (the spindle). */
export const CX = (W - 1) / 2; // 12
export const CY = (H - 1) / 2; // 7
/** The label: an ellipse box centred on the spindle, transparent in vinyl.ts. */
export const LABEL_W = 13;
export const LABEL_H = 7;
export const LABEL_X = CX - (LABEL_W - 1) / 2; // 6
export const LABEL_Y = CY - (LABEL_H - 1) / 2; // 4

/** Top-left of the 2x2 cue sticker for each frame: 3 o'clock, then clockwise in 45 degree steps. */
export const STICKER: readonly (readonly [number, number])[] = [
  [20, 6], // 0: 3 o'clock, rest (tonearm side)
  [18, 10], // 1: 4:30
  [12, 11], // 2: 6 o'clock
  [5, 10], // 3: 7:30
  [3, 7], // 4: 9 o'clock
  [5, 3], // 5: 10:30
  [11, 2], // 6: 12 o'clock
  [18, 3], // 7: 1:30
];

function disc(): Canvas {
  const c = canvas(W, H);
  ellipse(c, 0, 0, W, H, 'ink-0');
  // groove rings: a wide band of grooves, a dark gap between two tracks, then the inner tracks
  ellipse(c, 1, 1, W - 2, H - 2, 'ink-1', false);
  ellipse(c, 3, 2, W - 6, H - 4, 'ink-1', false);
  // sheen fixed on the top-left: a short arc, brightest in its middle, one glint
  const sheen: [number, number, PaletteColor][] = [
    [3, 4, 'ink-3'],
    [4, 3, 'ink-4'],
    [5, 3, 'ink-5'],
    [6, 2, 'ink-5'],
    [7, 2, 'ink-4'],
    [8, 2, 'ink-3'],
  ];
  for (const [x, y, col] of sheen) set(c, x, y, col);
  set(c, 6, 2, 'ink-7');
  // the label hole
  const hole = canvas(W, H);
  ellipse(hole, LABEL_X, LABEL_Y, LABEL_W, LABEL_H, 'ink-0');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (get(hole, x, y) !== null) set(c, x, y, null);
  return c;
}

/** The disc with the cue sticker (2x2, amber-3: the UI's cooldown colour) at frame k's angle. */
function withSticker(base: Canvas, k: number): Canvas {
  const c: Canvas = { width: base.width, height: base.height, pixels: base.pixels.slice() };
  const [sx, sy] = STICKER[k] ?? [0, 0];
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) set(c, sx + dx, sy + dy, 'amber-3');
  return c;
}

const base = disc();

export default {
  name: 'vinyl',
  frameWidth: W,
  frameHeight: H,
  frames: STICKER.map((_, k) => withSticker(base, k)),
  tags: [{ name: 'vinyl-angles', from: 0, to: 7 }],
  source: 'drawn by code: ellipse disc, groove rings, hand-placed sheen and cue sticker positions every 45 degrees',
} satisfies SpriteDef;
