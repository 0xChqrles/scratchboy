// legalActions lists exactly what the rules allow, in the documented order, and step refuses
// everything else. The expected list is built here from the written rules (packages/core/AGENTS.md
// "Turns", "Targeting", "Move kinds" and the engine spec), never from the engine.
import { describe, expect, it } from 'vitest';
import type { Action, BattleState, Level, Move, SideIndex } from '../src/index.ts';
import { legalActions, step } from '../src/index.ts';
import {
  END,
  FIGHTS,
  broken,
  canon,
  otherSide,
  patch,
  randomFight,
  rigOf,
  sc,
  start,
  swap,
} from './fixtures.ts';

/** What a move needs: a target iff it has an 'enemy' effect, an ally iff an 'ally' shield or a trap. */
function needs(move: Move): { target: boolean; ally: boolean; trap: boolean } {
  const target = move.effects.some((e) => (e.kind === 'damage' || e.kind === 'stun') && e.to === 'enemy');
  const shieldAlly = move.effects.some((e) => e.kind === 'shield' && e.to === 'ally');
  const trap = move.effects.some((e) => e.kind === 'trap');
  return { target, ally: shieldAlly || trap, trap };
}

function scratchOf(rig: number, level: Level, target: number | undefined, ally: number | undefined): Action {
  return {
    kind: 'scratch',
    rig,
    level,
    ...(target === undefined ? {} : { target }),
    ...(ally === undefined ? {} : { ally }),
  };
}

/**
 * The legal actions by the rules, in the documented order: scratches by rig, level, target, ally;
 * then swaps by rig and bag order; then end. `unsure` holds the actions the rules leave open (a
 * single-rig shield on a broken rig of one's own), which the comparison skips.
 */
function ruleActions(state: BattleState, side: SideIndex): { sure: Action[]; unsure: Set<string> } {
  const sure: Action[] = [];
  const unsure = new Set<string>();
  if (state.winner !== null || state.turn.side !== side) return { sure, unsure };
  const me = state.sides[side];
  const deckOf = (id: string) => {
    const deck = state.decks[id];
    if (!deck) throw new Error(`no deck ${id}`);
    return deck;
  };
  const foeWorking = state.sides[otherSide(side)].rigs.flatMap((rig, i) => (rig.hp > 0 ? [i] : []));
  const defenders = foeWorking.filter((i) => deckOf(rigOf(state, otherSide(side), i).deck).defender);
  const targets = defenders.length > 0 ? defenders : foeWorking;
  const ready =
    state.turn.used.length < me.arms
      ? me.rigs.flatMap((rig, i) => (rig.hp > 0 && rig.cooldown === 0 && !state.turn.used.includes(i) ? [i] : []))
      : [];

  for (const i of ready) {
    deckOf(rigOf(state, side, i).deck).moves.forEach((move, m) => {
      const level = (m + 1) as Level;
      const need = needs(move);
      for (const target of need.target ? targets : [undefined]) {
        for (const ally of need.ally ? me.rigs.map((_, j) => j) : [undefined]) {
          const action = scratchOf(i, level, target, ally);
          if (ally !== undefined) {
            const rig = rigOf(state, side, ally);
            if (need.trap && (rig.hp <= 0 || rig.trap !== null)) continue;
            if (rig.hp <= 0) {
              unsure.add(canon(action));
              continue;
            }
          }
          sure.push(action);
        }
      }
    });
  }
  if (me.bag.length > 0) {
    for (const i of ready) for (const vinyl of me.bag) sure.push(swap(i, vinyl));
  }
  sure.push(END);
  return { sure, unsure };
}

function expectRuleActions(state: BattleState, side: SideIndex) {
  const { sure, unsure } = ruleActions(state, side);
  const got = legalActions(state, side)
    .map(canon)
    .filter((key) => !unsure.has(key));
  expect(got).toEqual(sure.map(canon));
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Every action shape near the legal ones: bad rigs, levels, targets, allies, extra or missing fields. */
function candidates(state: BattleState, side: SideIndex): Action[] {
  const own = state.sides[side].rigs.length;
  const foe = state.sides[otherSide(side)].rigs.length;
  const rigs = range(-1, own);
  const targets = [undefined, ...range(-1, foe), 0.5];
  const allies = [undefined, ...range(-1, own)];
  const out: Action[] = [];
  for (const rig of rigs) {
    for (const level of [0, 1, 2, 3, 4]) {
      for (const target of targets) {
        for (const ally of allies) out.push(scratchOf(rig, level as Level, target, ally));
      }
    }
  }
  const vinyls = [...Object.keys(state.decks), 'vinyl/nope'];
  for (const rig of rigs) for (const vinyl of vinyls) out.push(swap(rig, vinyl));
  out.push(END);
  return out;
}

describe('legalActions follows the rules', () => {
  it('lists every scratch, swap and end in the documented order', () => {
    const s = start(
      { rigs: ['vinyl/hh-strike', 'vinyl/ws-raid'], bag: ['vinyl/jz-guard', 'vinyl/rm-slow'] },
      { rigs: ['rig/techno-drum', 'rig/dub-bass'] },
    );
    expect(legalActions(s, 0)).toEqual([
      sc(0, 1, { target: 0 }),
      sc(0, 1, { target: 1 }),
      sc(0, 2, { target: 0 }),
      sc(0, 2, { target: 1 }),
      sc(0, 3),
      sc(1, 1, { target: 0, ally: 0 }),
      sc(1, 1, { target: 0, ally: 1 }),
      sc(1, 1, { target: 1, ally: 0 }),
      sc(1, 1, { target: 1, ally: 1 }),
      sc(1, 2, { target: 0, ally: 0 }),
      sc(1, 2, { target: 0, ally: 1 }),
      sc(1, 2, { target: 1, ally: 0 }),
      sc(1, 2, { target: 1, ally: 1 }),
      sc(1, 3),
      swap(0, 'vinyl/jz-guard'),
      swap(0, 'vinyl/rm-slow'),
      swap(1, 'vinyl/jz-guard'),
      swap(1, 'vinyl/rm-slow'),
      END,
    ]);
    expect(legalActions(s, 1)).toEqual([]);
  });

  it('skips a trapped turntable as a trap ally, and broken rigs as targets', () => {
    let s = start(
      { rigs: ['vinyl/hh-strike', 'vinyl/ws-raid'] },
      { rigs: ['rig/techno-drum', 'rig/dub-bass'] },
    );
    s = patch(broken(s, 1, 0), (d) => {
      const rig = d.sides[0].rigs[0];
      if (rig) rig.trap = { payload: [{ kind: 'damage', amount: 1 }] };
    });
    expect(legalActions(s, 0).filter((a) => a.kind === 'scratch' && a.rig === 1)).toEqual([
      sc(1, 1, { target: 1, ally: 0 }),
      sc(1, 1, { target: 1, ally: 1 }),
      sc(1, 2, { target: 1, ally: 1 }),
      sc(1, 3),
    ]);
  });

  it('matches the rules in every state of whole fights', () => {
    for (const fight of FIGHTS) {
      for (const { state, result } of randomFight(fight.setup, fight.pickSeed)) {
        for (const s of [state, result.state]) {
          expectRuleActions(s, 0);
          expectRuleActions(s, 1);
        }
      }
    }
  });

  it('always leaves the side to play an interaction while the fight is on', () => {
    // With nothing ready the turn ends by itself, so a live state always offers more than 'end'.
    for (const fight of FIGHTS) {
      for (const { state } of randomFight(fight.setup, fight.pickSeed)) {
        expect(legalActions(state, state.turn.side).some((a) => a.kind !== 'end')).toBe(true);
      }
    }
  });
});

describe('step refuses every action legalActions does not list', () => {
  const cases: [string, Action][] = [
    ['a target on a move that hits every enemy rig', sc(0, 3, { target: 0 })],
    ['an ally on a move with no single-rig shield or trap', sc(0, 1, { target: 0, ally: 0 })],
    ['a missing target', sc(0, 1)],
    ['a target that is not a rig', sc(0, 1, { target: 2 })],
    ['a negative target', sc(0, 1, { target: -1 })],
    ['a fractional target', sc(0, 1, { target: 0.5 })],
    ['a missing ally', sc(1, 1, { target: 0 })],
    ['a missing target on a move that needs both', sc(1, 1, { ally: 0 })],
    ['an ally that is not a rig', sc(1, 1, { target: 0, ally: 3 })],
    ['a target on a move with no enemy effect', sc(2, 3, { target: 0 })],
    ['an ally on a shield for every own rig', sc(2, 2, { ally: 0 })],
    ['level 0', { kind: 'scratch', rig: 0, level: 0 as Level, target: 0 }],
    ['level 4', { kind: 'scratch', rig: 0, level: 4 as Level, target: 0 }],
    ['a rig that does not exist', sc(3, 1, { target: 0 })],
    ['a swap with an empty bag', swap(0, 'vinyl/jz-guard')],
    ['an unknown kind', { kind: 'dance' } as unknown as Action],
  ];
  const s = start(
    { rigs: ['vinyl/hh-strike', 'vinyl/ws-raid', 'vinyl/jz-guard'] },
    { rigs: ['rig/techno-drum', 'rig/dub-bass'] },
  );

  it.each(cases)('refuses %s', (_, action) => {
    expect(legalActions(s, 0).map(canon)).not.toContain(canon(action));
    expect(() => step(s, 0, action)).toThrow(Error);
  });

  it('accepts exactly the listed actions, in every state of whole fights', () => {
    for (const fight of FIGHTS) {
      randomFight(fight.setup, fight.pickSeed).forEach(({ state, side }, n) => {
        if (n % 4 !== 0) return;
        const legal = new Set(legalActions(state, side).map(canon));
        for (const action of candidates(state, side)) {
          if (legal.has(canon(action))) expect(() => step(state, side, action)).not.toThrow();
          else expect(() => step(state, side, action), canon(action)).toThrow(Error);
        }
        for (const action of candidates(state, otherSide(side))) {
          expect(() => step(state, otherSide(side), action)).toThrow(Error);
        }
      });
    }
  });
});
