// 16x16 crate icons for the menu, one frame per test vinyl, in vinyl-label.ts order: a black record
// peeking out from behind the top-right corner of its sleeve. The sleeve wears the label's colours
// and a big version of the label's motif.
import type { PaletteColor } from '../../src/palette.ts';
import { canvas, ellipse, fromGrid, outline, paste, set, type Canvas, type Pixel, type SpriteDef } from '../canvas.ts';
import { LABEL_TAGS } from './vinyl-label.ts';

const S = 16;

interface Sleeve {
  tag: string;
  /** Outline colour of the sleeve. */
  ring: PaletteColor;
  legend: Record<string, Pixel>;
  /** 9x9 sleeve face; the outline is added around it. */
  rows: string[];
}

function hazard(): string[] {
  return Array.from({ length: 9 }, (_, y) => Array.from({ length: 9 }, (_, x) => ((x + y + 1) % 4 < 2 ? 'k' : 'y')).join(''));
}

const SLEEVES: readonly Sleeve[] = [
  {
    // gold sleeve, a speaker cone
    tag: 'boom-bap',
    ring: 'amber-0',
    legend: { b: 'amber-2', l: 'amber-3', a: 'amber-1', o: 'amber-0' },
    rows: [
      'llbbbbbbb',
      'lbbaaabbb',
      'bbalbbabb',
      'balbbbbab',
      'balbobbab',
      'babbbbbab',
      'bbabbbabb',
      'bbbaaabbb',
      'bbbbbbbbb',
    ],
  },
  {
    // red sleeve, a white shield
    tag: 'block-party',
    ring: 'red-0',
    legend: { b: 'red-2', l: 'red-3', w: 'ink-7', s: 'ink-6' },
    rows: [
      'llbbbbbbb',
      'lwwwwwwwb',
      'bwwwwwwsb',
      'bwwwwwwsb',
      'bwwwwwwsb',
      'bbwwwwsbb',
      'bbbwwsbbb',
      'bbbbsbbbb',
      'bbbbbbbbb',
    ],
  },
  {
    // ice-blue sleeve, a frost crystal
    tag: 'cold-snap',
    ring: 'blue-0',
    legend: { b: 'blue-3', c: 'blue-1', s: 'blue-2', l: 'ink-7' },
    rows: [
      'llbbbbbbb',
      'lsbbcbbsb',
      'bbcbcbcbb',
      'bbbcccbbb',
      'bcccscccb',
      'bbbcccbbb',
      'bbcbcbcbb',
      'bsbbcbbsb',
      'bbbbbbbbb',
    ],
  },
  {
    // acid-green sleeve, a smiling face
    tag: 'acid-line',
    ring: 'green-0',
    legend: { b: 'green-2', m: 'green-0', l: 'ink-7' },
    rows: [
      'llbbbbbbb',
      'lbbbbbbbb',
      'bbmbbbmbb',
      'bbmbbbmbb',
      'bbbbbbbbb',
      'bmbbbbbmb',
      'bbmmmmmbb',
      'bbbbbbbbb',
      'bbbbbbbbb',
    ],
  },
  {
    // hazard stripes, yellow and black
    tag: 'booby-trap',
    ring: 'amber-0',
    legend: { y: 'amber-3', k: 'ink-1' },
    rows: hazard(),
  },
  {
    // ivory over deep wine, split by a gold rule, like its label
    tag: 'toccata',
    ring: 'red-0',
    legend: { b: 'skin-5', g: 'amber-3', p: 'red-1', l: 'ink-7' },
    rows: [
      'llbbbbbbb',
      'lbbbbbbbb',
      'bbbbbbbbb',
      'bbbbbbbbb',
      'ggggggggg',
      'ppppppppp',
      'ppppppppp',
      'ppppppppp',
      'ppppppppp',
    ],
  },
  {
    // dark violet sleeve, a whole cyan lightning bolt
    tag: 'breakbeat',
    ring: 'dusk-0',
    legend: { b: 'dusk-1', l: 'dusk-2', c: 'blue-2', w: 'blue-3' },
    rows: [
      'llbbbbbbb',
      'lbbbbcwbb',
      'bbbbcwbbb',
      'bbbcwbbbb',
      'bbcwwwwbb',
      'bbbbcwbbb',
      'bbbcwbbbb',
      'bbcwbbbbb',
      'bbbbbbbbb',
    ],
  },
  {
    // parchment sleeve, a deep blue arched window on its sill
    tag: 'plainchant',
    ring: 'blue-0',
    legend: { b: 'skin-4', l: 'skin-5', a: 'blue-0', g: 'blue-1' },
    rows: [
      'llbbbbbbb',
      'lbbaaabbb',
      'bbagggabb',
      'bagggggab',
      'bagggggab',
      'bagggggab',
      'bagggggab',
      'baaaaaaab',
      'bbbbbbbbb',
    ],
  },
];

function icon(s: Sleeve): Canvas {
  const c = canvas(S, S);
  // the record behind: 11x11 disc centred on (10, 5), two groove rings, a sheen on its top-left.
  // No label or spindle: they would land on the sleeve's corner and read as a chip in it.
  ellipse(c, 5, 0, 11, 11, 'ink-0');
  ellipse(c, 6, 1, 9, 9, 'ink-2', false);
  ellipse(c, 8, 3, 5, 5, 'ink-2', false);
  // sheen arc on the top-left, a cool rim on the far right edge so the disc holds against a dark panel
  set(c, 6, 2, 'ink-4');
  set(c, 7, 1, 'ink-5');
  set(c, 8, 1, 'ink-7');
  set(c, 9, 0, 'ink-4');
  for (const [x, y] of [[13, 1], [14, 2], [15, 4], [15, 5], [15, 6]] as const) set(c, x, y, 'ink-3');
  // the sleeve in front, face 9x9 at (1, 6), outlined in the label's ring colour
  const sleeve = canvas(S, S);
  paste(sleeve, fromGrid(s.rows, s.legend), 1, 6);
  outline(sleeve, { color: s.ring });
  // square top-right corner: the record shows behind it, so a rounded corner would read as a dent
  set(sleeve, 10, 5, s.ring);
  paste(c, sleeve, 0, 0);
  return c;
}

const frames = SLEEVES.map(icon);
SLEEVES.forEach((s, i) => {
  if (s.tag !== LABEL_TAGS[i]) throw new Error(`vinyl-icon: frame ${i} is '${s.tag}', vinyl-label has '${LABEL_TAGS[i]}'`);
});

export default {
  name: 'vinyl-icon',
  frameWidth: S,
  frameHeight: S,
  frames,
  tags: SLEEVES.map((s, i) => ({ name: `vinyl-icon-${s.tag}`, from: i, to: i })),
  source: 'drawn by code: ellipse record with two groove rings and a sheen, hand-drawn 9x9 sleeve faces, outline pass',
} satisfies SpriteDef;
