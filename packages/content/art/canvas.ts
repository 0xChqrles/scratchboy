// Drawing helpers for sprite generators. A Canvas holds palette names, never raw colours, so a
// sprite can only use the palette. Drawing functions change the canvas in place and clip at its
// edges; flipX, clone and crop return a new canvas.
import { PALETTE, type PaletteColor } from '../src/palette.ts';

/** A pixel is a palette colour name, or null for transparent. */
export type Pixel = PaletteColor | null;

export interface Canvas {
  width: number;
  height: number;
  /** Row-major: the pixel at (x, y) is pixels[y * width + x]. */
  pixels: Pixel[];
}

export interface SpriteTag {
  /** Becomes a global Phaser animation key, so prefix it with the sprite name: 'scratch-boy-idle'. */
  name: string;
  from: number;
  to: number;
}

export interface SpriteDef {
  /** Same as the module's file name: art/sprites/<name>.ts. */
  name: string;
  frameWidth: number;
  frameHeight: number;
  frames: Canvas[];
  /** ms per frame; defaults to 150 each. */
  durations?: number[];
  tags: SpriteTag[];
  /** One line: how it was made. */
  source: string;
}

// ---------------------------------------------------------------- ramps

/** Ramps by name ('skin' -> ['skin-0', ...]), dark to light, read from the palette's key order. */
export const RAMPS: Readonly<Record<string, readonly PaletteColor[]>> = (() => {
  const out: Record<string, PaletteColor[]> = {};
  for (const color of Object.keys(PALETTE) as PaletteColor[]) {
    const ramp = rampName(color);
    (out[ramp] ??= []).push(color);
  }
  return out;
})();

function rampName(color: PaletteColor): string {
  return color.slice(0, color.lastIndexOf('-'));
}

function rampOf(color: PaletteColor): readonly PaletteColor[] {
  const ramp = RAMPS[rampName(color)];
  if (!ramp) throw new Error(`no ramp for ${color}`);
  return ramp;
}

/** Moves `steps` along the colour's own ramp (negative = darker), clamped at its ends. */
export function shade(color: PaletteColor, steps: number): PaletteColor {
  const ramp = rampOf(color);
  const i = Math.min(ramp.length - 1, Math.max(0, ramp.indexOf(color) + steps));
  return ramp[i] ?? color;
}

// ---------------------------------------------------------------- canvas basics

export function canvas(width: number, height: number, fill: Pixel = null): Canvas {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`canvas: bad size ${width}x${height}`);
  }
  return { width, height, pixels: new Array<Pixel>(width * height).fill(fill) };
}

/**
 * Builds a canvas from text rows, one character per pixel. Every row must have the same length.
 * '.' and ' ' are transparent unless the legend defines them; any other unknown character throws.
 */
export function fromGrid(lines: readonly string[], legend: Readonly<Record<string, Pixel>>): Canvas {
  const width = lines[0]?.length ?? 0;
  const c = canvas(width, lines.length);
  lines.forEach((row, y) => {
    if (row.length !== width) throw new Error(`fromGrid: row ${y} has ${row.length} chars, expected ${width}`);
    for (let x = 0; x < width; x++) {
      const ch = row.charAt(x);
      const px = legend[ch];
      if (px !== undefined) c.pixels[y * width + x] = px;
      else if (ch !== '.' && ch !== ' ') throw new Error(`fromGrid: '${ch}' at ${x},${y} is not in the legend`);
    }
  });
  return c;
}

export function inBounds(c: Canvas, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < c.width && y < c.height;
}

/** The pixel at (x, y), coordinates floored; null when transparent or outside the canvas. */
export function get(c: Canvas, x: number, y: number): Pixel {
  const px = Math.floor(x);
  const py = Math.floor(y);
  return inBounds(c, px, py) ? (c.pixels[py * c.width + px] ?? null) : null;
}

/** Sets one pixel, coordinates floored; ignored outside the canvas. */
export function set(c: Canvas, x: number, y: number, color: Pixel): void {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (inBounds(c, px, py)) c.pixels[py * c.width + px] = color;
}

// ---------------------------------------------------------------- shapes

/** Rectangle with its top-left at (x, y). */
export function rect(c: Canvas, x: number, y: number, w: number, h: number, color: Pixel, filled = true): void {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (filled || py === y || py === y + h - 1 || px === x || px === x + w - 1) set(c, px, py, color);
    }
  }
}

/** One-pixel line between two points, both ends included (Bresenham, no doubled corners). */
export function line(c: Canvas, fromX: number, fromY: number, toX: number, toY: number, color: Pixel): void {
  const x1 = Math.round(toX);
  const y1 = Math.round(toY);
  let x = Math.round(fromX);
  let y = Math.round(fromY);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    set(c, x, y, color);
    if (x === x1 && y === y1) return;
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

/**
 * Ellipse filling exactly the box with its top-left at (x, y), w by h pixels (even sizes work).
 * Unfilled, it draws a clean one-pixel ring. Its far left/right/top/bottom edges are flat runs,
 * never a lone pixel sticking out.
 */
export function ellipse(c: Canvas, x: number, y: number, w: number, h: number, color: Pixel, filled = true): void {
  if (w <= 0 || h <= 0) return;
  // Each row's span, sampling pixel centres; every row keeps at least its centre pixel(s).
  const left: number[] = [];
  const right: number[] = [];
  const mid = (w - 1) / 2;
  for (let j = 0; j < h; j++) {
    const off = Math.abs(j - (h - 1) / 2);
    const dy = off / (h / 2);
    // The middle row(s) always span the full width, so the ellipse fills its box exactly.
    const half = off < 1 ? w / 2 : Math.max((w / 2) * Math.sqrt(Math.max(0, 1 - dy * dy)), w % 2 === 0 ? 0.5 : 0);
    left.push(Math.ceil(mid - half - 1e-9));
    right.push(Math.floor(mid + half + 1e-9));
  }
  const at = (a: number[], i: number): number => a[i] ?? 0;
  // Odd height of 5+: if only the middle row reaches the sides, widen its neighbours to match.
  // (Below 5 there is no room: a 6x3 ellipse is 4,6,4.)
  const m = (h - 1) / 2;
  if (h % 2 === 1 && h >= 5 && at(left, m) < at(left, m - 1)) {
    left[m - 1] = left[m + 1] = at(left, m);
    right[m - 1] = right[m + 1] = at(right, m);
  }
  const inside = (i: number, j: number): boolean => j >= 0 && j < h && i >= at(left, j) && i <= at(right, j);
  // Odd width of 5+: if only the middle column reaches the top/bottom, extend its neighbours to match.
  const k = (w - 1) / 2;
  if (w % 2 === 1 && w >= 5 && h >= 3 && !inside(k - 1, 0)) {
    left[0] = left[h - 1] = Math.min(at(left, 0), k - 1);
    right[0] = right[h - 1] = Math.max(at(right, 0), k + 1);
  }
  for (let j = 0; j < h; j++) {
    for (let i = at(left, j); i <= at(right, j); i++) {
      const edge = !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1);
      if (filled || edge) set(c, x + i, y + j, color);
    }
  }
}

// ---------------------------------------------------------------- whole-canvas operations

export function clone(c: Canvas): Canvas {
  return { width: c.width, height: c.height, pixels: c.pixels.slice() };
}

/** Mirror left-right (turns a sprite facing right into one facing left). */
export function flipX(c: Canvas): Canvas {
  const out = canvas(c.width, c.height);
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) set(out, c.width - 1 - x, y, get(c, x, y));
  }
  return out;
}

/** Copies the w by h region at (x, y) into a new canvas. */
export function crop(c: Canvas, x: number, y: number, w: number, h: number): Canvas {
  const out = canvas(w, h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) set(out, px, py, get(c, x + px, y + py));
  }
  return out;
}

/** Draws the opaque pixels of `src` onto `dst` with src's top-left at (x, y). */
export function paste(dst: Canvas, src: Canvas, x: number, y: number): void {
  for (let py = 0; py < src.height; py++) {
    for (let px = 0; px < src.width; px++) {
      const p = get(src, px, py);
      if (p !== null) set(dst, x + px, y + py, p);
    }
  }
}

export interface OutlineOptions {
  /** One colour for the whole outline. Default: the darkest colour of the touching pixel's ramp. */
  color?: PaletteColor;
  /**
   * Selective outline: where the shape faces the light (its top and left edges), use the ramp's
   * second-darkest colour instead, so lit edges read softer. Ignored when `color` is set.
   */
  selective?: boolean;
}

/**
 * Draws a one-pixel outline in the transparent pixels that touch an opaque pixel side-on (not
 * diagonally, so corners stay round). Leave a one-pixel margin around the shape for it.
 * When several materials touch one outline pixel, the darkest outline colour wins.
 */
export function outline(c: Canvas, opts: OutlineOptions = {}): void {
  const src = clone(c);
  const lum = (p: PaletteColor): number => {
    const n = parseInt(PALETTE[p].slice(1), 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };
  // [dx, dy, lit]: the neighbour's offset, and whether this outline pixel sits on its lit side.
  const around: [number, number, boolean][] = [
    [1, 0, true], // shape to the right: outline on its left edge
    [0, 1, true], // shape below: outline on its top edge
    [-1, 0, false],
    [0, -1, false],
  ];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (get(src, x, y) !== null) continue;
      let best: PaletteColor | null = null;
      for (const [dx, dy, lit] of around) {
        const n = get(src, x + dx, y + dy);
        if (n === null) continue;
        const ramp = rampOf(n);
        const pick = opts.color ?? (opts.selective && lit ? (ramp[1] ?? ramp[0]) : ramp[0]) ?? n;
        if (best === null || lum(pick) < lum(best)) best = pick;
      }
      if (best !== null) set(c, x, y, best);
    }
  }
}
