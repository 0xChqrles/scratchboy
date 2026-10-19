// "A fighter loses the moment all its rigs are broken. The fight ends at once."
import { describe, expect, it } from 'vitest';
import type { Action, BattleState } from '../src/index.ts';
import { legalActions, step } from '../src/index.ts';
import { END, eventsOf, play, rigOf, sc, start, swap } from './fixtures.ts';

function expectOver(state: BattleState, actions: Action[]) {
  expect(legalActions(state, 0)).toEqual([]);
  expect(legalActions(state, 1)).toEqual([]);
  for (const action of actions) {
    expect(() => step(state, 0, action)).toThrow(Error);
    expect(() => step(state, 1, action)).toThrow(Error);
  }
}

describe('winning', () => {
  it('breaking the last rig wins at once: no turn end, nothing more to play', () => {
    const s = start({ rigs: ['vinyl/hh-strike'] }, { rigs: [{ deck: 'rig/techno-drum', hp: 5 }] });
    const r = play(s, sc(0, 1, { target: 0 }));
    expect(r.events.map((e) => e.type)).toEqual(['scratched', 'cooldown-started', 'hit', 'rig-broken', 'battle-won']);
    expect(eventsOf(r.events, 'battle-won')).toEqual([{ type: 'battle-won', side: 0 }]);
    expect(r.state.winner).toBe(0);
    expect(rigOf(r.state, 1, 0).hp).toBe(0);
    expectOver(r.state, [END, sc(0, 1, { target: 0 }), sc(0, 2, { target: 0 })]);
  });

  it('the opponent wins the same way', () => {
    const s = start({ rigs: [{ deck: 'vinyl/hh-strike', hp: 1 }] }, { rigs: ['rig/techno-drum'] });
    const r = play(s, END, sc(0, 1, { target: 0 }));
    expect(eventsOf(r.events, 'battle-won')).toEqual([{ type: 'battle-won', side: 1 }]);
    expect(r.events.at(-1)).toEqual({ type: 'battle-won', side: 1 });
    expect(r.state.winner).toBe(1);
    expectOver(r.state, [END, sc(0, 1, { target: 0 })]);
  });

  it("the rest of the winning move never happens", () => {
    // rm-slow level 3 = damage, then stun 1, then haste 1. The damage ends the fight.
    const s = start({ rigs: ['vinyl/rm-slow'] }, { rigs: [{ deck: 'rig/techno-drum', hp: 1 }] });
    const r = play(s, sc(0, 3, { target: 0 }));
    expect(r.events.map((e) => e.type)).toEqual(['scratched', 'cooldown-started', 'hit', 'rig-broken', 'battle-won']);
    expect(r.state.sides[0].hasteTurns).toBe(0);
    expect(rigOf(r.state, 1, 0).cooldown).toBe(0);
  });

  it('a move on every enemy rig that breaks them all wins once, after the last one breaks', () => {
    const s = start(
      { rigs: ['vinyl/hh-strike'] },
      { rigs: [{ deck: 'rig/techno-drum', hp: 1 }, { deck: 'rig/dub-bass', hp: 1 }] },
    );
    const r = play(s, sc(0, 3));
    expect(r.events).toEqual([
      { type: 'scratched', side: 0, rig: 0, level: 3, move: 'move/hh-strike-3' },
      { type: 'cooldown-started', side: 0, rig: 0, turns: 3 },
      { type: 'hit', side: 1, rig: 0, amount: expect.any(Number), hp: 0, effectiveness: 'strong' },
      { type: 'rig-broken', side: 1, rig: 0 },
      { type: 'hit', side: 1, rig: 1, amount: expect.any(Number), hp: 0, effectiveness: 'normal' },
      { type: 'rig-broken', side: 1, rig: 1 },
      { type: 'battle-won', side: 0 },
    ]);
  });

  it('a fighter with one working rig left has not lost', () => {
    const s = start(
      { rigs: ['vinyl/hh-strike', 'vinyl/dub-trap'], bag: ['vinyl/jz-guard'] },
      { rigs: [{ deck: 'rig/techno-drum', hp: 1 }, 'rig/dub-bass'] },
    );
    const r = play(s, sc(0, 1, { target: 0 }));
    expect(eventsOf(r.events, 'rig-broken')).toEqual([{ type: 'rig-broken', side: 1, rig: 0 }]);
    expect(r.state.winner).toBeNull();
    expect(legalActions(r.state, 0)).toContainEqual(swap(1, 'vinyl/jz-guard'));
  });
});
