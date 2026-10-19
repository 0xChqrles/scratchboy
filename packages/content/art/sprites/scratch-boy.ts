// Scratch Boy, 3/4 back view, facing up-right toward the opponent. Red cap tilted to his right (its
// flat bill points the way he faces), DJ headphones round his neck, oversized gold varsity jacket with
// black leather sleeves and a record patch on the back, baggy jeans, white high-tops.
// Built from hand-placed pixel layers ({ x, y, rows }) that each frame stacks with small offsets:
// idle (2 frames: a nod to the beat), scratch (reach, push, pull: the hand works the record's left
// edge, where the motion is vertical on screen), down (head pitched forward, shoulders slumped).
// Light from the top-left. Leather and plastic use ink-0..3 with an ink-5 rim, skin the medium window.
// In battle the DJ table is drawn over him from row TABLE_ROW down (see dj-table.ts): his hanging hands
// stay at x <= 33 below row 45 (the table's DJ end) and the near arm at x <= 35 below row 29 (the
// first deck); the scratch hand stays at x 38-46 and x 47 stays empty.
import { canvas, ellipse, set, type Canvas, type Pixel, type SpriteDef } from '../canvas.ts';

const W = 48;
const H = 64;

/**
 * Ground shadow box, centred under the shoes (x 10-31): its centre (SHADOW_X + 13, SHADOW_Y + 3) =
 * (21, 61) in frame-edge units is the origin. It ends at x 33 so nothing of his shows right of the
 * table's DJ end below row 45.
 */
const SHADOW_X = 8;
const SHADOW_Y = 58;
const SHADOW_W = 26;
const SHADOW_H = 6;
/** Frame row that lines up with the DJ table's back edge (dj-table row 0) in the battle layout. */
export const TABLE_ROW = 46;

const LEGEND: Readonly<Record<string, Pixel>> = {
  // black: hair, leather, headphones; chrome; white sneakers
  '0': 'ink-0', '1': 'ink-1', '2': 'ink-2', '3': 'ink-3', '4': 'ink-4', '5': 'ink-5', '6': 'ink-6', '7': 'ink-7',
  // cap, rib stripes, cushions, heel tabs, patch label
  R: 'red-0', r: 'red-1', q: 'red-2', Q: 'red-3',
  // skin, medium window
  K: 'skin-0', k: 'skin-2', s: 'skin-3', S: 'skin-4',
  // gold wool
  A: 'amber-0', a: 'amber-1', g: 'amber-2', G: 'amber-3',
  // blue denim (worn highlights are ink-5)
  D: 'blue-0', d: 'blue-1',
};

/** A pixel grid whose top-left sits at frame (x, y). '.' is transparent. */
interface Layer {
  x: number;
  y: number;
  rows: readonly string[];
}

function draw(c: Canvas, l: Layer, dx = 0, dy = 0): void {
  const w = l.rows[0]?.length ?? 0;
  l.rows.forEach((row, i) => {
    if (row.length !== w) throw new Error(`scratch-boy: layer row ${l.y + i} is ${row.length} wide, expected ${w}`);
    for (let j = 0; j < w; j++) {
      const ch = row.charAt(j);
      if (ch === '.') continue;
      const px = LEGEND[ch];
      if (px === undefined) throw new Error(`scratch-boy: '${ch}' is not in the legend`);
      set(c, l.x + j + dx, l.y + i + dy, px);
    }
  });
}

// ---------------------------------------------------------------- layers

// Baggy blue jeans, white high-tops with red heel tabs. In battle the DJ table hides rows 46+.
const LEGS: Layer = { x: 10, y: 46, rows: [
  '.DddddddddddddddddddD.', // 46
  '.D55ddddddddddddddddD.', // 47
  '.D5dddddddDdddddddddD.', // 48
  '.DdddddddDDdddddddddD.', // 49
  '.DdddddddD.DddddddddD.', // 50
  '.D5ddddddD.D5dddddddD.', // 51
  '.D55dddddD.D55ddddddD.', // 52
  '.DdDDddddD.DdDDDddddD.', // 53
  '.DdddddddD.DddddddddD.', // 54
  'DddDdddddD.DdddDddddD.', // 55
  'D5dDddddDD.D5ddDdddDD.', // 56
  '07qq77660..DdddDddddD.', // 57
  '077777660.077qq777660.', // 58
  '066666650.07777777760.', // 59
  '055555540.066666666650', // 60
  '.0000000...05555555540', // 61
  '...........00000000000', // 62
] };

// Far (left) arm, hanging: black leather sleeve lit on its outer side, an elbow crease, red-striped rib cuff.
const ARM_FAR: Layer = { x: 4, y: 25, rows: [
  '..0000.', // 25
  '.055530', // 26
  '0533321', // 27
  '0333321', // 28
  '0333221', // 29
  '0332211', // 30
  '0332211', // 31
  '0322211', // 32
  '0322211', // 33
  '0322111', // 34
  '0311211', // 35
  '0322111', // 36
  '0322111', // 37
  '0321111', // 38
  '0321110', // 39
  '.022110', // 40
  '.022210', // 41
  '.0Qqqr0', // 42
  '.011110', // 43
  '.KSSsK.', // 44
  'KSssskK', // 45
  'KssskkK', // 46
  '.KskkK.', // 47
  '..KKK..', // 48
] };

// The nape, between the hair and the collar.
const NECK: Layer = { x: 15, y: 19, rows: [
  'KkkkkkkkkkKK', // 19
  'KkkkkkkkkkK.', // 20
  'KkkkkkkkkkK.', // 21
] };

// Rib collar with its red stripe, its shadow, the shoulders and the top of the back (shoulder-blade light, armpit fold).
const YOKE: Layer = { x: 8, y: 22, rows: [
  '...00000000000000000......', // 22
  '..0332222222222222110.....', // 23
  '.0QQqqqqqqqqqqqqqqrR0.....', // 24
  '.0gggAAAAAAAAAAAAAAaaaa0..', // 25
  '0ggggggggggggggggggggaaaA0', // 26
  '0ggGGggg00000ggggggaaaaaa0', // 27
  '0ggGGgg0111110ggggaaaaaaa0', // 28
] };

// Down: a narrower collar on sloped shoulders, light across the hunched upper back.
const YOKE_DOWN: Layer = { x: 8, y: 22, rows: [
  '....000000000000000.......', // 22
  '...03322222222222110......', // 23
  '..0QQqqqqqqqqqqqqqrR0.....', // 24
  '..00AAAAAAAAAAAAAAAa00....', // 25
  '.0gGGGGGGGGGGGGGGgggaaa0..', // 26
  '0ggGGgggg00000ggggaaaaaA0.', // 27
  '0ggGGgg0111110ggggaaaaaaa0', // 28
] };

// Gold wool back with the record patch, the 3/4 side plane stepping in toward the hip, rib waistband.
const BACK: Layer = { x: 8, y: 29, rows: [
  '0ggggg011422110gggaaaaaaa0', // 29
  '0gggg01151112110gggaaaaaa0', // 30
  '0gggg0141Qqq1210gggaaaaaa0', // 31
  '0gggg0121q7q1210ggggaaaaa0', // 32
  '0gggg0121qqr1210gggaaaaaa0', // 33
  '0gggg01121112110gggaaaaaa0', // 34
  '0ggggg011222110ggggaaaaaa0', // 35
  '0gggggg0111110gggggaaaaaa0', // 36
  '0ggggggg00000gggggaaaaaaa0', // 37
  '0gggggggggggggggggaaaaAAA0', // 38
  '0gggaggggggaggggggaaaAAAA0', // 39
  '0ggaaggggggaaggggaaaAAAAA0', // 40
  '0gaagggggggaaagggaaaAAAAA0', // 41
  '.0aaaaaaaaaaaaaaaaaaaAAA0.', // 42
  '..0333222222222222222111..', // 43
  '..0QQqqqqqqqqqqqqqqqqqr0..', // 44
  '..0111111111111111111110..', // 45
  '...00000000000000000000...', // 46
] };

// Cap tilted to his right, flat bill pointing up-right (the way he faces), snapback strap; short hair, right ear, a sliver of jaw.
const HEAD: Layer = { x: 9, y: 2, rows: [
  '..........RR...................', // 2
  '......rrrrrRRRRRR..............', // 3
  '....rrQQQqqqqqqqqRR............', // 4
  '...rqQQQQqqqqqqqqrrR...........', // 5
  '..rqqQQqqqqqqqqqqrrrR..........', // 6
  '.rqqqqqqqrqqqqqqrrrrrR.........', // 7
  'rqqqqqqqqrqqqqqqrrrrrrR........', // 8
  'rqqqqqqRRRRRqqqqrrrrrrR....QQqR', // 9
  'rqqqqqR12221RqqqrrrrrrrQQQQqqRR', // 10
  'RqqqqqR12211RqqrrrrrrrrqqqqRR..', // 11
  'Rqqqqqrrr6rrrqqrrrrrrrRRRRR....', // 12
  'RrrrrrrrrrrrrrrrrrrrrrR........', // 13
  '.RRRRRRRRRRRRRRRRRRRRR.........', // 14
  '.04442222221111KSssKsK.........', // 15
  '..0422222221111KsksKkK.........', // 16
  '...022222211111KsssKK..........', // 17
  '.....0111111110KKsK............', // 18
] };

// Down: head pitched forward. Lower crown with its button on top, the snapback opening turned under, the bill angled down.
const HEAD_DOWN: Layer = { x: 9, y: 4, rows: [
  '..........RR..................', // 4
  '......rrrrrRRRRRR.............', // 5
  '....rrQQQqqqqqqqqRR...........', // 6
  '...rqQQQqqqqqqqqqrrR..........', // 7
  '..rqqQqqqqqqqqqqqrrrR.........', // 8
  '.rqqqqqqqrqqqqqqrrrrrR........', // 9
  'rqqqqqqqqrqqqqqqrrrrrrR.......', // 10
  'rqqqqqqRRRRRqqqqrrrrrrrQQ.....', // 11
  'RqqqqqR12221RqqrrrrrrrrqqQQ...', // 12
  'Rrrrrrrrr6rrrrrrrrrrrrRRRqqQQ.', // 13
  '.RRRRRRRRRRRRRRRRRRRRR...RRqqR', // 14
  '.02442222221111KSssK.......RRR', // 15
  '..0422222221111KsksK..........', // 16
  '...011111111111KsssK..........', // 17
  '................KsK...........', // 18
  '.................K............', // 19
] };

// DJ headphones round his neck: cups resting on the collar (red cushion inside, lit rim, one glint), the band across the nape.
const PHONES: Layer = { x: 12, y: 21, rows: [
  '.000..57555..000.', // 21
  '075205.....507520', // 22
  '0522q.......q5220', // 23
  '02210.......02210', // 24
  '.000.........000.', // 25
] };

// Near (right) arm, hanging and angled in to the hip, clear of the first deck (x <= 35 below row 29, x <= 33 below row 45).
const ARM_NEAR: Layer = { x: 28, y: 24, rows: [
  '....0000..', // 24
  '...055530.', // 25
  '..05333210', // 26
  '..05333210', // 27
  '..0333210.', // 28
  '.0333210..', // 29
  '.0333210..', // 30
  '.0332210..', // 31
  '.0332110..', // 32
  '.0322110..', // 33
  '0322110...', // 34
  '0312110...', // 35
  '0112110...', // 36
  '0321110...', // 37
  '0321110...', // 38
  '0221110...', // 39
  '022110....', // 40
  '0Qqqr0....', // 41
  '011110....', // 42
  'KSSssK....', // 43
  'KSsssK....', // 44
  'KsskkK....', // 45
  '.KkkK.....', // 46
  '..KK......', // 47
] };

// Down: near arm with the shoulder lowered and pulled in (drawn with the down pose offsets, like the others).
const ARM_NEAR_DOWN: Layer = { x: 27, y: 24, rows: [
  '....0000.', // 24
  '...055530', // 25
  '..0533210', // 26
  '..0533210', // 27
  '..0333210', // 28
  '.0333210.', // 29
  '.0332210.', // 30
  '.0332110.', // 31
  '.0322110.', // 32
  '0322110..', // 33
  '0312110..', // 34
  '0112110..', // 35
  '0322110..', // 36
  '0321110..', // 37
  '0321110..', // 38
  '022110...', // 39
  '0Qqqr0...', // 40
  '011110...', // 41
  'KSSssK...', // 42
  'KSsssK...', // 43
  'KsskkK...', // 44
  '.KkkK....', // 45
  '..KK.....', // 46
] };

// Scratch 1, reach: elbow out to the right, forearm down, hand flat on the record at 9 o'clock (hand rows 46-50).
const ARM_REACH: Layer = { x: 30, y: 24, rows: [
  '..0000...........', // 24
  '.0555500.........', // 25
  '053333550........', // 26
  '0333333350.......', // 27
  '022233333500.....', // 28
  '0122223333550....', // 29
  '.0112223333350...', // 30
  '..0112222333350..', // 31
  '...0111222233350.', // 32
  '....001122223330.', // 33
  '......0112222230.', // 34
  '.......01332210..', // 35
  '........0332210..', // 36
  '........0332210..', // 37
  '........0312210..', // 38
  '........0331210..', // 39
  '........0332210..', // 40
  '........0322210..', // 41
  '........0322210..', // 42
  '........0322210..', // 43
  '........0Qqqqr0..', // 44
  '........0111110..', // 45
  '........KSSsssK..', // 46
  '........KSssssskK', // 47
  '........KsssskkK.', // 48
  '.........KkkkKK..', // 49
  '..........KKK....', // 50
] };

// Scratch 2, push (away from him): elbow higher, hand rows 43-47.
const ARM_PUSH: Layer = { x: 30, y: 24, rows: [
  '..0000...........', // 24
  '.0555550.........', // 25
  '05333335500......', // 26
  '0333333355000....', // 27
  '022233333335550..', // 28
  '0122222333333350.', // 29
  '.011222222333330.', // 30
  '..00111222222330.', // 31
  '....001112232220.', // 32
  '......0011322110.', // 33
  '........03322110.', // 34
  '........03322110.', // 35
  '........03322110.', // 36
  '........03312110.', // 37
  '........03322110.', // 38
  '........0322210..', // 39
  '........0322210..', // 40
  '........0Qqqqr0..', // 41
  '........0111110..', // 42
  '........KSSsssK..', // 43
  '........KSssssskK', // 44
  '........KsssskkK.', // 45
  '.........KkkkKK..', // 46
  '..........KKK....', // 47
] };

// Scratch 3, pull (toward him): elbow lower, hand rows 49-53.
const ARM_PULL: Layer = { x: 30, y: 24, rows: [
  '..0000...........', // 24
  '.055550..........', // 25
  '05333350.........', // 26
  '022333350........', // 27
  '0122333350.......', // 28
  '01222333350......', // 29
  '.0122233350......', // 30
  '.01122233350.....', // 31
  '..01122333350....', // 32
  '...0122233330....', // 33
  '....0122233350...', // 34
  '....0112223330...', // 35
  '.....011222330...', // 36
  '......01232210...', // 37
  '......03332210...', // 38
  '.......0332210...', // 39
  '.......03322110..', // 40
  '.......03312110..', // 41
  '.......03331110..', // 42
  '.......03322110..', // 43
  '.......03322110..', // 44
  '.......03322210..', // 45
  '........0322210..', // 46
  '........0Qqqqr0..', // 47
  '........0111110..', // 48
  '........KSSsssK..', // 49
  '........KSssssskK', // 50
  '........KsssskkK.', // 51
  '.........KkkkKK..', // 52
  '..........KKK....', // 53
] };

// ---------------------------------------------------------------- frames

interface Pose {
  /** Neck, yoke, back, head and headphones shift down (the legs and the shadow stay on the ground). */
  body?: number;
  /** Extra head shift down, on top of body. */
  head?: number;
  /** Extra arm shift down, on top of body (slumped shoulders). */
  arms?: number;
  /** Far arm shift right (pulled in toward the body). */
  farDx?: number;
  headLayer?: Layer;
  yoke?: Layer;
  near?: Layer;
}

function frame(p: Pose = {}): Canvas {
  const body = p.body ?? 0;
  const arms = body + (p.arms ?? 0);
  const c = canvas(W, H);
  ellipse(c, SHADOW_X, SHADOW_Y, SHADOW_W, SHADOW_H, 'ink-1');
  draw(c, LEGS);
  draw(c, ARM_FAR, p.farDx ?? 0, arms);
  draw(c, NECK, 0, body);
  draw(c, p.yoke ?? YOKE, 0, body);
  draw(c, BACK, 0, body);
  draw(c, p.headLayer ?? HEAD, 0, body + (p.head ?? 0));
  draw(c, PHONES, 0, body);
  draw(c, p.near ?? ARM_NEAR, 0, arms);
  return c;
}

const frames = [
  frame(), // 0 idle
  frame({ body: 1, head: 1 }), // 1 idle: shoulders down 1, head nods 2
  frame({ near: ARM_REACH }), // 2 scratch: reach onto the record
  frame({ near: ARM_PUSH, head: 1 }), // 3 scratch: push it away
  frame({ near: ARM_PULL, head: 1 }), // 4 scratch: pull it back
  frame({ body: 2, head: 1, arms: 2, farDx: 1, headLayer: HEAD_DOWN, yoke: YOKE_DOWN, near: ARM_NEAR_DOWN }), // 5 down
];

export default {
  name: 'scratch-boy',
  frameWidth: W,
  frameHeight: H,
  frames,
  durations: [300, 300, 100, 90, 130, 400],
  tags: [
    { name: 'scratch-boy-idle', from: 0, to: 1 },
    { name: 'scratch-boy-scratch', from: 2, to: 4 },
    { name: 'scratch-boy-down', from: 5, to: 5 },
  ],
  source: 'hand-placed pixel layers (legs, arms, neck, yoke, back, head, headphones), stacked with offsets per frame',
} satisfies SpriteDef;
