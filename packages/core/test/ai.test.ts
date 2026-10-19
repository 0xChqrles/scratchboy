// The computer opponent (packages/core/AGENTS.md, "Hidden information and the computer opponent"):
// it plays a legal action, takes a kill when one is there, prefers among equal plans the one that
// still holds at the lowest spread, and decides from its view only.
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import type { BattleState, Level, SideIndex, Trap } from '../src/index.ts';
import { chooseAction, createBattle, legalActions, step, viewFor } from '../src/index.ts';
import { END, FIGHTS, canon, eventsOf, otherSide, patch, play, randomFight, sc, start, withSpread } from './fixtures.ts';

const states: BattleState[] = FIGHTS.flatMap((fight) =>
  randomFight(fight.setup, fight.pickSeed).map((p) => p.state),
);

describe('chooseAction plays by the rules', () => {
  it('returns one of the legal actions, in every state of whole fights', () => {
    for (const state of states) {
      const side = state.turn.side;
      const legal = legalActions(state, side).map(canon);
      expect(legal).toContain(canon(chooseAction(state, side)));
    }
  });

  it('never changes the state it is given, and gives the same answer twice', () => {
    for (const state of states.filter((_, i) => i % 3 === 0)) {
      const before = JSON.stringify(state);
      const one = chooseAction(state, state.turn.side);
      expect(JSON.stringify(state)).toBe(before);
      expect(chooseAction(state, state.turn.side)).toEqual(one);
    }
  });

  it('finishes a fight against itself', () => {
    const fight = FIGHTS[0];
    if (!fight) throw new Error('no fight');
    let state = createBattle(fight.setup).state;
    for (let i = 0; i < 1000 && state.winner === null; i++) {
      const side = state.turn.side;
      state = step(state, side, chooseAction(state, side)).state;
    }
    expect(state.winner).not.toBeNull();
  });
});

describe('chooseAction plays sensibly', () => {
  it('takes the kill that wins the fight', () => {
    // dub-bass: level 1 = 1 damage (enough), level 2 = stun every rig, level 3 = slow.
    const s = play(start({ rigs: [{ deck: 'vinyl/hh-strike', hp: 1 }] }, { rigs: ['rig/dub-bass'] }), END).state;
    const action = chooseAction(s, 1);
    expect(action).toEqual({ kind: 'scratch', rig: 0, level: 1, target: 0 });
    expect(step(s, 1, action).state.winner).toBe(1);
  });

  it('among plans that win at a 100% spread, plays the one that still wins at 90%', () => {
    // techno-snare on a rock-metal turntable (x1) at 10 HP: level 1 (10 damage) breaks it only at a
    // spread of 100% or more, level 3 (12 damage) even at 90%. Level 2 deals no damage.
    const s = play(start({ rigs: [{ deck: 'vinyl/rm-slow', hp: 10 }] }, { rigs: ['rig/techno-snare'] }), END).state;
    const wins = (pct: number, level: Level) => step(withSpread(s, pct), 1, sc(0, level, { target: 0 })).state.winner === 1;
    expect([wins(100, 1), wins(99, 1), wins(90, 3)]).toEqual([true, false, true]);
    expect(chooseAction(s, 1)).toEqual(sc(0, 3, { target: 0 }));
  });

  it('breaks a rig when it can', () => {
    // Every damage move of the techno drum breaks the 3-HP rig 1 if aimed at it.
    const s = play(
      start({ rigs: ['vinyl/hh-strike', { deck: 'vinyl/dub-trap', hp: 3 }] }, { rigs: ['rig/techno-drum'] }),
      END,
    ).state;
    const r = step(s, 1, chooseAction(s, 1));
    expect(eventsOf(r.events, 'rig-broken')).toEqual([{ type: 'rig-broken', side: 0, rig: 1 }]);
  });

  it('aims a single-target move at the rig its genre beats', () => {
    // Techno beats jazz-blues (x2); reggae-dub beats techno (x0.5).
    const s = play(start({ rigs: ['vinyl/dub-trap', 'vinyl/jz-guard'] }, { rigs: ['rig/techno-drum'] }), END).state;
    const action = chooseAction(s, 1);
    expect(action.kind).toBe('scratch');
    if (action.kind === 'scratch' && action.target !== undefined) expect(action.target).toBe(1);
  });

  it('does not end its turn when it can attack', () => {
    const s = start(
      { rigs: ['vinyl/hh-strike', 'vinyl/dub-trap'], bag: ['vinyl/jz-guard'] },
      { rigs: ['rig/techno-drum', 'rig/dub-bass'] },
    );
    expect(chooseAction(s, 0)).not.toEqual(END);
    const theirs = play(s, END).state;
    expect(chooseAction(theirs, 1)).not.toEqual(END);
  });
});

describe('chooseAction decides from its view', () => {
  /**
   * Two copies of `state` that differ only in what `side` may not see: where the other side's
   * traps are, what they do, and the generator. Both hold the same number of traps.
   */
  function hiddenVariants(state: BattleState, side: SideIndex): [BattleState, BattleState] | null {
    const other = otherSide(side);
    const working = state.sides[other].rigs.flatMap((rig, i) => (rig.hp > 0 ? [i] : []));
    if (working.length < 2) return null;
    const count = Math.min(Math.max(1, state.sides[other].rigs.filter((r) => r.trap !== null).length), working.length - 1);
    const place = (on: number[], trap: Trap, rng: number) =>
      patch(state, (d) => {
        d.rng = rng;
        d.sides[other].rigs.forEach((rig, i) => {
          rig.trap = on.includes(i) ? trap : null;
        });
      });
    return [
      place(working.slice(0, count), { payload: [{ kind: 'damage', amount: 50 }] }, 12345),
      place(working.slice(-count), { payload: [{ kind: 'stun', turns: 3 }, { kind: 'slow', turns: 2 }] }, 987654),
    ];
  }

  it("gives the same choice when only the other side's hidden traps and the generator differ", () => {
    let compared = 0;
    for (const state of states) {
      const side = state.turn.side;
      const variants = hiddenVariants(state, side);
      if (!variants) continue;
      const [a, b] = variants;
      expect(viewFor(a, side)).toEqual(viewFor(b, side));
      expect(chooseAction(a, side)).toEqual(chooseAction(b, side));
      compared++;
    }
    expect(compared).toBeGreaterThan(20);
  });

  it('does not dodge a trap it cannot see', () => {
    // Same fight, the only target with or without a trap on it: the choice cannot change.
    const s = play(
      start({ rigs: ['vinyl/hh-strike', 'vinyl/cl-wall'] }, { rigs: ['rig/techno-drum'] }),
      END,
    ).state;
    const variants = hiddenVariants(s, 1);
    if (!variants) throw new Error('need two working rigs');
    const [a, b] = variants;
    expect(chooseAction(a, 1)).toEqual(chooseAction(b, 1));
  });
});

describe('chooseAction is fast', () => {
  it('decides in under 50 ms with 4 rigs a side and a full bag', () => {
    const s = start(
      {
        rigs: ['vinyl/ws-raid', 'vinyl/hh-strike', 'vinyl/jz-guard', 'vinyl/dub-trap'],
        bag: ['vinyl/hh-combo', 'vinyl/rm-slow', 'vinyl/cl-wall', 'vinyl/pf-groove'],
      },
      { arms: 2, rigs: ['rig/techno-drum', 'rig/dub-bass', 'rig/techno-drum', 'rig/dub-bass'] },
    );
    const theirs = play(s, END).state;
    for (const [state, side] of [[s, 0], [theirs, 1]] as const) {
      chooseAction(state, side); // warm-up
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        chooseAction(state, side);
        times.push(performance.now() - t0);
      }
      times.sort((x, y) => x - y);
      expect(times[2], `median of ${times.map((t) => t.toFixed(1)).join(', ')} ms`).toBeLessThan(50);
    }
  });
});
