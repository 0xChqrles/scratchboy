// A classic direct-drive turntable seen from 3/4 above, from the DJ's side: brushed silver plinth,
// a chrome platter with strobe dots on its rim and a ribbed rubber mat (no record: vinyl.ts is laid
// on top), an S-arm on the right with counterweight, arm rest and headshell, a pitch fader in the
// front-right corner, the start/stop key in the front-left corner and a power LED.
// Frame 0 'ready'. Frame 1 'broken': cracked plinth, tonearm snapped at the pivot and lying across
// the front, strobe and LED dark, a wisp of smoke rising from the pivot.
import { canvas, ellipse, fromGrid, get, outline, paste, rect, set, type Canvas, type Pixel, type SpriteDef } from '../canvas.ts';

const W = 40;
const H = 28;

/**
 * Where the record goes. vinyl.ts and vinyl-label.ts frames are RECORD_W x RECORD_H and are drawn
 * with their top-left at (RECORD_X, RECORD_Y) in this frame. The spindle is at (CENTER_X, CENTER_Y).
 * The record covers the platter's whole top face; the platter's chrome side (strobe dots) shows below it.
 */
export const RECORD_X = 4;
export const RECORD_Y = 4;
export const RECORD_W = 25;
export const RECORD_H = 15;
export const CENTER_X = RECORD_X + (RECORD_W - 1) / 2; // 16
export const CENTER_Y = RECORD_Y + (RECORD_H - 1) / 2; // 11

/** Plinth box: outline x 1..38, y 2..26; the top face is x 2..37, y 3..22; the front face y 23..25. */
const TOP_Y0 = 3;
const TOP_Y1 = 22;

const INK: Readonly<Record<string, Pixel>> = {
  '0': 'ink-0', '1': 'ink-1', '2': 'ink-2', '3': 'ink-3', '4': 'ink-4', '5': 'ink-5', '6': 'ink-6', '7': 'ink-7',
  r: 'red-2', R: 'red-1',
};

/** Pastes a small hand-drawn grid ('.' keeps what is under it) with its top-left at (x, y). */
function stamp(c: Canvas, x: number, y: number, rows: readonly string[], legend: Readonly<Record<string, Pixel>> = INK): void {
  paste(c, fromGrid(rows, legend), x, y);
}

/** Bottom-most opaque row of each column of a filled ellipse box (for the platter's side). */
function ellipseBottoms(x: number, y: number, w: number, h: number): Map<number, number> {
  const tmp = canvas(x + w + 1, y + h + 1);
  ellipse(tmp, x, y, w, h, 'ink-0');
  const out = new Map<number, number>();
  for (let px = x; px < x + w; px++) {
    for (let py = y + h - 1; py >= y; py--) {
      if (get(tmp, px, py) !== null) {
        out.set(px, py);
        break;
      }
    }
  }
  return out;
}

function plinth(): Canvas {
  const c = canvas(W, H);
  // top face: brushed silver, a lit bevel along the back and left edges, a darker bevel on the right
  rect(c, 2, TOP_Y0, 36, TOP_Y1 - TOP_Y0 + 1, 'ink-5');
  rect(c, 2, TOP_Y0, 36, 1, 'ink-6');
  rect(c, 2, TOP_Y0, 1, TOP_Y1 - TOP_Y0 + 1, 'ink-6');
  rect(c, 37, TOP_Y0 + 1, 1, TOP_Y1 - TOP_Y0, 'ink-4');
  // brushed streaks on bare metal
  rect(c, 30, 21, 4, 1, 'ink-6');
  rect(c, 11, 21, 5, 1, 'ink-6');
  // front: lit lip with a glint at the left, then the face going darker toward the table
  rect(c, 2, 23, 36, 1, 'ink-6');
  rect(c, 3, 23, 6, 1, 'ink-7');
  rect(c, 2, 24, 36, 1, 'ink-4');
  rect(c, 2, 25, 36, 1, 'ink-3');
  outline(c, { selective: true });
  // round the four corners
  for (const [x, y] of [[1, 2], [38, 2], [1, 26], [38, 26]] as const) set(c, x, y, null);
  return c;
}

function platter(broken: boolean): Canvas {
  const c = canvas(W, H);
  const bottoms = ellipseBottoms(RECORD_X, RECORD_Y, RECORD_W, RECORD_H);
  // chrome side, 2 rows: lit on the left, strobe dots along the front stretch (dark when broken)
  for (const [x, yb] of bottoms) {
    const t = (x - RECORD_X) / (RECORD_W - 1);
    const front = Math.abs(x - CENTER_X) <= 7;
    const dot = front && (x - CENTER_X) % 2 === 0;
    set(c, x, yb + 1, dot ? (broken ? 'ink-3' : 'ink-7') : t < 0.35 ? 'ink-6' : t < 0.8 ? 'ink-5' : 'ink-4');
    set(c, x, yb + 2, t < 0.35 ? 'ink-4' : 'ink-3');
  }
  // top: chrome lip ring, bright toward the top-left, then the rubber mat with a rib ring
  ellipse(c, RECORD_X, RECORD_Y, RECORD_W, RECORD_H, 'ink-5');
  for (let y = RECORD_Y; y < RECORD_Y + RECORD_H; y++) {
    for (let x = RECORD_X; x < RECORD_X + RECORD_W; x++) {
      if (get(c, x, y) === null) continue;
      const dx = (x - CENTER_X) / (RECORD_W / 2);
      const dy = (y - CENTER_Y) / (RECORD_H / 2);
      const lit = -dx - 1.4 * dy;
      set(c, x, y, lit > 1.15 ? 'ink-7' : lit > 0.1 ? 'ink-6' : 'ink-5');
    }
  }
  ellipse(c, RECORD_X + 1, RECORD_Y + 1, RECORD_W - 2, RECORD_H - 2, 'ink-1');
  ellipse(c, RECORD_X + 5, RECORD_Y + 3, RECORD_W - 10, RECORD_H - 6, 'ink-2', false);
  set(c, CENTER_X, CENTER_Y, 'ink-6');
  outline(c, { selective: true });
  return c;
}

/** The platter's cast shadow on the plinth, down and to the right. */
function platterShadow(c: Canvas): void {
  const bottoms = ellipseBottoms(RECORD_X, RECORD_Y, RECORD_W, RECORD_H);
  for (const [x, yb] of bottoms) if (x > CENTER_X + 2) set(c, x + 1, yb + 4, 'ink-4');
  for (let y = CENTER_Y - 2; y <= CENTER_Y + 5; y++) set(c, RECORD_X + RECORD_W + 1, y, 'ink-4');
}

function controls(c: Canvas, broken: boolean): void {
  // start/stop key in the front-left corner, power LED beside it on the lip
  stamp(c, 2, 19, [
    '000000',
    '077660',
    '044330',
    '000000',
  ]);
  set(c, 8, 22, broken ? 'ink-3' : 'red-2');
  // pitch fader: slot down the right edge, cap a little above the middle
  stamp(c, 35, 12, [
    '.0.',
    '.1.',
    '.1.',
    '000',
    '070',
    '030',
    '000',
    '.1.',
    '.1.',
    '.0.',
  ]);
}

// The arm column, x 29..39 from y 0: counterweight up at the back, the pivot on its round base,
// the S-arm curving down to the headshell, which rests on the arm rest. '3' under the arm is its
// drop shadow on the plinth.
const ARM_READY = [
  '...0000...',
  '..024310..',
  '..013210..',
  '...0000...',
  '....060...',
  '..067750..',
  '.06766540.',
  '.05655430.',
  '..044330..',
  '....0743..',
  '....0743..',
  '....0743..',
  '....0743..',
  '...07433..',
  '..07433...',
  '0067433...',
  '0611043...',
  '01100.....',
  '.00.......',
];
// Snapped: the pivot and counterweight remain, a jagged stub sticks out of the pivot.
const ARM_BROKEN = [
  '...0000...',
  '..024310..',
  '..013210..',
  '...0000...',
  '....060...',
  '..067750..',
  '.06766540.',
  '.05655430.',
  '..044330..',
  '....070...',
  '.....0....',
];

function tonearm(c: Canvas, broken: boolean): void {
  stamp(c, 29, 0, broken ? ARM_BROKEN : ARM_READY);
  if (!broken) {
    // arm rest: a little post holding the arm
    stamp(c, 32, 13, ['0', '4', '0']);
  } else {
    // the snapped arm lies across the front of the plinth, headshell first
    stamp(c, 19, 19, [
      '.......00000000.',
      '000000777777730.',
      '0611004444433300',
      '01100.00000000..',
      '.00.............',
    ]);
  }
}

function crack(c: Canvas): void {
  // a crack from the bottom of the front face up across the top to the platter, chipped (lit) on its left
  stamp(c, 9, 16, [
    '....61.',
    '...61..',
    '...1...',
    '..61...',
    '..1....',
    '.61....',
    '.1.....',
    '61.....',
    '01.....',
    '.0.....',
    '.0.....',
  ]);
  // a chip knocked out of the front-right corner
  set(c, 37, 25, null);
  set(c, 36, 25, 'ink-0');
  set(c, 37, 24, 'ink-0');
  // scorch round the snapped pivot
  stamp(c, 30, 8, ['.33..', '3443.', '.34..']);
}

const SMOKE: Readonly<Record<string, Pixel>> = { a: 'ink-7', b: 'ink-6', c: 'ink-5', d: 'ink-3', e: 'ink-4' };

/**
 * One wisp from the snapped pivot: a 1 px stem curling up and left into a 4x3 puff, then a bigger
 * 5x4 puff. Each puff has a dark rim on top (it holds against the silver plinth), ink-7 only on its
 * top-left 2 px and a darker underside. Row 0 stays empty so the frame edge never slices a puff.
 */
function smoke(c: Canvas): void {
  // the stem rises from the scorch at the pivot (x 29, rows 9-10), the small puff sits by the pivot,
  // the big one drifts up and left over the plinth's back edge
  stamp(c, 19, 1, [
    '..ddd.......',
    '.dabbd......',
    'dabbbbd.....',
    'dbbbbce.....',
    '.eeeee.ddd..',
    '......dabbd.',
    '......dabce.',
    '.......eee..',
    '..........c.',
    '..........c.',
  ], SMOKE);
}

/** Two sparks at the snapped pivot: a white-hot core ringed in gold, and a smaller one. */
function sparks(c: Canvas): void {
  stamp(c, 35, 7, ['.A.', 'AWA', '.A.'], { A: 'amber-3', W: 'ink-7' });
  stamp(c, 30, 11, ['A.', '.a'], { A: 'amber-3', a: 'amber-2' });
}

function frame(broken: boolean): Canvas {
  const c = plinth();
  platterShadow(c);
  paste(c, platter(broken), 0, 0);
  controls(c, broken);
  tonearm(c, broken);
  if (broken) {
    crack(c);
    smoke(c);
    sparks(c);
  }
  // contact shadow on the table under the front edge, shifted right (light from the top-left)
  rect(c, 3, 27, 36, 1, 'ink-1');
  return c;
}

export default {
  name: 'turntable',
  frameWidth: W,
  frameHeight: H,
  frames: [frame(false), frame(true)],
  tags: [
    { name: 'turntable-ready', from: 0, to: 0 },
    { name: 'turntable-broken', from: 1, to: 1 },
  ],
  source: 'drawn by code: brushed plinth, ellipse platter with strobe rim and mat, hand-placed arm, controls, crack and smoke, outline pass',
} satisfies SpriteDef;
