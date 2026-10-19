// Small pixel glyphs for the battle UI (cooldown, damage, shield…), drawn as SVG on the game pixel
// grid in palette colours, and DOM views of sprite sheet frames (vinyl icons). Both are sized in
// game pixels (1 CSS px each inside the zoomed view), so they stay on the canvas's pixel grid.
import type { PaletteColor } from '@scratchboy/content';
import { SHEETS, tagFrame, type SheetName } from '../sprites.ts';

interface GlyphDef {
  rows: readonly string[];
  ink: Readonly<Record<string, PaletteColor>>;
}

const GLYPHS = {
  cooldown: {
    rows: ['yyyyy', '.yay.', '..y..', '..y..', '.y.y.', '.yay.', 'yyyyy'],
    ink: { y: 'amber-3', a: 'amber-1' },
  },
  damage: {
    rows: ['...r...', '.r.r.r.', '..ryr..', 'rryyyrr', '..ryr..', '.r.r.r.', '...r...'],
    ink: { r: 'red-2', y: 'amber-3' },
  },
  shield: {
    rows: ['..ccc..', '.c...c.', 'c.i...c', 'c.....c', 'c.....c', '.c...c.', '..ccc..'],
    ink: { c: 'blue-2', i: 'blue-3' },
  },
  stun: {
    rows: ['.....', '..i..', '.iii.', 'ii7ii', '.iii.', '..i..', '.....'],
    ink: { i: 'blue-3', '7': 'ink-7' },
  },
  slow: {
    rows: ['.......', '..ooo..', '.o...o.', '.o.o.o.', '.oo..oq', 'qqqqqqq', '.......'],
    ink: { o: 'amber-2', q: 'dusk-3' },
  },
  haste: {
    rows: ['...yy', '..yy.', '.yy..', 'yyyyy', '..yy.', '.yy..', 'yy...'],
    ink: { y: 'amber-3' },
  },
  trap: {
    rows: ['.......', '.......', '.44444.', '4y0y0y4', '40y0y04', '.44444.', '.......'],
    ink: { '4': 'ink-4', y: 'amber-3', '0': 'ink-0' },
  },
  defender: {
    rows: ['6666666', '6bbbbb6', '6bcbbb6', '6bbbbb6', '.6bbb6.', '..6b6..', '...6...'],
    ink: { '6': 'ink-6', b: 'blue-1', c: 'blue-2' },
  },
  'mix-good': {
    rows: ['..ggggg', '..g...g', '..g...g', '..g...g', 'ggg.ggg', 'ggg.ggg', '.......'],
    ink: { g: 'green-2' },
  },
  'mix-clash': {
    rows: ['..tt...', '..t..tt', '..t...t', '..t...t', 'ttt.ttt', 'ttt.ttt', '.......'],
    ink: { t: 'red-3' },
  },
  ready: {
    rows: ['g...', 'gg..', 'ggg.', 'gggg', 'ggg.', 'gg..', 'g...'],
    ink: { g: 'green-2' },
  },
  hand: {
    rows: ['.7.7..', '.7.7.7', '.77777', '777777', '.77777', '..777.', '..777.'],
    ink: { '7': 'ink-7' },
  },
  'hand-used': {
    rows: ['.7.7..', '.7.7.7', '.77777', '777777', '.77777', '..777.', '..777.'],
    ink: { '7': 'ink-3' },
  },
  broken: {
    rows: ['t.....t', '.t...t.', '..t.t..', '...t...', '..t.t..', '.t...t.', 't.....t'],
    ink: { t: 'red-3' },
  },
  close: {
    rows: ['7.....7', '.7...7.', '..7.7..', '...7...', '..7.7..', '.7...7.', '7.....7'],
    ink: { '7': 'ink-7' },
  },
  rotate: {
    rows: [
      '6666666......................',
      '6.....6......................',
      '6.....6......................',
      '6.....6......................',
      '6.....6......................',
      '6.....6......................',
      '6.....6......................',
      '6.....6...7...666666666666666',
      '6.....6....7..6.............6',
      '6.....6.77777.6.............6',
      '6.....6....7..6...........6.6',
      '6.....6...7...6.............6',
      '6..6..6.......6.............6',
      '6.....6.......666666666666666',
      '6666666......................',
    ],
    ink: { '6': 'ink-6', '7': 'ink-7' },
  },
} satisfies Record<string, GlyphDef>;

export type GlyphName = keyof typeof GLYPHS;

/** Horizontal runs of one colour, so a glyph is a handful of rects. */
function runs(def: GlyphDef): { x: number; y: number; w: number; fill: PaletteColor }[] {
  const out: { x: number; y: number; w: number; fill: PaletteColor }[] = [];
  def.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x] ?? '.';
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const fill = def.ink[ch];
      if (fill) out.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return out;
}

const RUNS = new Map<GlyphName, ReturnType<typeof runs>>();

export function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  const def: GlyphDef = GLYPHS[name];
  let drawn = RUNS.get(name);
  if (!drawn) {
    drawn = runs(def);
    RUNS.set(name, drawn);
  }
  const w = def.rows[0]?.length ?? 0;
  const h = def.rows.length;
  return (
    <svg
      className={className ? `glyph ${className}` : 'glyph'}
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: `${w}px`, height: `${h}px` }}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {drawn.map((run, i) => (
        <rect key={i} x={run.x} y={run.y} width={run.w} height={1} style={{ fill: `var(--c-${run.fill})` }} />
      ))}
    </svg>
  );
}

/** One frame of a sprite sheet, at 1 game pixel per art pixel. An undrawn tag keeps its space, empty. */
export function SpriteFrame({ sheet, tag, size }: { sheet: SheetName; tag: string; size: number }) {
  const frame = tagFrame(sheet, tag);
  const { png, json } = SHEETS[sheet];
  const style = frame
    ? {
        backgroundImage: `url(${png})`,
        backgroundSize: `${json.meta.size.w}px ${json.meta.size.h}px`,
        backgroundPosition: `${-frame.frame.x}px ${-frame.frame.y}px`,
      }
    : {};
  return (
    <span
      className="sprite"
      style={{ ...style, width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    />
  );
}
