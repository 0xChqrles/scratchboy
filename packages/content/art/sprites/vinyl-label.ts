// Centre labels for the test vinyls, one frame each, in the same frame as vinyl.ts so both are drawn
// at the same spot (turntable.ts RECORD_X/Y). Only the label is opaque; its centre pixel stays clear
// so the turntable's spindle shows through. Each label is a 13x7 ellipse: a ring in its colour's -0,
// a flat printed face with one lit pixel or two at the top-left, and one motif.
import { canvas, fromGrid, paste, type Canvas, type Pixel, type SpriteDef } from '../canvas.ts';
import { H, LABEL_X, LABEL_Y, W } from './vinyl.ts';

interface Label {
  tag: string;
  legend: Record<string, Pixel>;
  rows: string[];
}

/**
 * Black and hazard-yellow diagonal stripes inside the label ring. Only the '.' between a row's first
 * and last 'o' are filled, so the corners outside the ellipse stay clear (and so does the spindle).
 */
function hazardRows(): string[] {
  const shape = ['...ooooooo...', '.oo.......oo.', 'o...........o', 'o...........o', 'o...........o', '.oo.......oo.', '...ooooooo...'];
  return shape.map((row, y) => {
    const first = row.indexOf('o');
    const last = row.lastIndexOf('o');
    return [...row]
      .map((ch, x) => {
        if (ch !== '.' || x < first || x > last || (x === 6 && y === 3)) return ch;
        return (x + y) % 4 < 2 ? 'k' : 'y';
      })
      .join('');
  });
}

// 'o' ring, '.' clear (outside the ellipse, and the spindle hole at the centre). Other letters are per label.
export const LABELS: readonly Label[] = [
  {
    // warm gold, a printed speaker cone around the spindle
    tag: 'boom-bap',
    legend: { o: 'amber-0', a: 'amber-1', b: 'amber-2', l: 'amber-3' },
    rows: [
      '...ooooooo...',
      '.oollbbbbboo.',
      'olbbaaaaabbbo',
      'obbalb.bbabbo',
      'obbbaaaaabbbo',
      '.oobbbbbbboo.',
      '...ooooooo...',
    ],
  },
  {
    // red with a white shield around the spindle
    tag: 'block-party',
    legend: { o: 'red-0', b: 'red-2', l: 'red-3', w: 'ink-7' },
    rows: [
      '...ooooooo...',
      '.oolwwwwwboo.',
      'olbbwwwwwbbbo',
      'obbbww.wwbbbo',
      'obbbbwwwbbbbo',
      '.oobbbwbbboo.',
      '...ooooooo...',
    ],
  },
  {
    // pale ice blue with a frost crystal
    tag: 'cold-snap',
    legend: { o: 'blue-0', b: 'blue-3', c: 'blue-1', s: 'blue-2' },
    rows: [
      '...ooooooo...',
      '.oobsbbbsboo.',
      'obbbbcbcbbbbo',
      'obsccc.cccsbo',
      'obbbbcbcbbbbo',
      '.oobsbbbsboo.',
      '...ooooooo...',
    ],
  },
  {
    // acid green with a smiling face; the spindle is its nose
    tag: 'acid-line',
    legend: { o: 'green-0', b: 'green-2', m: 'green-0' },
    rows: [
      '...ooooooo...',
      '.oobbbbbbboo.',
      'obbbmbbbmbbbo',
      'obbbbb.bbbbbo',
      'obbmbbbbbmbbo',
      '.oobmmmmmboo.',
      '...ooooooo...',
    ],
  },
  {
    // hazard stripes, yellow and black
    tag: 'booby-trap',
    legend: { o: 'amber-0', y: 'amber-3', k: 'ink-1' },
    rows: hazardRows(),
  },
  {
    // ivory over deep wine, split by a thin gold rule
    tag: 'toccata',
    legend: { o: 'red-0', b: 'skin-5', p: 'red-1', g: 'amber-3' },
    rows: [
      '...ooooooo...',
      '.oobbbbbbboo.',
      'obbbbbbbbbbbo',
      'oggggg.gggggo',
      'opppppppppppo',
      '.oopppppppoo.',
      '...ooooooo...',
    ],
  },
  {
    // dark violet with a cyan lightning bolt, broken at the spindle
    tag: 'breakbeat',
    legend: { o: 'dusk-0', b: 'dusk-1', l: 'dusk-2', c: 'blue-2', w: 'blue-3' },
    rows: [
      '...ooooooo...',
      '.oollbbbcwoo.',
      'olbbbbbcwbbbo',
      'obbbcw.cwbbbo',
      'obbbcwbbbbbbo',
      '.oocwbbbbboo.',
      '...ooooooo...',
    ],
  },
  {
    // parchment with a deep blue arched window around the spindle
    tag: 'plainchant',
    legend: { o: 'blue-0', b: 'skin-4', l: 'skin-5', a: 'blue-0', g: 'blue-1' },
    rows: [
      '...ooooooo...',
      '.oollbbbbboo.',
      'olbbbaaabbbbo',
      'obbbag.gabbbo',
      'obbbagggabbbo',
      '.oobagggaboo.',
      '...ooooooo...',
    ],
  },
];

function labelFrame(l: Label): Canvas {
  const c = canvas(W, H);
  paste(c, fromGrid(l.rows, l.legend), LABEL_X, LABEL_Y);
  return c;
}

/** Tag suffixes in frame order; vinyl-icon.ts uses the same order. */
export const LABEL_TAGS = LABELS.map((l) => l.tag);

export default {
  name: 'vinyl-label',
  frameWidth: W,
  frameHeight: H,
  frames: LABELS.map(labelFrame),
  tags: LABELS.map((l, i) => ({ name: `vinyl-label-${l.tag}`, from: i, to: i })),
  source: 'pixel grids, one 13x7 label per test vinyl',
} satisfies SpriteDef;
