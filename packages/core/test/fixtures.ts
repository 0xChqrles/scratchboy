// Test vinyls and helpers for core's rule tests. Never the real catalogue: tuning a real vinyl must
// never break a rules test (root AGENTS.md, Testing).
//
// Genre cheat sheet for these decks (from src/genres.ts):
//   hip-hop (H) beats techno (T) and classical (C); rock-metal (R) and world-shamanic (W) beat H.
//   H vs jazz-blues (J) and H vs reggae-dub (D): x1. D beats T. R beats D. T vs R, T vs C: x1.
//   T beats J. W beats J; D beats W. pop-funk (P) beats D; J beats P.
//   Mix with H: J = good, T = good, H = good (same genre), P = good, R = clash, D = neutral,
//   W = neutral. R + D, J + D, J + C, J + W: neutral. W + P: clash.
//   The opponent rigs (T, D, R) mix neutrally with each other, so no test here depends on how the
//   mix rule treats opponent rigs.
import type {
  Action,
  BattleEvent,
  BattleSetup,
  BattleState,
  Deck,
  Effect,
  FighterSetup,
  Level,
  Move,
  PartnerBonus,
  SideIndex,
  StepResult,
} from '../src/index.ts';
import { DAMAGE_SPREAD_PCT, createBattle, legalActions, nextInt, seedRng, step } from '../src/index.ts';

function move(id: string, effects: Effect[], partner?: PartnerBonus): Move {
  return partner ? { id, effects, partner } : { id, effects };
}

export const DECKS: Record<string, Deck> = {
  // Plain damage at every level; level 3 hits every enemy rig.
  'vinyl/hh-strike': {
    id: 'vinyl/hh-strike',
    genre: 'hip-hop',
    artist: 'artist/mc-one',
    defender: false,
    moves: [
      move('move/hh-strike-1', [{ kind: 'damage', amount: 10, to: 'enemy' }]),
      move('move/hh-strike-2', [{ kind: 'damage', amount: 20, to: 'enemy' }]),
      move('move/hh-strike-3', [{ kind: 'damage', amount: 12, to: 'enemies' }]),
    ],
  },
  // Partner bonuses of both kinds, and a stun + slow move.
  'vinyl/hh-combo': {
    id: 'vinyl/hh-combo',
    genre: 'hip-hop',
    artist: 'artist/mc-two',
    defender: false,
    moves: [
      move('move/hh-combo-1', [{ kind: 'damage', amount: 10, to: 'enemy' }], {
        with: { genre: 'jazz-blues' },
        bonus: { kind: 'damage', amount: 6 },
      }),
      move('move/hh-combo-2', [{ kind: 'damage', amount: 10, to: 'enemy' }], {
        with: { artist: 'artist/dub-one' },
        bonus: { kind: 'cooldown' },
      }),
      move('move/hh-combo-3', [
        { kind: 'stun', turns: 2, to: 'enemy' },
        { kind: 'slow', turns: 1 },
      ]),
    ],
  },
  // Shields (one rig, every rig) and haste.
  'vinyl/jz-guard': {
    id: 'vinyl/jz-guard',
    genre: 'jazz-blues',
    artist: 'artist/jazz-one',
    defender: false,
    moves: [
      move('move/jz-guard-1', [{ kind: 'shield', amount: 8, to: 'ally' }]),
      move('move/jz-guard-2', [{ kind: 'shield', amount: 5, to: 'allies' }]),
      move('move/jz-guard-3', [{ kind: 'haste', turns: 2 }]),
    ],
  },
  // One trap per payload kind.
  'vinyl/dub-trap': {
    id: 'vinyl/dub-trap',
    genre: 'reggae-dub',
    artist: 'artist/dub-one',
    defender: false,
    moves: [
      move('move/dub-trap-1', [{ kind: 'trap', payload: [{ kind: 'damage', amount: 10 }] }]),
      move('move/dub-trap-2', [{ kind: 'trap', payload: [{ kind: 'stun', turns: 2 }] }]),
      move('move/dub-trap-3', [{ kind: 'trap', payload: [{ kind: 'slow', turns: 2 }] }]),
    ],
  },
  // Slow, and a move whose effects come after its damage.
  'vinyl/rm-slow': {
    id: 'vinyl/rm-slow',
    genre: 'rock-metal',
    artist: 'artist/metal-one',
    defender: false,
    moves: [
      move('move/rm-slow-1', [{ kind: 'damage', amount: 10, to: 'enemy' }]),
      move('move/rm-slow-2', [{ kind: 'slow', turns: 2 }]),
      move('move/rm-slow-3', [
        { kind: 'damage', amount: 10, to: 'enemy' },
        { kind: 'stun', turns: 1, to: 'enemy' },
        { kind: 'haste', turns: 1 },
      ]),
    ],
  },
  // A defender vinyl.
  'vinyl/cl-wall': {
    id: 'vinyl/cl-wall',
    genre: 'classical',
    artist: 'artist/classic-one',
    defender: true,
    moves: [
      move('move/cl-wall-1', [{ kind: 'shield', amount: 10, to: 'ally' }]),
      move('move/cl-wall-2', [{ kind: 'damage', amount: 10, to: 'enemy' }]),
      move('move/cl-wall-3', [{ kind: 'damage', amount: 10, to: 'enemies' }]),
    ],
  },
  // Moves that need both a target and an ally.
  'vinyl/ws-raid': {
    id: 'vinyl/ws-raid',
    genre: 'world-shamanic',
    artist: 'artist/shaman-one',
    defender: false,
    moves: [
      move('move/ws-raid-1', [
        { kind: 'damage', amount: 8, to: 'enemy' },
        { kind: 'shield', amount: 4, to: 'ally' },
      ]),
      move('move/ws-raid-2', [
        { kind: 'stun', turns: 1, to: 'enemy' },
        { kind: 'trap', payload: [{ kind: 'damage', amount: 6 }] },
      ]),
      move('move/ws-raid-3', [
        { kind: 'damage', amount: 6, to: 'enemies' },
        { kind: 'shield', amount: 3, to: 'allies' },
      ]),
    ],
  },
  // Haste with a shield, and slow with damage on every enemy rig.
  'vinyl/pf-groove': {
    id: 'vinyl/pf-groove',
    genre: 'pop-funk',
    artist: 'artist/funk-one',
    defender: false,
    moves: [
      move('move/pf-groove-1', [{ kind: 'damage', amount: 10, to: 'enemy' }]),
      move('move/pf-groove-2', [
        { kind: 'haste', turns: 1 },
        { kind: 'shield', amount: 6, to: 'ally' },
      ]),
      move('move/pf-groove-3', [
        { kind: 'slow', turns: 1 },
        { kind: 'damage', amount: 8, to: 'enemies' },
      ]),
    ],
  },
  // Opponent rigs: they carry their own moves and never swap.
  'rig/techno-drum': {
    id: 'rig/techno-drum',
    genre: 'techno',
    defender: false,
    moves: [
      move('move/techno-drum-1', [{ kind: 'damage', amount: 10, to: 'enemy' }]),
      move('move/techno-drum-2', [{ kind: 'damage', amount: 20, to: 'enemy' }]),
      move('move/techno-drum-3', [{ kind: 'damage', amount: 12, to: 'enemies' }]),
    ],
  },
  'rig/dub-bass': {
    id: 'rig/dub-bass',
    genre: 'reggae-dub',
    defender: false,
    moves: [
      move('move/dub-bass-1', [{ kind: 'damage', amount: 1, to: 'enemy' }]),
      move('move/dub-bass-2', [{ kind: 'stun', turns: 1, to: 'enemies' }]),
      move('move/dub-bass-3', [{ kind: 'slow', turns: 2 }]),
    ],
  },
  // Level 3 hits one rig harder than level 1; level 2 deals no damage.
  'rig/techno-snare': {
    id: 'rig/techno-snare',
    genre: 'techno',
    defender: false,
    moves: [
      move('move/techno-snare-1', [{ kind: 'damage', amount: 10, to: 'enemy' }]),
      move('move/techno-snare-2', [{ kind: 'haste', turns: 1 }]),
      move('move/techno-snare-3', [{ kind: 'damage', amount: 12, to: 'enemy' }]),
    ],
  },
  // A defender opponent rig.
  'rig/metal-wall': {
    id: 'rig/metal-wall',
    genre: 'rock-metal',
    defender: true,
    moves: [
      move('move/metal-wall-1', [{ kind: 'shield', amount: 10, to: 'allies' }]),
      move('move/metal-wall-2', [{ kind: 'damage', amount: 10, to: 'enemy' }]),
      move('move/metal-wall-3', [{ kind: 'damage', amount: 10, to: 'enemies' }]),
    ],
  },
};

export const HP = 100;

export type RigOpt = string | { deck: string; hp: number };

export interface SideOpts {
  arms?: number;
  initiative?: number;
  rigs: RigOpt[];
  bag?: string[];
}

function fighter(index: SideIndex, opts: SideOpts): FighterSetup {
  const prefix = index === 0 ? 'turntable' : 'rig';
  return {
    id: index === 0 ? 'fighter/scratch-boy' : 'opponent/test',
    arms: opts.arms ?? (index === 0 ? 2 : 1),
    initiative: opts.initiative ?? (index === 0 ? 10 : 5),
    rigs: opts.rigs.map((rig, i) => ({
      id: `${prefix}/${i + 1}`,
      deck: typeof rig === 'string' ? rig : rig.deck,
      hp: typeof rig === 'string' ? HP : rig.hp,
    })),
    bag: opts.bag ?? [],
  };
}

/** Side 0 is Scratch Boy (2 arms, initiative 10); side 1 an opponent (1 arm, initiative 5). */
export function setupOf(a: SideOpts, b: SideOpts, seed = 1): BattleSetup {
  return { seed, decks: DECKS, sides: [fighter(0, a), fighter(1, b)] };
}

/** A started fight. With the default initiatives, side 0 plays turn 1. */
export function start(a: SideOpts, b: SideOpts, seed = 1): BattleState {
  return createBattle(setupOf(a, b, seed)).state;
}

export const END: Action = { kind: 'end' };

export function sc(rig: number, level: Level, extra: { target?: number; ally?: number } = {}): Action {
  return { kind: 'scratch', rig, level, ...extra };
}

export function swap(rig: number, vinyl: string): Action {
  return { kind: 'swap', rig, vinyl };
}

/** The side whose turn it is plays `action`. */
export function act(state: BattleState, action: Action): StepResult {
  return step(state, state.turn.side, action);
}

/** Plays several actions in a row (each by the side whose turn it is). Returns every event. */
export function play(state: BattleState, ...actions: Action[]): StepResult {
  let current = state;
  const events: BattleEvent[] = [];
  for (const action of actions) {
    const result = act(current, action);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/** A deep copy of `state` changed by `fn`. Battle state is plain JSON, so this is a real state. */
export function patch(state: BattleState, fn: (draft: BattleState) => void): BattleState {
  const draft = JSON.parse(JSON.stringify(state)) as BattleState;
  fn(draft);
  return draft;
}

/** Marks a rig broken the way the engine leaves it: 0 HP, no cooldown or shield. A trap on it stays
 *  (it can never go off, and removing it would show the other side where it was). */
export function broken(state: BattleState, side: SideIndex, rig: number): BattleState {
  return patch(state, (s) => {
    const r = s.sides[side].rigs[rig];
    if (!r) throw new Error(`no rig ${rig}`);
    r.hp = 0;
    r.cooldown = 0;
    r.shield = 0;
  });
}

export function rigOf(state: BattleState, side: SideIndex, rig: number) {
  const r = state.sides[side].rigs[rig];
  if (!r) throw new Error(`no rig ${rig} on side ${side}`);
  return r;
}

/** The spread percent the next damage draw from `rng` gives. */
export function spreadAt(rng: number): number {
  return nextInt(rng, 100 - DAMAGE_SPREAD_PCT, 100 + DAMAGE_SPREAD_PCT).value;
}

/** A generator state whose next damage draw is exactly `pct` percent. */
export function rngForSpread(pct: number): number {
  for (let rng = 1; rng < 1_000_000; rng++) {
    if (spreadAt(rng) === pct) return rng;
  }
  throw new Error(`no rng gives a ${pct}% spread`);
}

/** Sets the generator so the next damage draw is exactly `pct` percent. */
export function withSpread(state: BattleState, pct: number): BattleState {
  return patch(state, (s) => {
    s.rng = rngForSpread(pct);
  });
}

export type EventOf<T extends BattleEvent['type']> = Extract<BattleEvent, { type: T }>;

export function eventsOf<T extends BattleEvent['type']>(events: BattleEvent[], type: T): EventOf<T>[] {
  return events.filter((e): e is EventOf<T> => e.type === type);
}

/** Action as a key-order-independent string, to compare actions. */
export function canon(action: Action): string {
  const entries = Object.entries(action).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(Object.fromEntries(entries));
}

export function otherSide(side: SideIndex): SideIndex {
  return side === 0 ? 1 : 0;
}

// --- Whole fights, for checks that must hold in every state ---

/** One step of a fight: the state before, who acted, what they did, and what came out. */
export interface Played {
  state: BattleState;
  side: SideIndex;
  action: Action;
  result: StepResult;
}

/**
 * A fight where each side plays a legal action picked at random with its own seeded generator
 * (not the fight's), until someone wins or `maxSteps` actions were played.
 */
export function randomFight(setup: BattleSetup, pickSeed: number, maxSteps = 400): Played[] {
  let state = createBattle(setup).state;
  let pick = seedRng(pickSeed);
  const played: Played[] = [];
  while (state.winner === null && played.length < maxSteps) {
    const side = state.turn.side;
    const actions = legalActions(state, side);
    const drawn = nextInt(pick, 0, actions.length - 1);
    pick = drawn.rng;
    const action = actions[drawn.value];
    if (!action) throw new Error('legalActions returned nothing for the side to play');
    const result = step(state, side, action);
    played.push({ state, side, action, result });
    state = result.state;
  }
  return played;
}

const low = (deck: string): RigOpt => ({ deck, hp: 30 });

/** Varied fights at low HP, so random play reaches the end: bags, traps, defenders, both starters. */
export const FIGHTS: { name: string; setup: BattleSetup; pickSeed: number }[] = [
  {
    name: '2 turntables and a bag vs 2 rigs with a defender, 2 arms',
    setup: setupOf(
      {
        rigs: [low('vinyl/hh-strike'), low('vinyl/dub-trap')],
        bag: ['vinyl/jz-guard', 'vinyl/rm-slow', 'vinyl/cl-wall', 'vinyl/ws-raid'],
      },
      { arms: 2, rigs: [low('rig/techno-drum'), low('rig/metal-wall')] },
      11,
    ),
    pickSeed: 3,
  },
  {
    name: '3 turntables vs 3 rigs, initiative tie',
    setup: setupOf(
      {
        initiative: 7,
        rigs: [low('vinyl/hh-combo'), low('vinyl/ws-raid'), low('vinyl/cl-wall')],
        bag: ['vinyl/pf-groove'],
      },
      { initiative: 7, rigs: [low('rig/dub-bass'), low('rig/techno-drum'), low('rig/metal-wall')] },
      5,
    ),
    pickSeed: 8,
  },
  {
    name: '4 turntables and a full bag vs 3 rigs, opponent first',
    setup: setupOf(
      {
        rigs: [low('vinyl/hh-strike'), low('vinyl/jz-guard'), low('vinyl/dub-trap'), low('vinyl/rm-slow')],
        bag: ['vinyl/hh-combo', 'vinyl/cl-wall', 'vinyl/ws-raid', 'vinyl/pf-groove'],
      },
      { arms: 2, initiative: 12, rigs: [low('rig/techno-drum'), low('rig/dub-bass'), low('rig/metal-wall')] },
      99,
    ),
    pickSeed: 21,
  },
  {
    name: '1 turntable vs 1 rig',
    setup: setupOf({ rigs: [low('vinyl/ws-raid')], bag: ['vinyl/dub-trap'] }, { rigs: [low('rig/dub-bass')] }, 4),
    pickSeed: 1,
  },
];
