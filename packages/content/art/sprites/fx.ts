// Effect icons shown over the rigs: hit spark, shield, stun, slow, haste, trap, defender. 16x16 each.
// Grids for the spark, snail and bolt; code draws the shield bubble, stun orbit, trap plate and badge.
import { canvas, ellipse, fromGrid, get, outline, paste, set, type Canvas, type Pixel, type SpriteDef } from '../canvas.ts';

const S = 16;

const L: Record<string, Pixel> = {
  '0': 'ink-0', '1': 'ink-1', '2': 'ink-2', '3': 'ink-3', '4': 'ink-4', '5': 'ink-5', '6': 'ink-6', '7': 'ink-7',
  A: 'amber-0', a: 'amber-1', o: 'amber-2', y: 'amber-3',
  R: 'red-0', r: 'red-1', s: 'red-2', t: 'red-3',
  B: 'blue-0', b: 'blue-1', c: 'blue-2', i: 'blue-3',
  G: 'green-0', g: 'green-1', h: 'green-2',
  P: 'pink-0', p: 'pink-1', q: 'pink-2',
};
const g = (rows: readonly string[]): Canvas => fromGrid(rows, L);

// ---------------------------------------------------------------- spark: flash, full burst, scatter
const SPARK = [
  g([
    '................',
    '................',
    '................',
    '.......oo.......',
    '.......yy.......',
    '.......yy.......',
    '......oyyo......',
    '...oyyy77yyyo...',
    '...oyyy77yyyo...',
    '......oyyo......',
    '.......yy.......',
    '.......yy.......',
    '.......oo.......',
    '................',
    '................',
    '................',
  ]),
  g([
    '.......oo.......',
    '.......yy.......',
    '..o....yy....o..',
    '...y...yy...y...',
    '....y..77..y....',
    '.....oy77yo.....',
    '......7777......',
    'oyyyy777777yyyyo',
    'oyyyy777777yyyyo',
    '......7777......',
    '.....oy77yo.....',
    '....y..77..y....',
    '...y...yy...y...',
    '..o....yy....o..',
    '.......yy.......',
    '.......oo.......',
  ]),
  g([
    '.......yy.......',
    '.......oo.......',
    '..t..........t..',
    '...o........o...',
    '................',
    '................',
    '................',
    'yo............oy',
    'yo............oy',
    '................',
    '................',
    '................',
    '...o........o...',
    '..t..........t..',
    '.......oo.......',
    '.......yy.......',
  ]),

];

// ---------------------------------------------------------------- shield: a cyan bubble, shimmering
// A solid 2 px band (a 16 px disc minus a 12 px hole, so no gaps at the diagonals): blue-1 outside,
// blue-2 inside. A blue-3 sheen on the top-left thickens into a crescent that carries the ink-7 glint;
// both slide a step round the ring between the two frames. The centre stays clear so the rig shows.
function shield(phase: number): Canvas {
  const c = canvas(S, S);
  const outer = canvas(S, S);
  const inner = canvas(S, S);
  const hole = canvas(S, S);
  ellipse(outer, 0, 0, 16, 16, 'blue-1');
  ellipse(inner, 1, 1, 14, 14, 'blue-2');
  ellipse(hole, 2, 2, 12, 12, 'blue-2');
  const deg = (x: number, y: number): number => Math.atan2(y - 7.5, x - 7.5) * (180 / Math.PI);
  const mid = -135 + phase * 22;
  const band = (x: number, y: number): boolean => get(outer, x, y) !== null && get(hole, x, y) === null;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!band(x, y)) continue;
      const lit = get(inner, x, y) !== null && Math.abs(deg(x, y) - mid) < 38;
      set(c, x, y, lit ? 'blue-3' : get(inner, x, y) !== null ? 'blue-2' : 'blue-1');
    }
  }
  // the crescent: the middle of the sheen bulges 1 px into the hollow
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (get(hole, x, y) === null || Math.abs(deg(x, y) - mid) >= 16) continue;
      if (band(x - 1, y) || band(x, y - 1)) set(c, x, y, 'blue-3');
    }
  }
  // the glint sits on the crescent, at its centre
  let best: [number, number] = [0, 0];
  let bestD = Infinity;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (get(c, x, y) !== 'blue-3' || get(hole, x, y) === null) continue;
      const d = Math.abs(deg(x, y) - mid);
      if (d < bestD) {
        bestD = d;
        best = [x, y];
      }
    }
  }
  set(c, best[0], best[1], 'ink-7');
  return c;
}

// ---------------------------------------------------------------- stun: ice crystals circling
const CRYSTAL_BIG = g(['..i..', '.iii.', 'ii7ii', '.iii.', '..i..']);
const CRYSTAL_SMALL = g(['.c.', 'cic', '.c.']);

function stun(phase: number): Canvas {
  const c = canvas(S, S);
  // the orbit: a thin ring the crystals ride on
  ellipse(c, 1, 5, 14, 6, 'blue-1', false);
  const items: { x: number; y: number; big: boolean }[] = [];
  for (let k = 0; k < 3; k++) {
    const ang = ((90 + k * 120 + phase * 60) * Math.PI) / 180;
    const x = 8 + 5 * Math.cos(ang);
    const y = 8 + 2.6 * Math.sin(ang);
    items.push({ x, y, big: Math.sin(ang) > -0.2 });
  }
  // back ones first
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const sprite = it.big ? CRYSTAL_BIG : CRYSTAL_SMALL;
    const piece = canvas(sprite.width + 2, sprite.height + 2);
    paste(piece, sprite, 1, 1);
    outline(piece, { color: 'blue-0' });
    paste(c, piece, Math.round(it.x - piece.width / 2), Math.round(it.y - piece.height / 2));
  }
  return c;
}

// ---------------------------------------------------------------- slow: a snail
const SNAIL_HEAD = g([
  '1...1',
  'p...p',
  '.p.p.',
  '.pqp.',
  'pqqqp',
  'pqqqp',
  'pqqpp',
  'pqppp',
  'ppppp',
]);

function slow(): Canvas {
  const c = canvas(S, S);
  // foot: a soft pink slug, the head raised on the right with two eye stalks
  ellipse(c, 0, 10, 14, 4, 'pink-1');
  for (let x = 1; x < 12; x++) if (get(c, x, 10) === 'pink-1') set(c, x, 10, 'pink-2');
  paste(c, SNAIL_HEAD, 9, 2);
  // shell: amber, lit top-left, a spiral groove
  ellipse(c, 1, 2, 10, 10, 'amber-2');
  for (let y = 2; y < 12; y++) {
    for (let x = 1; x < 11; x++) {
      if (get(c, x, y) !== 'amber-2') continue;
      const d = x - 5.5 + (y - 6.5);
      if (d < -4) set(c, x, y, 'amber-3');
      else if (d > 4) set(c, x, y, 'amber-1');
    }
  }
  ellipse(c, 3, 4, 6, 6, 'amber-1', false);
  set(c, 4, 4, 'amber-2');
  set(c, 3, 5, 'amber-2');
  set(c, 5, 6, 'amber-1');
  set(c, 6, 6, 'amber-3');
  outline(c, { selective: true });
  return c;
}

// ---------------------------------------------------------------- haste: a bolt with speed lines
const HASTE = g([
  '.........AAAAA..',
  '........AyyyyA..',
  '.......AyyyoA...',
  '......AyyyoA....',
  '.566.AyyyoAAAA..',
  '....AyyyyyyyyA..',
  '...AAAAAyyyoA...',
  '.5666.AyyyoA....',
  '.....AyyyoA.....',
  '....AyyoA.......',
  '56.AyyoA........',
  '..AyyoA.........',
  '.AyoA...........',
  '.AoA............',
  '.AA.............',
  '................',
]);

// ---------------------------------------------------------------- trap: a hazard-striped plate in the ground
function trap(): Canvas {
  const c = canvas(S, S);
  ellipse(c, 1, 8, 14, 6, 'ink-2');
  ellipse(c, 1, 7, 14, 6, 'amber-3');
  for (let y = 7; y < 13; y++) {
    for (let x = 1; x < 15; x++) {
      if (get(c, x, y) !== 'amber-3') continue;
      if (Math.floor((x + y) / 2) % 2 === 0) set(c, x, y, 'ink-1');
    }
  }
  ellipse(c, 1, 7, 14, 6, 'ink-4', false);
  for (let x = 4; x < 12; x++) if (get(c, x, 7) === 'ink-4') set(c, x, 7, 'ink-6');
  // a red arming light in the middle
  set(c, 7, 9, 'red-2');
  set(c, 8, 9, 'red-3');
  outline(c);
  return c;
}

// ---------------------------------------------------------------- defender: a heater shield badge
// Row spans of the shield, outline included (x from, x to), rows 1..15.
const SHIELD_SPANS: [number, number][] = [
  [1, 13], [1, 13], [1, 13], [1, 13], [1, 13], [1, 13], [1, 13], [1, 13],
  [2, 12], [2, 12], [3, 11], [4, 10], [5, 9], [6, 8], [7, 7],
];
const STAR = g(['..7..', '.777.', '77777', '.777.', '.7.7.']);
function defender(): Canvas {
  const c = canvas(S, S);
  const inside = (x: number, y: number): boolean => {
    const sp = SHIELD_SPANS[y - 1];
    return sp !== undefined && x >= sp[0] && x <= sp[1];
  };
  for (let y = 1; y <= 15; y++) {
    for (let x = 0; x < S; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const rim = !edge && (!inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2) || !inside(x - 1, y + 1) || !inside(x + 1, y + 1));
      let p: Pixel;
      if (edge) p = 'ink-0';
      else if (rim) p = x + y <= 9 ? 'ink-7' : x - y >= 8 || y >= 11 ? 'ink-4' : 'ink-6';
      else p = x + y <= 8 ? 'blue-3' : x + y >= 16 ? 'blue-1' : 'blue-2';
      set(c, x, y, p);
    }
  }
  paste(c, STAR, 5, 4);
  set(c, 9, 7, 'ink-6');
  set(c, 8, 8, 'ink-6');
  // lit outline on the top and left
  for (let x = 1; x <= 13; x++) set(c, x, 1, 'ink-1');
  for (let y = 1; y <= 8; y++) set(c, 1, y, 'ink-1');
  return c;
}

function rimmed(c: Canvas): Canvas {
  const out = canvas(S, S);
  paste(out, c, 0, 0);
  outline(out, { color: 'red-1' });
  return out;
}

const FRAMES: Canvas[] = [rimmed(SPARK[0]!), rimmed(SPARK[1]!), SPARK[2]!, shield(0), shield(1), stun(0), stun(1), slow(), HASTE, trap(), defender()];

export default {
  name: 'fx',
  frameWidth: S,
  frameHeight: S,
  frames: FRAMES,
  durations: [60, 90, 120, 260, 260, 220, 220, 150, 150, 150, 150],
  tags: [
    { name: 'spark', from: 0, to: 2 },
    { name: 'shield', from: 3, to: 4 },
    { name: 'stun', from: 5, to: 6 },
    { name: 'slow', from: 7, to: 7 },
    { name: 'haste', from: 8, to: 8 },
    { name: 'trap', from: 9, to: 9 },
    { name: 'defender', from: 10, to: 10 },
  ],
  source: 'pixel grids for the spark, snail and bolt; code draws the shield bubble, stun orbit, trap plate and defender badge',
} satisfies SpriteDef;
