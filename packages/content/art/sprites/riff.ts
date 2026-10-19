// Riff, the M1 metal guitarist. 3/4 front view facing down-left, toward Scratch Boy: long black hair,
// open denim vest with studs over a skull tee, skinny black jeans, brown combat boots, and a red
// arrowhead guitar with a maple neck on a leather strap. Hand-placed pixel grids (head, torso, arms,
// boots, guitar body) and shaded leg spans, pasted back to front per pose; code lays the neck on
// clean 1:2 diagonals and outlines the hair so its strand tips stay clean.
import { canvas, ellipse, fromGrid, get, outline, paste, set, type Canvas, type Pixel, type SpriteDef } from '../canvas.ts';
import type { PaletteColor } from '../../src/palette.ts';

const FW = 56;
const FH = 64;

// One legend for every grid. Digits are the ink ramp; letters are named below.
const L: Record<string, Pixel> = {
  '0': 'ink-0', '1': 'ink-1', '2': 'ink-2', '3': 'ink-3', '4': 'ink-4', '5': 'ink-5', '6': 'ink-6', '7': 'ink-7',
  // light skin window: skin-1 outline, skin-3 shadow, skin-4 base, skin-5 light
  a: 'skin-1', b: 'skin-3', c: 'skin-4', d: 'skin-5',
  // blue denim: blue-0 outline and folds, blue-1 base (ink-5 for worn highlights)
  N: 'blue-0', n: 'blue-1',
  // brown leather: boots and the guitar strap
  B: 'brick-0', C: 'brick-1', D: 'brick-2', E: 'brick-3',
  // red: the guitar, the shirt emblem
  R: 'red-0', r: 'red-1', s: 'red-2', t: 'red-3',
  // maple neck
  A: 'amber-0', m: 'amber-1', o: 'amber-2', y: 'amber-3',
};

type Pt = [number, number];
interface Part { x0: number; y0: number; c: Canvas }
function part(x0: number, y0: number, rows: readonly string[]): Part {
  return { x0, y0, c: fromGrid(rows, L) };
}
function put(f: Canvas, p: Part, dx = 0, dy = 0): void {
  paste(f, p.c, p.x0 + dx, p.y0 + dy);
}

// ---------------------------------------------------------------- head: face and long hair
// Interior only (x 14..41, y 3..34); outline() adds the ink-0 edge so the strand tips stay clean.
// Light from the top-left: one ink-4 sheen on the crown's left, the ink-1 mass on the right third.
const HEAD_X = 14;
const HEAD_Y = 3;
const HEAD_ROWS = [
  '............................', // 3
  '.........22442222...........', // 4
  '.......224442222222.........', // 5
  '......22442222222222........', // 6
  '.....2242222221222221.......', // 7  part
  '.....24222222122222211......', // 8
  '....22222221cc12222211......', // 9  forehead under the fringe
  '....2222221cddc12222211.....', // 10
  '....222221cddccb1222111.....', // 11
  '....221c11dc111b1222111.....', // 12 brows
  '....221c00dc00cbb121111.....', // 13 eyes
  '....211c07cc07cbb1221111....', // 14
  '....21ccccdccccbb1211111....', // 15 nose
  '....211ccccbcccbb1211111....', // 16
  '....211ca777acbb12211111....', // 17 grin
  '....2211cb11bbb122211111....', // 18 goatee
  '....22211b10bb1122212111....', // 19 chin
  '....221.........22121111....', // 20
  '....221.........22121111....', // 21
  '....241.........22212111....', // 22
  '....241.........22212111....', // 23
  '...2421.........222121111...', // 24 flares out over the shoulders
  '...2211.........221221111...', // 25
  '...22.1.........221212111...', // 26 strand tips
  '....2...........22.21211....', // 27
  '.................2.212.1....', // 28
  '.................2.211......', // 29
  '....................1.......', // 30
  '....................1.......', // 31
  '............................', // 32
  '............................', // 33
  '............................', // 34
];
/** The head with some rows swapped (keyed by frame y), outlined. */
function head(edits: Record<number, string> = {}): Part {
  const c = fromGrid(HEAD_ROWS.map((r, i) => edits[i + HEAD_Y] ?? r), L);
  outline(c);
  // under the chin the tee collar is the edge: drop the skin outline there
  for (let x = 23; x <= 27; x++) set(c, x - HEAD_X, 20 - HEAD_Y, null);
  for (let i = 0; i < c.pixels.length; i++) if (c.pixels[i] === 'skin-0') c.pixels[i] = null;
  return { x0: HEAD_X, y0: HEAD_Y, c };
}
const HEAD = head();
// eyes squeezed shut, rocking out
const HEAD_BANG = head({
  13: '....221cccdccccbb121111.....',
  14: '....211c00cc00cbb1221111....',
});
// shock: brows hidden under the fringe, eyes wide, mouth a small O
const HEAD_SHOCK = head({
  12: '....221cccdccccb1222111.....',
  13: '....221c77dc77cbb121111.....',
  17: '....211cca0accbb12211111....',
});
// shouting: jaw dropped, mouth open under the teeth
const HEAD_SHOUT = head({
  18: '....2211a000abb122211111....',
  19: '....22211b11bb1122212111....',
});
// bowed: the fringe falls over the face; only the nose tip and the chin show, in shadow
const HEAD_BOWED = head({
  9: '....222222221222222211......',
  10: '....2222222212222222211.....',
  11: '....2221221221222222111.....',
  12: '....2221221221222221111.....',
  13: '....2221221221222211111.....',
  14: '....22212212212222111111....',
  15: '....2221221b212221111111....',
  16: '....2221abbba12221111111....',
  17: '....22211aba112221111111....',
  18: '....22211bbb112221111111....',
  19: '....22211101112221211111....',
});

// ---------------------------------------------------------------- torso: black tee, open denim vest, studded belt. x 15..40, y 18..37
const TORSO = part(15, 18, [
  '.........abbba............', // 18 neck, in the jaw's shadow
  '.........abbba............', // 19
  '.....NNN0332210NNN........', // 20 collar, vest shoulders
  '....N5nn0332210nNNNN......', // 21
  '...N5nn603322106NNNNNN....', // 22
  '...N5nnn0366610nNNNNNN....', // 23 skull on the tee
  '...N5nn606767606NNNNNN....', // 24
  '...N5nnn0606060nnNNNNN....', // 25
  '...Nnnn603666106nNNNNN....', // 26
  '...N5nnn0361610nnnNNNN....', // 27
  '...Nnnn603222106nnnNNN....', // 28
  '...Nnnnn0322210nnnnnNN....', // 29
  '...Nnnn602222106nnnNNN....', // 30
  '...NNnnn0222210nnnnnNN....', // 31
  '....Nnnn0222110nnnnNNN....', // 32
  '....NNNN0221110NNNNNNN....', // 33
  '....0332222222222211110...', // 34 tee hem
  '....000000000000000000....', // 35 belt
  '....061616055061616160....', // 36
  '....000000000000000000....', // 37
]);

/** Guitar strap: 2 px of leather from under the hair at his near shoulder, across the tee, to the body. */
function strap(f: Canvas, dy: number, to = 38): void {
  for (let y = 28; y <= to; y++) {
    const x = 30 - (y - 28);
    set(f, x, y + dy, 'brick-2');
    set(f, x + 1, y + dy, 'brick-0');
  }
}

// ---------------------------------------------------------------- legs: skinny black jeans and brown combat boots
// y, left leg l..r, right leg l..r (one span while they meet). The near (screen-right) leg is 1 px longer.
const LEG_SPANS: [number, number, number, number, number][] = [
  [38, 19, 36, 0, 0],
  [39, 19, 36, 0, 0],
  [40, 19, 36, 0, 0],
  [41, 18, 26, 28, 36],
  [42, 18, 25, 29, 36],
  [43, 18, 25, 29, 37],
  [44, 17, 24, 30, 37],
  [45, 17, 24, 30, 37],
  [46, 17, 24, 30, 38],
  [47, 17, 24, 31, 38],
  [48, 16, 23, 31, 38],
  [49, 16, 23, 31, 38],
  [50, 16, 23, 31, 39],
  [51, 16, 23, 32, 39],
  [52, 16, 23, 32, 39],
  [53, 0, 0, 32, 39],
];
/** Black denim: ink-5 rim on the lit left edge (broken at the knee), ink-3 on the thigh, ink-1 shadow widening downward. */
function legSpan(c: Canvas, y: number, l: number, r: number): void {
  const t = (y - 38) / 15;
  const shadow = 1 + Math.round(t * 2);
  for (let x = l; x <= r; x++) {
    let p: PaletteColor = 'ink-2';
    if (x === l || x === r) p = 'ink-0';
    else if (x === l + 1) p = y === 46 || y === 47 ? 'ink-3' : 'ink-5';
    else if (x >= r - shadow) p = 'ink-1';
    else if (x === l + 2 && y <= 44) p = 'ink-3';
    set(c, x, y, p);
  }
}
const BOOT = [
  '..BEDDDCB..',
  '..BEDDDCB..',
  '..BDBBDCB..',
  '..BDDDDCCB.',
  '.BEDBBDDCB.',
  'BEEDDDDDCCB',
  'BDDDDDDCCCB',
  '03333322210',
  '.000000000.',
];
function legs(): Canvas {
  const c = canvas(FW, FH);
  for (const [y, l1, r1, l2, r2] of LEG_SPANS) {
    if (l1) legSpan(c, y, l1, r1);
    if (l2) legSpan(c, y, l2, r2);
  }
  paste(c, fromGrid(BOOT, L), 13, 52);
  paste(c, fromGrid(BOOT, L), 30, 53);
  return c;
}

// ---------------------------------------------------------------- arms
// Skin-4 base, a 2-3 px skin-5 cluster on top of the shoulder and of the forearm, a skin-3 mass on the
// bottom-right of each segment, and a deltoid/elbow bump in the outline.
// far arm (his right, screen-left) strumming over the guitar body. x 10..24, y 22..44
const ARM_STRUM = part(10, 22, [
  '....aaa........', // 22
  '...acdca.......', // 23
  '..acddcba......', // 24 deltoid
  '..accccba......', // 25
  '..acccba.......', // 26
  '..acccba.......', // 27
  '..accbba.......', // 28
  '..accbba.......', // 29
  '..acccba.......', // 30
  '..acccbba......', // 31 elbow
  '..acddcbba.....', // 32 forearm top lit
  '...acdccbba....', // 33
  '....accccba....', // 34
  '.....acccbba...', // 35
  '......acccba...', // 36
  '.......accbba..', // 37
  '.......abcbba..', // 38
  '.......a1111a..', // 39 wristband
  '.......a1661a..', // 40
  '........acddca.', // 41 fist with the pick
  '........accbba.', // 42
  '.........abba..', // 43
  '..........aa...', // 44
]);
// strum arm raised high for the wind-up, pick in the fist. x 8..20, y 2..23
const ARM_UP = part(8, 2, [
  '..aaa........', // 2
  '.addca.......', // 3
  '.acccba......', // 4
  '.accbba......', // 5
  '..abba.......', // 6
  '..a161a......', // 7 wristband
  '..a111a......', // 8
  '..adcca......', // 9  forearm top lit
  '..adcca......', // 10
  '..accba......', // 11
  '..accbba.....', // 12
  '...accba.....', // 13 elbow
  '...acccba....', // 14
  '....accba....', // 15
  '....acccba...', // 16
  '.....accba...', // 17
  '.....acccba..', // 18
  '.....acdcba..', // 19
  '......addcba.', // 20 shoulder
  '......acccbba', // 21
  '......accbbba', // 22
  '.......abbba.', // 23
]);
// strum arm swung down through the strings. x 10..28, y 22..46
const ARM_STRIKE = part(10, 22, [
  '....aaa............', // 22
  '...acdca...........', // 23
  '..acddcba..........', // 24
  '..accccba..........', // 25
  '..acccba...........', // 26
  '..acccba...........', // 27
  '..accbba...........', // 28
  '..accbba...........', // 29
  '..acccba...........', // 30
  '..acccbba..........', // 31
  '..acddcbba.........', // 32
  '...acdccbba........', // 33
  '....accccba........', // 34
  '.....accccba.......', // 35
  '......accccba......', // 36
  '.......accccba.....', // 37
  '........acccbba....', // 38
  '.........accbba....', // 39
  '.........abcbba....', // 40
  '.........a1111a....', // 41 wristband
  '.........a1661a....', // 42
  '..........acddca...', // 43
  '..........accbba...', // 44
  '...........abba....', // 45
  '............aa.....', // 46
]);
// strum arm out to the left, devil horns up: elbow at x 8..12, a 10 px forearm, fist top at y 16. x 6..20, y 11..31
const ARM_HORNS = part(6, 11, [
  '...a...a.......', // 11 finger tips
  '..ada.aca......', // 12 index and little finger
  '..ada.aca......', // 13
  '..aca.aba......', // 14
  '..acaaaba......', // 15
  '..acddcba......', // 16 fist
  '..acccbba......', // 17
  '..abcbba.......', // 18
  '...a161a.......', // 19 wristband
  '...a111a.......', // 20
  '...adcca.......', // 21 forearm top lit
  '...adcba.......', // 22
  '...accba.......', // 23
  '..acccba.......', // 24
  '..acccba.......', // 25
  '..accccbaaaa...', // 26 elbow; upper arm runs up-right to the shoulder
  '..acccccddcca..', // 27
  '..abccccccccba.', // 28
  '...abbcccccbba.', // 29
  '....aabbbbbaa..', // 30
  '......aaaaa....', // 31
]);
// near arm (his left, screen-right) fretting the neck. x 36..50, y 22..35
const ARM_FRET = part(36, 22, [
  '....aaaa.......', // 22
  '...acddca......', // 23
  '..acddccba.....', // 24 deltoid
  '..acccccba.....', // 25
  '..accccba......', // 26
  '..accccba......', // 27
  '..acccbba......', // 28
  '..acccbbba.....', // 29 elbow bump
  '..accccbbaaaaa.', // 30
  '...acddcbacddca', // 31 forearm into the fist
  '...acccccccccba', // 32
  '....abccccccbba', // 33
  '.....abbbbbbba.', // 34
  '......aaaaaaa..', // 35
]);
// down: far arm hanging, hand draped over the propped guitar. x 10..19, y 35..52
const ARM_FAR_LIMP = part(10, 35, [
  '...aaa....', // 35
  '..acdca...', // 36
  '.acddcba..', // 37
  '.accccba..', // 38
  '..acccba..', // 39
  '..acccba..', // 40
  '..accbba..', // 41
  '..accbba..', // 42
  '..acccbba.', // 43 elbow
  '..acddcba.', // 44 forearm top lit
  '...acccba.', // 45
  '...accbba.', // 46
  '...a1111a.', // 47 wristband
  '...a1661a.', // 48
  '....acddca', // 49 hand over the guitar's edge
  '....accbba', // 50
  '.....abba.', // 51
  '......aa..', // 52
]);
// down: near arm bent at the elbow (y 46), hand resting on the thigh. x 31..46, y 35..54
const ARM_NEAR_BENT = part(31, 35, [
  '........aaaa....', // 35
  '.......acddca...', // 36
  '.......addccba..', // 37 deltoid
  '.......acccccba.', // 38
  '.......accccba..', // 39
  '.......accccba..', // 40
  '.......accccba..', // 41
  '.......acccbba..', // 42
  '.......acccbba..', // 43
  '.......accccbba.', // 44
  '.......accccbba.', // 45 elbow bump
  '......acddccbba.', // 46 forearm turns down-left, top lit
  '.....accdccbba..', // 47
  '....acccccbba...', // 48
  '...acccccbba....', // 49
  '..acccccbba.....', // 50
  '.acddccbba......', // 51 hand on the thigh
  '.accccbba.......', // 52
  '..acbbba........', // 53
  '...aaaa.........', // 54
]);

// ---------------------------------------------------------------- guitar
// Idle guitar, x 9..34, y 34..52: a red arrowhead body with a forward horn and two swept-back
// points, at his right hip; the maple neck rises up-right on a clean 1:2 diagonal.
const BODY_IDLE = part(9, 34, [
  '......................t...', // 34
  '.....................ts...', // 35
  '....................tsr...', // 36
  '..................ttssr...', // 37
  '..............ttttsssssr..', // 38
  '..........tttt7sssssssr...', // 39
  '......ttttssssssssssssssr.', // 40
  '..ttttsssssssssssssssssssr', // 41
  '...rssssssssssssssssssssr.', // 42
  '....rssssssssssssssssrr...', // 43
  '.....rsssssssssssssrr.....', // 44
  '......rssssssssssrr.......', // 45
  '.......ssssssssrr.........', // 46
  '......tssssssrr...........', // 47
  '......tssssrr.............', // 48
  '.....tsssrr...............', // 49
  '.....tsrr.................', // 50
  '....trr...................', // 51
  '....r.....................', // 52
]);
/** top row of the neck/strings at column x: leaves the body at (29, 39), rising 1 px every 2 */
const neckY = (x: number): number => 39 - Math.floor((x - 29) / 2);
/** The red body with its hardware, unoutlined. */
function guitarBody(c: Canvas, dx = 0, dy = 0): void {
  put(c, BODY_IDLE, dx, dy);
  // pickups (black, slanted across the strings), chrome bridge, a black knob
  paste(c, fromGrid(['13', '11', '11', '.1'], L), 25 + dx, 39 + dy);
  paste(c, fromGrid(['13', '11', '11', '.1'], L), 21 + dx, 41 + dy);
  paste(c, fromGrid(['7.', '65', '.5'], L), 18 + dx, 43 + dy);
  paste(c, fromGrid(['31', '10'], L), 15 + dx, 48 + dy);
}
/** The neck stub from the body up to column `to`, ending in two splinter teeth. */
function neckStub(c: Canvas, to: number, dx = 0, dy = 0): void {
  for (let x = 30; x <= to; x++) {
    set(c, x + dx, neckY(x) + dy, 'amber-2');
    set(c, x + dx, neckY(x) + 1 + dy, 'amber-1');
  }
  set(c, to + 1 + dx, neckY(to) - 1 + dy, 'amber-3');
  set(c, to + 1 + dx, neckY(to) + 1 + dy, 'amber-3');
}
const HEADSTOCK = fromGrid(['....tt', '..tss.', '.tssr.', 'tsrr..', 'sr....'], L);

function guitarIdle(): Canvas {
  const c = canvas(FW, FH);
  guitarBody(c);
  // neck: maple, lit top edge
  for (let x = 30; x <= 48; x++) {
    set(c, x, neckY(x), 'amber-2');
    set(c, x, neckY(x) + 1, 'amber-1');
  }
  paste(c, HEADSTOCK, 49, 26);
  outlineMaterial(c);
  set(c, 51, 26, 'ink-6');
  set(c, 53, 25, 'ink-6');
  return c;
}

// The snapped neck hanging from his fist: broken end up, headstock pointing down. x 43..48, y 27..47
const NECK_HANGING = fromGrid([
  '.y.y..', // 27 splinters
  '.oym..', // 28
  '.om...', // 29
  '.om...', // 30
  '.om...', // 31
  '.om...', // 32
  '.om...', // 33
  '.om...', // 34
  '.om...', // 35
  '..om..', // 36
  '..om..', // 37
  '..om..', // 38
  '..om..', // 39
  '.tssr.', // 40 headstock
  '.tsssr', // 41
  '.tssr.', // 42
  '..tsr.', // 43
  '..tsr.', // 44
  '..sr..', // 45
  '..r...', // 46
], L);
/** Snapped: a splintered stub on the body, a clean gap, the rest of the neck hanging from his fist, two loose strings between. */
function guitarBroken(): Canvas {
  const c = canvas(FW, FH);
  guitarBody(c);
  neckStub(c, 34);
  paste(c, NECK_HANGING, 43, 27);
  outlineMaterial(c);
  // tuner pegs on the hanging headstock
  set(c, 43, 41, 'ink-6');
  set(c, 49, 42, 'ink-6');
  set(c, 43, 43, 'ink-6');
  // two loose strings sagging from the stub to the hanging piece
  for (const [x, y] of STRING_A) set(c, x, y, 'ink-5');
  for (const [x, y] of STRING_B) set(c, x, y, 'ink-5');
  return c;
}
const STRING_A: Pt[] = [[36, 37], [37, 38], [38, 39], [39, 39], [40, 39], [41, 38], [42, 37]];
const STRING_B: Pt[] = [[36, 40], [37, 41], [38, 42], [39, 42], [40, 42], [41, 41], [42, 40]];

/** Outline in the -0 of the touching material (wood takes brick-0, ink takes ink-0). */
function outlineMaterial(c: Canvas): void {
  const src = canvas(c.width, c.height);
  paste(src, c, 0, 0);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (get(src, x, y) !== null) continue;
    let best: Pixel = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Pt[]) {
      const n = get(src, x + dx, y + dy);
      if (n === null) continue;
      const pick: PaletteColor = n.startsWith('amber') ? 'brick-0' : n.startsWith('ink') ? 'ink-0' : ((n.slice(0, n.lastIndexOf('-')) + '-0') as PaletteColor);
      if (best === null || pick === 'ink-0') best = pick;
    }
    if (best !== null) set(c, x, y, best);
  }
}

// ---------------------------------------------------------------- down: kneeling behind the propped, broken guitar
// Kneeling: the thighs point at the camera, so their tops face up and catch the light (ink-3, ink-5
// rim); the knee fronts below stay ink-2 with an ink-0 edge against the ground shadow.
const KNEEL = part(14, 51, [
  '.....05333332053333333210......', // 51 hips under the belt: thigh tops face up, so they catch the light
  '....053333320533333332110......', // 52
  '...0533333205533333322110......', // 53
  '..05333332055333332211110......', // 54 kneecaps, lit top-left
  '..0222221002222211111110.......', // 55 knee fronts
  '..022221100222211011110........', // 56
  '...000000..000000.0000.........', // 57
]);
const HEEL = fromGrid(['.BBBB.', 'BEDDCB', 'BDDDCB', 'B3221B', '.BBBB.'], L);
function kneel(): Canvas {
  const c = canvas(FW, FH);
  paste(c, HEEL, 38, 53);
  put(c, KNEEL);
  return c;
}
/** The broken guitar propped on its lower point, the snapped neck lying on the ground beside him. */
function guitarDown(): Canvas {
  const c = canvas(FW, FH);
  const dx = -9;
  const dy = 10;
  guitarBody(c, dx, dy);
  neckStub(c, 34, dx, dy);
  // the neck piece on the ground
  for (let x = 43; x <= 49; x++) {
    set(c, x, 59, 'amber-2');
    set(c, x, 60, 'amber-1');
  }
  set(c, 42, 59, 'amber-3');
  set(c, 42, 61, 'amber-3');
  set(c, 42, 60, 'amber-2');
  paste(c, fromGrid(['ts...', 'sssst', 'rrr..'], L), 50, 58);
  outlineMaterial(c);
  set(c, 51, 57, 'ink-6');
  set(c, 53, 57, 'ink-6');
  return c;
}
function down(): Canvas {
  const f = canvas(FW, FH);
  ellipse(f, 12, 57, 32, 7, 'ink-1');
  paste(f, kneel(), 0, 0);
  put(f, TORSO, 0, 13);
  paste(f, guitarDown(), 0, 0);
  put(f, ARM_FAR_LIMP, -2, 0);
  put(f, ARM_NEAR_BENT);
  put(f, HEAD_BOWED, -3, 18);
  relight(f);
  return f;
}

// ---------------------------------------------------------------- compose
// Sound arcs flying off the strings toward Scratch Boy, opening right like '('.
const ARC_M = fromGrid(['..5', '.6.', '7..', '7..', '7..', '.6.', '..5'], L);
const ARC_L = fromGrid(['...5', '..6.', '.6..', '7...', '7...', '7...', '7...', '7...', '.6..', '..6.', '...5'], L);
// the pick hitting the strings
const ZING = fromGrid(['..7..', '..y..', '7yyy7', '..y..', '..7..'], L);

interface Pose {
  head?: Part;
  headAt?: Pt;
  /** upper body drop: torso, guitar and both arms */
  body?: number;
  strum?: Part;
  strumAt?: Pt;
  fret?: Part;
  fretAt?: Pt;
  fx?: [Canvas, number, number][];
  guitar?: 'idle' | 'broken';
}

function frame(p: Pose): Canvas {
  const f = canvas(FW, FH);
  const b = p.body ?? 0;
  ellipse(f, 12, 57, 32, 7, 'ink-1');
  paste(f, legs(), 0, 0);
  put(f, TORSO, 0, b);
  paste(f, p.guitar === 'broken' ? guitarBroken() : guitarIdle(), 0, b);
  strap(f, b);
  const [sx, sy] = p.strumAt ?? [0, b];
  put(f, p.strum ?? ARM_STRUM, sx, sy);
  const [fx, fy] = p.fretAt ?? [0, b];
  put(f, p.fret ?? ARM_FRET, fx, fy);
  const [hx, hy] = p.headAt ?? [0, b];
  put(f, p.head ?? HEAD, hx, hy);
  for (const [c, x, y] of p.fx ?? []) paste(f, c, x, y);
  relight(f);
  return f;
}

const LIT_OUTLINE: Partial<Record<PaletteColor, PaletteColor>> = {
  'ink-0': 'ink-1', 'skin-1': 'skin-3', 'red-0': 'red-1', 'brick-0': 'brick-1',
};
/** Selective outline: silhouette outline pixels on lit (top/left) edges move one step lighter. */
function relight(f: Canvas): void {
  const src = canvas(FW, FH);
  paste(src, f, 0, 0);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const p = get(src, x, y);
    const lit = p === null ? undefined : LIT_OUTLINE[p];
    if (lit && (get(src, x - 1, y) === null || get(src, x, y - 1) === null)) set(f, x, y, lit);
  }
}

const FRAMES: Canvas[] = [
  // idle: head-bang-lite, eyes shut on the down beat
  frame({}),
  frame({ head: HEAD_BANG, headAt: [-1, 2], body: 1 }),
  // attack: wind-up, strike through the strings, hold the chord with the horns up
  frame({ strum: ARM_UP, headAt: [1, -1] }),
  frame({ strum: ARM_STRIKE, head: HEAD_BANG, headAt: [-1, 3], body: 1, fx: [[ZING, 15, 40], [ARC_M, 6, 40]] }),
  frame({ strum: ARM_HORNS, head: HEAD_SHOUT, headAt: [0, -1], fx: [[ARC_M, 6, 40], [ARC_L, 1, 38]] }),
  // noguitar: the idle bob, staring at the snapped neck
  frame({ head: HEAD_SHOCK, guitar: 'broken' }),
  frame({ head: HEAD_SHOCK, headAt: [0, 2], body: 1, guitar: 'broken' }),
  // down: on his knees
  down(),
];

export default {
  name: 'riff',
  frameWidth: FW,
  frameHeight: FH,
  frames: FRAMES,
  durations: [300, 300, 220, 100, 420, 320, 320, 400],
  tags: [
    { name: 'riff-idle', from: 0, to: 1 },
    { name: 'riff-attack', from: 2, to: 4 },
    { name: 'riff-noguitar', from: 5, to: 6 },
    { name: 'riff-down', from: 7, to: 7 },
  ],
  source: 'hand-placed pixel grids per body part and pose (head, torso, arms, boots, guitar), shaded leg spans, code-drawn neck diagonals and hair outline',
} satisfies SpriteDef;
