// Hip-hop battle backdrop (M1): a street block at dusk in the hip-hop town. One 480x208 frame.
// Everything is drawn by code in wrapped x (x mod 480), so the left and right edges tile.
// Row 0 is flat sky (ink-1) and row 207 flat asphalt (ink-2): the game extends them with flat colour.
// Layout (image px): sky 0-57, wall coping 58, bricks 62-109, ground 110-207.
// Fighter spots: Scratch Boy + DJ table centred (140,130), opponent centred (330,120) in the
// streetlight's pool, amp on his right. Both stay above the 56 px menu at 320x180 (rows 14-137 show).
import type { PaletteColor } from '../../src/palette.ts';
import { canvas, ellipse, fromGrid, get, line, set, shade, type Canvas, type Pixel, type SpriteDef } from '../canvas.ts';

const W = 480;
const H = 208;

const WALL_TOP = 58; // coping top row
const BRICK_TOP = 62; // first brick course (mortar row)
const GROUND_Y = 110; // first ground row
const BLD_X0 = 60; // left building: record shop with a fire escape
const BLD_X1 = 150;
const BLD_TOP = 10;
const PILLAR_X0 = 404; // brick pillar where the wall ends and the fence starts
const PILLAR_X1 = 414;
const FENCE_X0 = PILLAR_X1;
const FENCE_X1 = W + BLD_X0; // the fence runs past the seam to the building
const LOT_Y = 96; // far lot horizon, seen through the fence
const LAMP_X = 289; // streetlight post (3 px wide: LAMP_X..LAMP_X+2)
const LAMP_HEAD_X = 320; // lamp head left edge: the arm reaches right, the bowl is centred on x 329
const LAMP_HEAD_Y = 25;
const LIGHT_X = 329; // centre of the light on the wall, right above the opponent
const SPOT_HERO = { x: 140, y: 130, w: 112, h: 24 };
const SPOT_FOE = { x: 330, y: 120, w: 62, h: 13 }; // the lamp's pool of light

const scene = canvas(W, H);

// ---------------------------------------------------------------- helpers (wrapped x)

const wrapX = (x: number): number => ((Math.floor(x) % W) + W) % W;
function put(x: number, y: number, col: Pixel): void {
  set(scene, wrapX(x), y, col);
}
function at(x: number, y: number): Pixel {
  return get(scene, wrapX(x), y);
}
/** Pastes a layer's opaque pixels with its top-left at (ox, oy), wrapping in x. */
function stamp(src: Canvas, ox: number, oy: number): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const p = src.pixels[y * src.width + x] ?? null;
      if (p !== null) put(ox + x, oy + y, p);
    }
  }
}
/** Deterministic hash in [0, 1). */
function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1103515245);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h ^ (h >>> 15), 2246822519 | 0);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

type Pt = readonly [number, number];

/** Fills a polygon (pixel centres inside, even-odd). */
function fillPoly(c: Canvas, pts: readonly Pt[], col: Pixel): void {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      if (a[1] <= cy !== b[1] <= cy) xs.push(a[0] + ((cy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]! - 0.5); x <= Math.floor(xs[i + 1]! - 0.5); x++) set(c, x, y, col);
    }
  }
}

/** Polygon of a thick polyline with mitred joins. */
function bandPoly(points: readonly Pt[], half: number): Pt[] {
  const n = points.length;
  const normal = (a: Pt, b: Pt): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    return [-dy / l, dx / l];
  };
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    let nx: number;
    let ny: number;
    if (i === 0) [nx, ny] = normal(p, points[1]!);
    else if (i === n - 1) [nx, ny] = normal(points[n - 2]!, p);
    else {
      const a = normal(points[i - 1]!, p);
      const b = normal(p, points[i + 1]!);
      const mx = a[0] + b[0];
      const my = a[1] + b[1];
      const ml = Math.hypot(mx, my);
      const d = (mx / ml) * a[0] + (my / ml) * a[1];
      nx = mx / ml / d;
      ny = my / ml / d;
    }
    left.push([p[0] + nx * half, p[1] + ny * half]);
    right.push([p[0] - nx * half, p[1] - ny * half]);
  }
  return [...left, ...right.reverse()];
}

/** 1 px ring of `col` in the transparent pixels around a layer's opaque pixels (4-neighbours). */
function ring(c: Canvas, col: PaletteColor): void {
  const src = c.pixels.slice();
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.width && y < c.height && src[y * c.width + x] !== null;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (src[y * c.width + x] !== null) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) c.pixels[y * c.width + x] = col;
    }
  }
}

/** Copies b's opaque pixels over a (same size). */
function over(a: Canvas, b: Canvas): void {
  for (let i = 0; i < b.pixels.length; i++) if (b.pixels[i] !== null) a.pixels[i] = b.pixels[i] ?? null;
}

// ---------------------------------------------------------------- sky

const SKY_BANDS: readonly [number, PaletteColor][] = [
  [0, 'ink-1'],
  [13, 'dusk-0'],
  [29, 'dusk-1'],
  [41, 'dusk-2'],
  [50, 'dusk-3'],
];

function skyColor(x: number, y: number): PaletteColor {
  let i = 0;
  while (i + 1 < SKY_BANDS.length && y >= SKY_BANDS[i + 1]![0]) i++;
  const here = SKY_BANDS[i]!;
  // 2-row checker at each band edge: the last row of the band above and the first row of this one.
  const next = SKY_BANDS[i + 1];
  if (next && y === next[0] - 1 && (x + y) % 2 === 0) return next[1];
  if (i > 0 && y === here[0] && (x + y) % 2 === 1) return SKY_BANDS[i - 1]![1];
  return here[1];
}

for (let y = 0; y < GROUND_Y; y++) for (let x = 0; x < W; x++) put(x, y, skyColor(x, y));

// Long dusk cloud streaks: flat bottoms, a lit run on the top-left.
function cloud(parts: readonly [number, number, number, number][], body: PaletteColor, lit: PaletteColor): void {
  const l = canvas(W, 60);
  for (const [cx, cy, w, h] of parts) {
    for (let x = 0; x < w; x++) {
      const t = (x + 0.5) / w - 0.5;
      const top = Math.round(cy - h * Math.sqrt(Math.max(0, 0.25 - t * t)) * 2);
      for (let y = top; y < cy; y++) set(l, wrapX(cx - w / 2 + x), y, body);
    }
  }
  let minX = W;
  let maxX = 0;
  for (const [cx, , w] of parts) {
    minX = Math.min(minX, cx - w / 2);
    maxX = Math.max(maxX, cx + w / 2);
  }
  const src = l.pixels.slice();
  for (let y = 1; y < l.height - 1; y++) {
    for (let x = 0; x < W; x++) {
      if (src[y * W + x] !== null && src[(y - 1) * W + x] === null && src[(y + 1) * W + x] !== null) {
        const u = (wrapX(x - minX) + 0.5) / (maxX - minX);
        if (u < 0.5) l.pixels[y * W + x] = lit;
      }
    }
  }
  stamp(l, 0, 0);
}
cloud([[40, 20, 70, 4], [70, 19, 40, 5], [96, 20, 30, 2]], 'dusk-1', 'dusk-2');
cloud([[250, 17, 54, 3], [276, 18, 36, 4]], 'dusk-1', 'dusk-2');
cloud([[420, 35, 80, 3], [446, 35, 44, 5], [470, 36, 30, 2]], 'dusk-2', 'dusk-3');
cloud([[170, 38, 46, 3], [186, 38, 24, 4]], 'dusk-2', 'dusk-3');

// A few faint sparkles in the dark sky (5 px plus, dusk-2 heart).
for (const [x, y] of [[36, 6], [118, 3], [192, 8], [300, 4], [350, 7], [430, 8]] as const) {
  put(x, y, 'dusk-2');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(x + dx, y + dy, 'dusk-1');
}

// Crescent moon, upper right.
{
  const m = canvas(16, 16);
  ellipse(m, 1, 1, 13, 13, 'dusk-3');
  const bite = canvas(16, 16);
  ellipse(bite, 5, 0, 13, 12, 'dusk-3');
  for (let i = 0; i < m.pixels.length; i++) if (bite.pixels[i] !== null) m.pixels[i] = null;
  stamp(m, 364, 18);
}

// ---------------------------------------------------------------- skyline

// Far towers: dusk-1 silhouettes against the glow.
{
  let x = 0;
  let i = 0;
  while (x < W) {
    const w = 10 + Math.floor(hash(i, 1, 7) * 22);
    const top = 39 + Math.floor(hash(i, 2, 7) * 11);
    for (let yy = top; yy < LOT_Y; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, 'dusk-1');
    const r = hash(i, 3, 7);
    if (r < 0.25) {
      const ax = x + Math.floor(w / 2);
      for (let yy = top - 6; yy < top; yy++) put(ax, yy, 'dusk-1');
    } else if (r < 0.5) {
      for (let yy = top - 3; yy < top; yy++) for (let xx = x + 3; xx < x + w - 3; xx++) put(xx, yy, 'dusk-1');
    }
    x += w;
    i++;
  }
}

// Near blocks: ink-1 silhouettes (darker than every sky band), a few lit floors, water tanks, a beacon.
const NEAR_COL: PaletteColor = 'ink-1';
type Block = readonly [x: number, w: number, top: number, kind: 'plain' | 'tank' | 'spire' | 'step' | 'box'];
const NEAR: readonly Block[] = [
  [140, 30, 44, 'plain'],
  [170, 22, 36, 'tank'],
  [192, 16, 46, 'box'],
  [203, 28, 31, 'spire'], // needle and beacon against the dusk-0 band, clear of the clouds
  [236, 30, 38, 'step'],
  [266, 24, 44, 'plain'],
  [290, 20, 38, 'box'],
  [310, 30, 41, 'box'], // kept low: the lamp head hangs in front of this block's sky
  [340, 22, 40, 'tank'],
  [362, 30, 46, 'plain'],
  [392, 24, 37, 'box'],
  [416, 28, 45, 'tank'],
  [444, 24, 36, 'step'],
  [468, 30, 45, 'plain'],
  [498, 22, 39, 'box'],
  [520, 30, 44, 'plain'],
];
NEAR.forEach(([bx, bw, top, kind], bi) => {
  for (let y = top; y < LOT_Y; y++) for (let x = bx; x < bx + bw; x++) put(x, y, NEAR_COL);
  if (kind === 'tank') {
    const tx = bx + 5;
    const tw = 8;
    for (let y = top - 3; y < top; y++) {
      put(tx + 1, y, NEAR_COL);
      put(tx + tw - 2, y, NEAR_COL);
    }
    for (let y = top - 10; y < top - 3; y++) for (let x = tx; x < tx + tw; x++) put(x, y, NEAR_COL);
    for (let k = 0; k < 3; k++) for (let x = tx + 1 + k; x < tx + tw - 1 - k; x++) put(x, top - 11 - k, NEAR_COL);
  } else if (kind === 'spire') {
    for (let y = top - 5; y < top; y++) for (let x = bx + 4; x < bx + bw - 4; x++) put(x, y, NEAR_COL);
    for (let y = top - 9; y < top - 5; y++) for (let x = bx + 9; x < bx + bw - 9; x++) put(x, y, NEAR_COL);
    const sx = bx + Math.floor(bw / 2);
    for (let y = top - 17; y < top - 9; y++) put(sx, y, NEAR_COL);
    put(sx, top - 18, 'red-1');
    put(sx, top - 17, 'red-1');
  } else if (kind === 'step') {
    for (let y = top - 4; y < top; y++) for (let x = bx + 5; x < bx + bw - 5; x++) put(x, y, NEAR_COL);
  } else if (kind === 'box') {
    for (let y = top - 3; y < top; y++) for (let x = bx + 3; x < bx + 9; x++) put(x, y, NEAR_COL);
  }
  // Windows (1x2, on a 4x5 grid): a few floors are lit, each in one run of neighbouring rooms.
  let floor = 0;
  for (let y = top + 4; y < LOT_Y - 2; y += 5, floor++) {
    const r = hash(bi, floor, 11);
    if (r > 0.24) continue;
    const cols = Math.floor((bw - 4) / 4);
    const start = Math.floor(hash(bi, floor, 12) * cols);
    const len = 1 + Math.floor(hash(bi, floor, 13) * 3);
    const col: PaletteColor = r < 0.06 ? 'blue-1' : 'amber-1';
    for (let k = start; k < Math.min(cols, start + len); k++) {
      const x = bx + 3 + k * 4;
      const inLot = wrapX(x) >= FENCE_X0 || wrapX(x) < BLD_X0;
      // stop above the wall, or above the fence's top rail in the lots (the mesh would break them into specks)
      if (y + 1 >= (inLot ? 64 : WALL_TOP)) continue;
      put(x, y, col);
      put(x, y + 1, col);
    }
  }
});

// The lot behind the fence, seen only through it.
for (let x = FENCE_X0; x < FENCE_X1; x++) {
  for (let y = LOT_Y; y < GROUND_Y; y++) put(x, y, y < LOT_Y + 2 ? 'ink-2' : 'ink-1');
}

// A tree in the lot, its crown rising above the fence.
{
  const t = canvas(60, 64);
  // trunk, 4 px: lit left column, brick-1 body, brick-0 shadow side
  for (let y = 38; y < 64; y++) {
    set(t, 28, y, 'brick-2');
    set(t, 29, y, 'brick-1');
    set(t, 30, y, 'brick-1');
    set(t, 31, y, 'brick-0');
  }
  // two limbs, 2 px thick, forking from the trunk up into the crown's underside (lit on their upper-left side)
  for (let k = 0; k < 2; k++) {
    line(t, 28 + k, 49, 19 + k, 36, k === 0 ? 'brick-1' : 'brick-0');
    line(t, 30 + k, 47, 40 + k, 36, k === 0 ? 'brick-1' : 'brick-0');
  }
  // Leaf masses painted back to front: [x, y, r, lit]. Only the three top masses catch the light (a
  // green-1 cap on their top-left), so the tree stays quiet beside the graffiti.
  const lobes: readonly [number, number, number, boolean][] = [
    [24, 32, 8, false],
    [38, 32, 8, false],
    [9, 31, 7, false],
    [51, 31, 6, false],
    [4, 25, 3, false],
    [55, 25, 3, false],
    [48, 14, 4, false],
    [11, 15, 4, false],
    [21, 6, 4, false],
    [37, 7, 4, false],
    [30, 15, 13, true],
    [18, 24, 11, true],
    [43, 22, 11, true],
  ];
  lobes.forEach(([bx, by, r, lit], i) => {
    for (let y = 0; y < t.height; y++) {
      for (let x = 0; x < t.width; x++) {
        const lx = (x + 0.5 - bx) / r;
        const ly = ((y + 0.5 - by) * 1.2) / r;
        if (lx * lx + ly * ly > 1) continue;
        // the cap's lower edge is scalloped, like leaf clumps, not a straight cut
        const along = (lx - ly) / Math.SQRT2;
        const edge = -0.5 + 0.16 * Math.cos(along * Math.PI * 2.3 + i);
        set(t, x, y, lit && lx + ly < edge && ly < -0.15 ? 'green-1' : 'green-0');
      }
    }
  });
  // no lone or 1 px-thin highlight: a green-1 pixel needs two green-1 neighbours
  for (let pass = 0; pass < 2; pass++) {
    const src = t.pixels.slice();
    const g1 = (x: number, y: number): number => (x >= 0 && x < t.width && src[y * t.width + x] === 'green-1' ? 1 : 0);
    for (let y = 0; y < t.height; y++) {
      for (let x = 0; x < t.width; x++) {
        if (src[y * t.width + x] === 'green-1' && g1(x - 1, y) + g1(x + 1, y) + g1(x, y - 1) + g1(x, y + 1) < 2) set(t, x, y, 'green-0');
      }
    }
  }
  stamp(t, 416, LOT_Y - 60);
}

// ---------------------------------------------------------------- bricks

interface BrickHit {
  mortar: boolean;
  id: number; // brick identity, for per-brick variation
  u: number; // x inside the brick (0..8)
  v: number; // y inside the brick (0..2)
  cx: number; // brick centre
  cy: number;
}
function brick(x: number, y: number, y0: number): BrickHit {
  const row = Math.floor((y - y0) / 4);
  const v = (((y - y0) % 4) + 4) % 4;
  const off = (((row % 2) + 2) % 2) * 5;
  const xx = wrapX(x + off);
  const u = xx % 10;
  const id = row * 1000 + Math.floor(xx / 10);
  return { mortar: v === 0 || u === 0, id, u: u - 1, v: v - 1, cx: x - u + 5, cy: y0 + row * 4 + 2 };
}

/** Light level of the streetlight on the wall at a brick (0 none, 1 rim, 2 lit, 3 bright). */
function lampLevel(cx: number, cy: number, id: number): number {
  const dx = cx - LIGHT_X;
  const dy = (cy - WALL_TOP) * 0.62;
  const d = Math.hypot(dx, dy) + (hash(id, 5, 3) - 0.5) * 5;
  return d < 15 ? 3 : d < 27 ? 2 : d < 36 ? 1 : 0;
}

function brickColor(x: number, y: number, y0: number, lit: boolean): PaletteColor {
  const b = brick(x, y, y0);
  const level = lit ? lampLevel(b.cx, b.cy, b.id) : 0;
  if (b.mortar) return level > 2 ? 'brick-1' : 'brick-0';
  if (level === 3) return b.v === 0 && b.u < 7 ? 'brick-3' : 'brick-2';
  if (level === 2) return 'brick-2';
  if (level === 1) return hash(b.id, 4, 2) < 0.45 ? 'brick-2' : 'brick-1';
  return hash(b.id, 9, 1) < 0.1 ? 'brick-2' : 'brick-1';
}

// ---------------------------------------------------------------- the low wall

for (let x = BLD_X1; x < PILLAR_X0; x++) {
  put(x, WALL_TOP, 'ink-4');
  put(x, WALL_TOP + 1, 'ink-3');
  put(x, WALL_TOP + 2, 'ink-3');
  put(x, WALL_TOP + 3, 'ink-2');
  for (let y = BRICK_TOP; y < GROUND_Y; y++) put(x, y, brickColor(x, y, BRICK_TOP, true));
  put(x, BRICK_TOP, 'brick-0'); // shadow under the coping
}

// Brick pillar at the wall's end, a little taller, with a cap.
for (let x = PILLAR_X0; x < PILLAR_X1; x++) {
  for (let y = 54; y < GROUND_Y; y++) {
    let c = brickColor(x + 3, y, 54, false);
    if (x === PILLAR_X0 && y > 54) c = brick(x + 3, y, 54).mortar ? 'brick-1' : 'brick-2';
    if (x === PILLAR_X1 - 1) c = 'brick-0';
    put(x, y, c);
  }
}
for (let x = PILLAR_X0 - 1; x <= PILLAR_X1; x++) {
  put(x, 51, 'ink-4');
  put(x, 52, x === PILLAR_X1 ? 'ink-2' : 'ink-3');
  put(x, 53, 'ink-2');
}

// ---------------------------------------------------------------- graffiti piece

/**
 * The big abstract piece on the wall: a crowned record throwing a zigzag arrow toward the
 * opponent, speed bars behind it, and music notes. Ink-1 outlines and a blue-0 3D block.
 * Only accent -0/-1 tones, so it stays behind the fighters.
 */
function graffiti(): Canvas {
  const GW = 138;
  const GH = 48;

  const arrowLine: Pt[] = [
    [50, 30],
    [66, 14],
    [83, 31],
    [99, 15],
    [108, 15],
  ];
  const arrow = canvas(GW, GH);
  fillPoly(arrow, bandPoly(arrowLine, 5.5), 'pink-1');
  fillPoly(arrow, [[106, 3], [130, 15.5], [106, 28]], 'pink-1');
  // the lower part of the band fades to red, split along the centre line
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      if (get(arrow, x, y) === null) continue;
      let cy = 15.5;
      for (let i = 0; i + 1 < arrowLine.length; i++) {
        const a = arrowLine[i]!;
        const b = arrowLine[i + 1]!;
        if (x + 0.5 >= a[0] && x + 0.5 <= b[0]) cy = a[1] + ((x + 0.5 - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
      }
      if (x + 0.5 < arrowLine[0]![0]) cy = arrowLine[0]![1];
      if (y + 0.5 > cy + 1) set(arrow, x, y, 'red-1');
    }
  }
  // shine dashes on the top edges
  for (const [x, y] of [[62, 14], [63, 13], [64, 12], [95, 14], [96, 13], [97, 12], [109, 6], [110, 6], [111, 7]] as const) {
    set(arrow, x, y, 'ink-4');
  }

  // speed bars behind the record (green)
  const bars = canvas(GW, GH);
  for (const [x, y, w] of [
    [6, 14, 26],
    [2, 22, 30],
    [8, 30, 24],
  ] as const) {
    ellipse(bars, x, y, w, 5, 'green-1');
    for (let i = 2; i < w - 4; i++) set(bars, x + i, y + 4, 'green-0');
  }

  const disc = canvas(GW, GH);
  ellipse(disc, 20, 5, 37, 37, 'ink-2');
  ellipse(disc, 24, 9, 29, 29, 'ink-1', false);
  ellipse(disc, 28, 13, 21, 21, 'ink-1', false);
  ellipse(disc, 32, 17, 13, 13, 'red-0');
  ellipse(disc, 33, 18, 11, 11, 'red-1');
  ellipse(disc, 37, 22, 3, 3, 'ink-1');
  for (const [x, y] of [[26, 11], [27, 10], [28, 9], [29, 9], [30, 8], [31, 8], [25, 12], [25, 13], [24, 14]] as const) {
    set(disc, x, y, 'ink-4');
  }

  const crown = canvas(GW, GH);
  fillPoly(crown, [[24, 11], [21, 2], [28, 6], [32, 1.5], [36, 5], [43, 2], [40, 11]], 'amber-1');
  for (let x = 25; x < 40; x++) set(crown, x, 10, 'amber-0');

  // a beamed pair of notes floating over the zigzag's valley: 2 px stems and beam, 3x2 heads;
  // the counter between the stems is filled with the outline colour, as on a real piece
  const notes = canvas(GW, GH);
  const note = fromGrid(
    [
      '...hhbbbbbbb',
      '...bbbbbbbbb',
      '...bbkkkkkbb',
      '...bbkkkkkbb',
      '...bbkkkkkbb',
      'bbbbbkkbbbbb',
      'bbb..kkbbb..',
    ],
    { b: 'blue-1', h: 'ink-4', k: 'ink-1' },
  );
  for (let y = 0; y < note.height; y++) {
    for (let x = 0; x < note.width; x++) {
      const p = get(note, x, y);
      if (p !== null) set(notes, 77 + x, 3 + y, p);
    }
  }

  const piece = canvas(GW, GH);
  for (const l of [bars, arrow, disc, crown]) {
    const o = canvas(GW, GH);
    over(o, l);
    ring(o, 'ink-1');
    over(piece, o);
  }
  // 3D block down-right
  const block = canvas(GW, GH);
  for (let k = 1; k <= 3; k++) {
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        if (get(piece, x - k, y - k) !== null && get(piece, x, y) === null) set(block, x, y, 'blue-0');
      }
    }
  }
  over(piece, block);
  ring(piece, 'ink-1');
  ring(piece, 'dusk-2'); // light outer outline, as on a real piece

  // the notes float free of the block: only the two outline rings
  const n = canvas(GW, GH);
  over(n, notes);
  ring(n, 'ink-1');
  ring(n, 'dusk-2');
  over(piece, n);

  // drips: paint runs from inside the red fill down over the block and both rings, ending in a bulb
  // (under the arrow's first rise, its top run and its head: not in the valley, where they would reach the ground)
  for (const [x, len] of [[62, 4], [102, 5], [113, 3], [121, 6]] as const) {
    let y0 = -1;
    for (let yy = GH - 1; yy >= 0 && y0 < 0; yy--) if (get(piece, x, yy) === 'red-1') y0 = yy;
    if (y0 < 0) throw new Error(`drip at ${x}: no red fill above`);
    let y1 = y0;
    while (get(piece, x, y1 + 1) !== null) y1++;
    const end = y1 + len;
    for (let y = y0; y <= end; y++) set(piece, x, y, 'red-1');
    set(piece, x + 1, end - 1, 'red-1');
    set(piece, x + 1, end, 'red-0');
  }
  return piece;
}
stamp(graffiti(), 150, 63);

// ---------------------------------------------------------------- left building

function windowAt(x: number, y: number, lit: 'none' | 'amber' | 'blue'): void {
  const w = 14;
  const h = 15;
  for (let i = -1; i <= w; i++) {
    put(x + i, y - 2, 'ink-3');
    put(x + i, y - 1, 'ink-2');
    put(x + i, y + h, 'ink-4');
    put(x + i, y + h + 1, 'ink-2');
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let c: PaletteColor = lit === 'amber' ? 'amber-1' : lit === 'blue' ? 'blue-0' : 'dusk-0';
      if (lit === 'none' && (i + (h - j)) % 17 > 12 && (i + (h - j)) % 17 < 15) c = 'dusk-1';
      if (lit === 'amber' && j < 4) c = 'amber-0';
      if (lit === 'blue' && i > 1 && i < 13 && j > 2 && j < 14) c = 'blue-1';
      if (j === 0 || i === 0) c = 'brick-0';
      if (j === 7 || i === 7) c = lit === 'none' ? 'ink-2' : 'brick-0';
      put(x + i, y + j, c);
    }
  }
}

const WIN_COLS = [68, 98, 128] as const;
const WIN_TOP = 20;
const WIN_MID = 42;
{
  for (let x = BLD_X0; x < BLD_X1; x++) {
    for (let y = BLD_TOP; y < GROUND_Y; y++) {
      let c = brickColor(x, y, BLD_TOP + 2, false);
      if (x === BLD_X0) c = brick(x, y, BLD_TOP + 2).mortar ? 'brick-1' : 'brick-2';
      if (x === BLD_X1 - 1) c = 'brick-0';
      put(x, y, c);
    }
  }
  // cornice
  for (let x = BLD_X0 - 2; x < BLD_X1 + 2; x++) {
    put(x, BLD_TOP, 'ink-4');
    put(x, BLD_TOP + 1, 'ink-3');
    put(x, BLD_TOP + 2, 'ink-3');
    put(x, BLD_TOP + 3, 'ink-2');
    put(x, BLD_TOP + 4, (x - BLD_X0) % 3 === 2 ? 'brick-0' : 'ink-2');
    put(x, BLD_TOP + 5, 'brick-0');
  }
  windowAt(WIN_COLS[0], WIN_TOP, 'none');
  windowAt(WIN_COLS[1], WIN_TOP, 'none');
  windowAt(WIN_COLS[2], WIN_TOP, 'blue');
  windowAt(WIN_COLS[0], WIN_MID, 'none');
  windowAt(WIN_COLS[1], WIN_MID, 'amber');
  windowAt(WIN_COLS[2], WIN_MID, 'none');

  // ground floor: record shop. Fascia with a neon record sign.
  for (let x = BLD_X0 + 1; x < BLD_X1 - 1; x++) {
    put(x, 63, 'ink-3');
    for (let y = 64; y < 74; y++) put(x, y, 'ink-1');
    put(x, 74, 'ink-2');
    put(x, 75, 'brick-0');
  }
  {
    // neon tubes are light cores; each gets a 1 px ring of its own ramp's -1
    const pinkTube = canvas(36, 12);
    ellipse(pinkTube, 1, 1, 10, 10, 'pink-2', false);
    const blueTube = canvas(36, 12);
    const wave: Pt[] = [[14, 6], [16, 6], [18, 4], [22, 8], [26, 4], [28, 6], [31, 6]];
    for (let i = 0; i + 1 < wave.length; i++) line(blueTube, wave[i]![0], wave[i]![1], wave[i + 1]![0], wave[i + 1]![1], 'blue-3');
    ring(pinkTube, 'pink-1');
    ring(blueTube, 'blue-1');
    const sign = canvas(36, 12);
    over(sign, blueTube);
    over(sign, pinkTube);
    stamp(sign, 90, 63);
  }
  // shop window with records on display
  const sx0 = 64;
  const sx1 = 118;
  const sy0 = 78;
  const sy1 = 101;
  for (let y = sy0; y <= sy1; y++) {
    for (let x = sx0; x <= sx1; x++) {
      let c: PaletteColor = 'dusk-0';
      const k = (x - sx0 + (sy1 - y)) % 30;
      if (k > 18 && k < 22) c = 'dusk-1';
      if (y === sy0 || x === sx0) c = 'ink-3';
      else if (y === sy1 || x === sx1) c = 'ink-1';
      else if (y === sy0 + 1 || x === sx0 + 1) c = 'ink-1';
      put(x, y, c);
    }
  }
  for (let x = sx0 + 2; x < sx1; x++) put(x, sy1 - 2, 'ink-2');
  const covers: readonly [number, number, PaletteColor, PaletteColor][] = [
    [95, 88, 'green-1', 'green-0'],
    [106, 89, 'blue-1', 'blue-0'],
  ];
  for (const [cx, cy, lit, dark] of covers) {
    const s = 10;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) put(cx + i, cy + j, i === s - 1 || j === s - 1 ? dark : lit);
    const d = canvas(s, s);
    ellipse(d, 2, 2, 6, 6, dark);
    set(d, 4, 4, lit);
    set(d, 5, 4, lit);
    set(d, 4, 5, lit);
    set(d, 5, 5, lit);
    stamp(d, cx, cy);
  }
  // door
  const dx0 = 124;
  const dx1 = 141;
  for (let y = 78; y < GROUND_Y; y++) {
    for (let x = dx0; x <= dx1; x++) {
      let c: PaletteColor = 'ink-1';
      if (x === dx0 || y === 78) c = 'ink-3';
      else if (x === dx1) c = 'brick-0';
      else if (x === dx0 + 1 || x === dx1 - 1 || y === 79) c = 'ink-2';
      else if (y >= 82 && y <= 96 && x >= dx0 + 4 && x <= dx1 - 4) c = (x - dx0 + (96 - y)) % 12 === 5 || (x - dx0 + (96 - y)) % 12 === 6 ? 'dusk-1' : 'dusk-0';
      put(x, y, c);
    }
  }
  for (let y = 92; y < 96; y++) put(dx0 + 3, y, 'ink-4');
  for (let x = dx0 - 2; x <= dx1 + 2; x++) {
    put(x, GROUND_Y - 2, 'ink-3');
    put(x, GROUND_Y - 1, 'ink-2');
  }
}

// Fire escape over the two left window columns, with its shadow on the facade.
{
  const fe = canvas(W, H);
  const x0 = WIN_COLS[0] - 4;
  const x1 = WIN_COLS[1] + 17;
  const landing = (py: number): void => {
    for (let x = x0; x <= x1; x++) {
      set(fe, x, py, 'ink-3'); // platform, lit top
      set(fe, x, py + 1, 'ink-1');
      set(fe, x, py - 6, 'ink-2'); // top rail
    }
    for (let x = x0 + 3; x < x1; x += 3) for (let y = py - 5; y < py; y++) set(fe, x, y, 'ink-1');
    for (let y = py - 6; y < py; y++) {
      set(fe, x0, y, 'ink-2');
      set(fe, x1, y, 'ink-1');
    }
    line(fe, x0 + 1, py + 2, x0 + 3, py + 4, 'ink-1');
    line(fe, x1 - 1, py + 2, x1 - 3, py + 4, 'ink-1');
  };
  const pyA = WIN_TOP + 15;
  const pyB = WIN_MID + 15;
  landing(pyA);
  landing(pyB);
  // stair from the lower landing's right end up-left to the upper landing: lit tread edges
  const steps = pyB - pyA - 2;
  for (let k = 0; k < steps; k++) {
    set(fe, x1 - 5 - k, pyB - 1 - k, 'ink-3');
    set(fe, x1 - 4 - k, pyB - 1 - k, 'ink-1');
  }
  for (let k = 0; k < steps - 4; k++) set(fe, x1 - 4 - k, pyB - 7 - k, 'ink-2'); // handrail
  // drop ladder under the lower landing, left end
  const lx = x0 + 2;
  for (let y = pyB + 2; y < pyB + 24; y++) {
    set(fe, lx, y, 'ink-1');
    set(fe, lx + 4, y, 'ink-1');
  }
  for (let y = pyB + 4; y < pyB + 24; y += 3) for (let x = lx + 1; x < lx + 4; x++) set(fe, x, y, 'ink-2');
  // shadow, 2 px down-right, on the building only
  for (let y = 0; y < H; y++) {
    for (let x = BLD_X0; x < BLD_X1; x++) {
      if (get(fe, x - 2, y - 2) !== null && get(fe, x, y) === null) {
        const p = at(x, y);
        if (p === 'brick-1' || p === 'brick-2' || p === 'brick-3') put(x, y, shade(p, -1));
      }
    }
  }
  stamp(fe, 0, 0);
}

// Boombox on a milk crate, in front of the shop window.
{
  const crate = fromGrid(
    [
      'aaaaaaaaaaaaaaaaaaab',
      'abbbbbbbbbbbbbbbbbbb',
      'accccccccccccccccccb',
      'ckkckkckkckkckkckkcb',
      'ckkckkckkckkckkckkcb',
      'ccccccccccccccccccbb',
      'ckkckkckkckkckkckkcb',
      'ckkckkckkckkckkckkcb',
      'ckkckkckkckkckkckkcb',
      'ccccccccccccccccccbb',
      'bbbbbbbbbbbbbbbbbbbb',
    ],
    { a: 'red-1', b: 'red-0', c: 'red-0', k: 'brick-0' },
  );
  // BOOM_X: the boombox overhangs the window's left frame, so it reads as sitting in front of the glass
  const BOOM_X = 63;
  stamp(crate, BOOM_X + 3, GROUND_Y - 11); // flush with the window's inner frame: no 1 px stub of sill beside it
  // boombox: lit top/left, shadow bottom/right, two round speakers and a tape deck
  const bb = canvas(28, 15);
  for (let x = 7; x < 21; x++) set(bb, x, 0, x < 12 ? 'ink-3' : 'ink-2');
  for (let y = 1; y < 3; y++) {
    set(bb, 7, y, 'ink-2');
    set(bb, 20, y, 'ink-1');
  }
  for (let y = 3; y < 15; y++) {
    for (let x = 0; x < 28; x++) {
      let c: PaletteColor = 'ink-2';
      if (y === 3 || x === 0) c = 'ink-3';
      if (x === 27 || y === 14) c = 'ink-1';
      set(bb, x, y, c);
    }
  }
  const spk = fromGrid(
    ['..1111..', '.133321.', '13222221', '13211221', '13211221', '12222221', '.122221.', '..1111..'],
    { '1': 'ink-1', '2': 'ink-2', '3': 'ink-3' },
  );
  for (const sx of [2, 18]) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const p = get(spk, x, y);
      if (p !== null) set(bb, sx + x, 5 + y, p);
    }
  }
  for (let y = 6; y < 12; y++) for (let x = 11; x < 17; x++) set(bb, x, y, 'ink-1');
  for (let x = 12; x < 16; x++) {
    set(bb, x, 7, 'dusk-1');
    set(bb, x, 8, 'dusk-1');
  }
  set(bb, 12, 10, 'amber-1');
  set(bb, 13, 10, 'amber-1');
  for (let x = 11; x < 17; x += 2) set(bb, x, 4, 'ink-3');
  // its shadow on the glass, 1 px right of the body (key light from the top-left)
  for (let y = GROUND_Y - 22; y < GROUND_Y - 11; y++) {
    const p = at(BOOM_X + 28, y);
    if (p === 'dusk-0' || p === 'dusk-1') put(BOOM_X + 28, y, 'ink-1');
  }
  stamp(bb, BOOM_X, GROUND_Y - 26);
  // telescopic antenna from the body's top-right corner, tip inside the glass
  line(scene, BOOM_X + 25, GROUND_Y - 24, BOOM_X + 30, GROUND_Y - 29, 'ink-3');
}

// ---------------------------------------------------------------- chain-link fence

{
  for (let x = FENCE_X0; x < FENCE_X1; x++) {
    for (let y = 68; y < GROUND_Y - 1; y++) {
      const a = (((x + y) % 6) + 6) % 6 === 0;
      const b = (((x - y) % 6) + 6) % 6 === 0;
      if (a) put(x, y, 'ink-3');
      else if (b) put(x, y, 'ink-2');
    }
    put(x, 65, 'ink-3');
    put(x, 66, 'ink-2');
    put(x, 67, 'ink-1');
    put(x, GROUND_Y - 1, 'ink-2');
  }
  for (const px of [FENCE_X0 + 1, 476, FENCE_X1 - 3]) {
    for (let y = 64; y < GROUND_Y; y++) {
      put(px, y, 'ink-3');
      put(px + 1, y, 'ink-2');
      put(px + 2, y, 'ink-1');
    }
    for (let x = px - 1; x <= px + 3; x++) {
      put(x, 62, 'ink-3');
      put(x, 63, x === px + 3 ? 'ink-1' : 'ink-2');
    }
  }
}

// ---------------------------------------------------------------- ground

for (let y = GROUND_Y; y < H; y++) for (let x = 0; x < W; x++) put(x, y, 'ink-2');
for (let x = 0; x < W; x++) put(x, GROUND_Y, 'ink-1');

/**
 * Scratch Boy's spot: flat, slightly lighter worn asphalt. An ellipse whose edge wanders 1 px in
 * or out, in runs of 3-5 px along its rim, so it reads as wear, not as a rug.
 */
{
  const s = SPOT_HERO;
  const a = s.w / 2;
  const b = s.h / 2;
  const x0 = Math.round(s.x - (s.w - 1) / 2);
  const y0 = Math.round(s.y - (s.h - 1) / 2);
  const cx = x0 + (s.w - 1) / 2;
  const cy = y0 + (s.h - 1) / 2;
  // arc length along the rim, by eccentric angle
  const STEPS = 720;
  const arc: number[] = [0];
  for (let i = 1; i <= STEPS; i++) {
    const t0 = ((i - 1) / STEPS) * 2 * Math.PI;
    const t1 = (i / STEPS) * 2 * Math.PI;
    arc.push(arc[i - 1]! + Math.hypot(a * (Math.cos(t1) - Math.cos(t0)), b * (Math.sin(t1) - Math.sin(t0))));
  }
  const perimeter = arc[STEPS]!;
  // runs of 3-5 px; each run moves the edge 1 px from the last (out, flush, in), deterministic
  const runs: [number, number][] = []; // [end of run in px along the rim, offset]
  {
    let pos = 0;
    let off = 0;
    let i = 0;
    while (pos < perimeter) {
      pos += 3 + Math.floor(hash(i, 1, 61) * 3);
      runs.push([pos, off]);
      off = off === 0 ? (hash(i, 2, 61) < 0.5 ? 1 : -1) : 0;
      i++;
    }
  }
  const offsetAt = (theta: number): number => {
    const u = (((theta / (2 * Math.PI)) % 1) + 1) % 1;
    const len = arc[Math.min(STEPS, Math.round(u * STEPS))]!;
    for (const [end, off] of runs) if (len < end) return off;
    return 0;
  };
  const mask = canvas(W, H);
  for (let y = y0 - 2; y < y0 + s.h + 2; y++) {
    for (let x = x0 - 2; x < x0 + s.w + 2; x++) {
      const dx = (x - cx) / a;
      const dy = (y - cy) / b;
      const r = Math.hypot(dx, dy);
      if (r < 1e-6) {
        set(mask, x, y, 'ink-3');
        continue;
      }
      const grad = Math.hypot(dx / a, dy / b) / r; // |d r / d px|
      const dist = (r - 1) / grad; // px outside the rim (negative inside)
      if (dist <= offsetAt(Math.atan2(dy, dx)) + 0.15) set(mask, x, y, 'ink-3');
    }
  }
  // tidy: no 1 px spikes or notches
  for (let pass = 0; pass < 3; pass++) {
    const src = mask.pixels.slice();
    const on = (x: number, y: number): number => (x >= 0 && y >= 0 && x < W && y < H && src[y * W + x] !== null ? 1 : 0);
    for (let y = y0 - 2; y < y0 + s.h + 2; y++) {
      for (let x = x0 - 2; x < x0 + s.w + 2; x++) {
        const nb = on(x - 1, y) + on(x + 1, y) + on(x, y - 1) + on(x, y + 1);
        if (on(x, y) && nb <= 1) set(mask, x, y, null);
        else if (!on(x, y) && nb >= 3) set(mask, x, y, 'ink-3');
      }
    }
  }
  // grain dashes that cut 3 px notches into the rim: [x, top or bottom edge]
  for (const [nx, edge] of [[104, 'top'], [161, 'top'], [127, 'bottom']] as const) {
    const edgeY = (x: number): number => {
      if (edge === 'top') {
        for (let y = y0 - 2; y < y0 + s.h + 2; y++) if (get(mask, x, y)) return y;
      } else {
        for (let y = y0 + s.h + 1; y >= y0 - 2; y--) if (get(mask, x, y)) return y;
      }
      return -1;
    };
    const ey = edgeY(nx);
    if (ey < 0 || edgeY(nx + 1) !== ey || edgeY(nx + 2) !== ey) throw new Error(`hero spot notch at ${nx}: rim not flat`);
    for (let k = 0; k < 3; k++) set(mask, nx + k, ey, null);
  }
  stamp(mask, 0, 0);
}

/**
 * The streetlight's warm pool, which is also the opponent's spot: a 1-row dusk-1 checker rim,
 * a brick-2 body and a brick-3 core under his feet.
 */
{
  const s = SPOT_FOE;
  const x0 = Math.round(s.x - (s.w - 1) / 2);
  const y0 = Math.round(s.y - (s.h - 1) / 2);
  const pool = canvas(W, H);
  const body = canvas(W, H);
  ellipse(pool, x0, y0, s.w, s.h, 'dusk-1');
  ellipse(body, x0 + 1, y0 + 1, s.w - 2, s.h - 2, 'brick-2');
  for (let y = y0; y < y0 + s.h; y++) {
    for (let x = x0; x < x0 + s.w; x++) if (get(pool, x, y) && !get(body, x, y) && (x + y) % 2) set(pool, x, y, null);
  }
  over(pool, body);
  ellipse(pool, Math.round(s.x - 14.5), Math.round(s.y - 2), 30, 5, 'brick-3');
  stamp(pool, 0, 0);
}

// a basketball left by the fence
{
  const ball = fromGrid(['..aaa..', '.aaaba.', 'aaabaab', 'bbbbbbb', 'aabaabb', '.aabab.', '..bbb..'], { a: 'amber-1', b: 'amber-0' });
  for (let x = 437; x < 448; x++) put(x, 120, 'ink-1');
  for (let x = 438; x < 447; x++) put(x, 121, 'ink-1');
  stamp(ball, 439, 114);
}

// contact shadow along the wall base: a solid row, then a checker row
for (let x = 0; x < W; x++) if ((x + GROUND_Y + 1) % 2 === 0 && at(x, GROUND_Y + 1) === 'ink-2') put(x, GROUND_Y + 1, 'ink-1');

// asphalt grain: sparse short dashes, finer and denser far away, lighter on dark and darker on the worn spots
for (let y = GROUND_Y + 3; y < H - 3; y++) {
  const far = y < 135;
  const near = y > 170;
  const p = far ? 0.008 : near ? 0.005 : 0.006;
  const len = near ? 3 : 2;
  for (let x = 0; x < W; x++) {
    const r = hash(x, y, 21);
    const base = at(x, y);
    if (base !== 'ink-2' && base !== 'ink-3') continue;
    let ok = true;
    for (let k = -1; k <= len; k++) for (let j = -1; j <= 1; j++) if (at(x + k, y + j) !== base) ok = false;
    if (!ok) continue;
    if (r < p) {
      for (let k = 0; k < len; k++) put(x + k, y, base === 'ink-3' ? 'ink-2' : 'ink-3');
    } else if (r < p * 1.6 && base === 'ink-2') {
      for (let k = 0; k < len; k++) put(x + k, y, 'ink-1');
    }
  }
}

/** Wrapped Bresenham line. */
function wline(x0: number, y0: number, x1: number, y1: number, col: PaletteColor): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    put(x, y, col);
    if (x === tx && y === ty) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// cracks: angular runs, flattened by the perspective, with a few short branches
function crack(x0: number, y0: number, segs: number, seed: number, dir: number): void {
  let x = x0;
  let y = y0;
  for (let s = 0; s < segs; s++) {
    const len = 3 + Math.floor(hash(s, seed, 41) * 7);
    const slope = (hash(s, seed, 42) - 0.5) * 0.9;
    const nx = x + dir * len;
    const ny = y + Math.round(slope * len);
    wline(x, y, nx, ny, 'ink-1');
    if (hash(s, seed, 43) < 0.35) {
      const bl = 2 + Math.floor(hash(s, seed, 44) * 4);
      const bd = hash(s, seed, 45) < 0.5 ? 1 : -1;
      wline(nx, ny, nx + dir * Math.ceil(bl / 2), ny + bd * bl, 'ink-1');
    }
    x = nx;
    y = ny;
  }
}
crack(212, 126, 5, 1, 1);
crack(392, 142, 5, 2, -1);
crack(20, 186, 6, 3, 1);
crack(236, 194, 6, 4, 1);
crack(426, 128, 4, 5, 1);
crack(226, 150, 3, 6, -1);
crack(300, 178, 5, 7, 1);
crack(36, 134, 4, 8, 1);

// manhole cover near the seam
{
  const m = canvas(30, 10);
  ellipse(m, 0, 0, 28, 9, 'ink-1');
  ellipse(m, 1, 1, 26, 7, 'ink-3');
  ellipse(m, 4, 2, 20, 5, 'ink-2', false);
  for (let x = 8; x < 20; x += 3) set(m, x, 4, 'ink-2');
  stamp(m, 456, 150);
}

// weeds at the wall base
function tuft(x: number, y: number, kind: number): void {
  const t =
    kind === 0
      ? fromGrid(['.b...', '.b.a.', 'ab.a.', 'aabaa'], { a: 'green-0', b: 'green-1' })
      : fromGrid(['...b..', 'b..b..', 'ba.ba.', '.aaab.', 'aaaaaa'], { a: 'green-0', b: 'green-1' });
  stamp(t, x, y - t.height + 1);
}
tuft(163, GROUND_Y + 1, 0);
tuft(244, GROUND_Y + 1, 1);
tuft(398, GROUND_Y + 1, 0);
tuft(437, GROUND_Y + 1, 1);
tuft(14, GROUND_Y + 1, 0);

// ---------------------------------------------------------------- small details

// A cat on the sill of the TV-lit window, a silhouette against the blue glow.
stamp(fromGrid(['1.1..', '111..', '111..', '1111.', '11111', '11111'], { '1': 'ink-1' }), WIN_COLS[2] + 2, WIN_TOP + 9);

// A leafy mound sitting on the upper landing's top rail: lit top-left, shadow bottom-right.
stamp(fromGrid(['.1111..', '111110.', '1111000', '1100000'], { '0': 'green-0', '1': 'green-1' }), 105, WIN_TOP + 5);

// Sneakers thrown over a wire strung from the building to the lamp post.
{
  const x0 = BLD_X1;
  const y0 = 28;
  const x1 = LAMP_X;
  const y1 = 31;
  const wireY = (x: number): number => {
    const t = (x - x0) / (x1 - x0);
    return Math.round(y0 + (y1 - y0) * t + 9 * 4 * t * (1 - t));
  };
  for (let x = x0; x <= x1; x++) put(x, wireY(x), 'ink-1');
  const hx = 182;
  const hy = wireY(hx);
  line(scene, hx, hy + 1, hx - 3, hy + 5, 'ink-3');
  line(scene, hx, hy + 1, hx + 2, hy + 7, 'ink-3');
  const shoe = fromGrid(['.44....', '.4r4...', '44rr44.', '4444443', '3333333'], { '4': 'ink-4', '3': 'ink-3', r: 'red-1' });
  const mirrored = canvas(shoe.width, shoe.height);
  for (let y = 0; y < shoe.height; y++) for (let x = 0; x < shoe.width; x++) set(mirrored, shoe.width - 1 - x, y, get(shoe, x, y));
  stamp(mirrored, hx - 9, hy + 6);
  stamp(shoe, hx + 1, hy + 8);
}

// Two pigeons on the wall coping.
{
  const pigeon = fromGrid(['.44.....', '3443....', '.33332..', '..333222', '..2222..'], { '2': 'ink-2', '3': 'ink-3', '4': 'ink-4' });
  stamp(pigeon, 375, WALL_TOP - 5);
  const flipped = canvas(pigeon.width, pigeon.height);
  for (let y = 0; y < pigeon.height; y++) for (let x = 0; x < pigeon.width; x++) set(flipped, pigeon.width - 1 - x, y, get(pigeon, x, y));
  stamp(flipped, 388, WALL_TOP - 5);
}

// Spray cans left at the foot of the piece.
{
  const can = (cap: PaletteColor, capDark: PaletteColor): Canvas =>
    fromGrid(['ccd', 'ccd', '321', '321', 'ccd', '321', '321'], { c: cap, d: capDark, '3': 'ink-3', '2': 'ink-2', '1': 'ink-1' });
  stamp(can('pink-1', 'pink-0'), 199, GROUND_Y - 6);
  stamp(can('green-1', 'green-0'), 204, GROUND_Y - 5);
  stamp(fromGrid(['3333322', '22222bb', '1111111'], { '3': 'ink-3', '2': 'ink-2', '1': 'ink-1', b: 'blue-1' }), 209, GROUND_Y - 1);
}

// A block-party flyer pasted on the pillar (shapes only, no text).
{
  const flyer = fromGrid(
    ['dddddddd', 'd11dddde', 'd1rr1dde', 'drrrr1de', 'd1rr1dde', 'd11dddde', 'deeeeede', 'dddddde.', 'deeede..', 'ddddd...'],
    { d: 'dusk-2', e: 'dusk-1', r: 'red-1', '1': 'red-0' },
  );
  stamp(flyer, PILLAR_X0 + 1, 74);
  for (let y = 75; y < 84; y++) if (at(PILLAR_X0 + 9, y) !== 'dusk-2') put(PILLAR_X0 + 9, y, 'brick-0');
}

// ---------------------------------------------------------------- streetlight

{
  const L = LAMP_X; // post columns: L lit, L+1 mid, L+2 shadow
  const hx = LAMP_HEAD_X;
  const hy = LAMP_HEAD_Y;
  // the post's cast shadow on the bricks: the lamp hangs to its right, so 2 px on its left, flush with it
  for (let y = BRICK_TOP + 1; y < 101; y++) {
    for (let x = L - 2; x <= L - 1; x++) {
      const p = at(x, y);
      if (p === 'brick-1' || p === 'brick-2' || p === 'brick-3') put(x, y, shade(p, -1));
    }
  }
  for (let y = hy + 4; y <= GROUND_Y; y++) {
    put(L, y, 'ink-3');
    put(L + 1, y, 'ink-2');
    put(L + 2, y, 'ink-1');
  }
  // collar and base
  for (let x = L - 1; x <= L + 3; x++) {
    put(x, 84, x === L + 3 ? 'ink-2' : 'ink-3');
    put(x, 85, x === L - 1 ? 'ink-2' : 'ink-1');
  }
  for (let y = 101; y <= GROUND_Y; y++) {
    for (let x = L - 2; x <= L + 4; x++) put(x, y, x === L - 2 ? 'ink-3' : x >= L + 3 ? 'ink-1' : 'ink-2');
  }
  for (let x = L - 2; x <= L + 4; x++) put(x, 101, x === L + 4 ? 'ink-2' : 'ink-3');
  // arm: lit top row, dark underside, reaching right from the post to the head over the opponent
  for (let x = L + 3; x < hx + 4; x++) {
    put(x, hy + 1, 'ink-3');
    put(x, hy + 2, 'ink-1');
  }
  // elbow: the post's lit left edge curves up and right into the arm's lit top
  put(L + 2, hy + 1, 'ink-3');
  put(L + 1, hy + 2, 'ink-3');
  put(L + 2, hy + 2, 'ink-2');
  put(L, hy + 3, 'ink-3');
  put(L + 1, hy + 3, 'ink-2');
  put(L + 2, hy + 3, 'ink-1');
  // cobra head, neck on the left: the dome's highlight stays on its top-left, dark rim, glowing bowl
  const head = fromGrid(
    [
      '.........44333....',
      '......3334433222..',
      '...33333333322222.',
      '..3322222222222222',
      '111111111111111111',
      '..1aAAAAAAAAAAAa1.',
      '....aAAAAAAAAAa...',
      '.....aaaaaaaaa....',
    ],
    { '1': 'ink-1', '2': 'ink-2', '3': 'ink-3', '4': 'ink-4', a: 'amber-1', A: 'amber-3' },
  );
  stamp(head, hx, hy - 3);
}

const backdrop: SpriteDef = {
  name: 'backdrop-hiphop',
  frameWidth: W,
  frameHeight: H,
  frames: [scene],
  tags: [],
  source: 'drawn by code in wrapped x: dusk sky, skyline, record-shop building, brick wall with graffiti, streetlight, fence, asphalt',
};

export default backdrop;
