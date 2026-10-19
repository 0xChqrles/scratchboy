// Root contracts 2 and 3: core is deterministic and its state is plain JSON. Plus the combat rules
// that must hold in every state of a fight, checked over whole fights.
import { describe, expect, it } from 'vitest';
import type { BattleEvent, BattleState, StepResult } from '../src/index.ts';
import { createBattle, eventsFor, legalActions, step, viewFor } from '../src/index.ts';
import { FIGHTS, type Played, otherSide, randomFight } from './fixtures.ts';

const json = (value: unknown) => JSON.stringify(value);

const runs: { name: string; played: Played[] }[] = FIGHTS.map((fight) => ({
  name: fight.name,
  played: randomFight(fight.setup, fight.pickSeed),
}));

describe('whole fights', () => {
  it.each(runs)('reach a winner: $name', ({ played }) => {
    expect(played.length).toBeGreaterThan(0);
    expect(played.at(-1)?.result.state.winner).not.toBeNull();
  });
});

describe('step is pure and deterministic', () => {
  it.each(runs)('never changes the state it is given: $name', ({ played }) => {
    for (const { state, side, action } of played) {
      const before = json(state);
      step(state, side, action);
      expect(json(state)).toBe(before);
    }
  });

  it.each(runs)('gives byte-identical output for the same state and action: $name', ({ played }) => {
    for (const { state, side, action, result } of played) {
      expect(json(step(state, side, action))).toBe(json(result));
    }
  });

  it.each(runs)('works the same on a JSON copy of the state: $name', ({ played }) => {
    for (const { state, side, action, result } of played) {
      const copy = JSON.parse(json(state)) as BattleState;
      expect(json(step(copy, side, action))).toBe(json(result));
    }
  });

  it.each(FIGHTS)('replays a whole fight byte-identically from its setup and actions: $name', (fight) => {
    const played = randomFight(fight.setup, fight.pickSeed);
    let state = createBattle(fight.setup).state;
    const log: BattleEvent[] = [];
    for (const { side, action } of played) {
      const result = step(state, side, action);
      log.push(...result.events);
      state = result.state;
    }
    expect(json(log)).toBe(json(played.flatMap((p) => p.result.events)));
    expect(json(state)).toBe(json(played.at(-1)?.result.state));
  });

  it('createBattle gives byte-identical output for the same setup', () => {
    for (const fight of FIGHTS) {
      expect(json(createBattle(fight.setup))).toBe(json(createBattle(fight.setup)));
    }
  });
});

describe('state is plain JSON', () => {
  function expectPlain(value: StepResult) {
    // toStrictEqual fails on undefined fields, class instances, Maps and functions, all of which a
    // JSON round trip would drop or change.
    expect(JSON.parse(json(value))).toStrictEqual(value);
  }

  it('survives a JSON round trip after createBattle and after every step', () => {
    for (const fight of FIGHTS) expectPlain(createBattle(fight.setup));
    for (const { played } of runs) for (const { result } of played) expectPlain(result);
  });
});

describe('rules that hold in every state', () => {
  function checkState(state: BattleState, setupArms: [number, number]) {
    for (const [index, fighter] of state.sides.entries()) {
      expect(fighter.hiddenTraps).toBe(0); // only views count hidden traps
      expect(fighter.slowTurns).toBeGreaterThanOrEqual(0);
      expect(fighter.hasteTurns).toBeGreaterThanOrEqual(0);
      expect(fighter.arms).toBe(setupArms[index]);
      for (const rig of fighter.rigs) {
        expect(Number.isInteger(rig.hp)).toBe(true);
        expect(rig.hp).toBeGreaterThanOrEqual(0);
        expect(rig.hp).toBeLessThanOrEqual(rig.maxHp);
        expect(Number.isInteger(rig.cooldown)).toBe(true);
        expect(rig.cooldown).toBeGreaterThanOrEqual(0);
        expect(rig.shield).toBeGreaterThanOrEqual(0);
        // A broken rig keeps its trap (see the hidden-trap check below), but nothing else.
        if (rig.hp === 0) expect(rig).toMatchObject({ cooldown: 0, shield: 0 });
      }
    }
    const beaten = state.sides.map((f) => f.rigs.every((r) => r.hp === 0));
    if (state.winner === null) {
      expect(beaten).toEqual([false, false]);
      // An interaction per arm: once every arm is used the turn has ended by itself.
      expect(state.turn.used.length).toBeLessThan(state.sides[state.turn.side].arms);
      expect(new Set(state.turn.used).size).toBe(state.turn.used.length);
    } else {
      expect(beaten[state.winner]).toBe(false);
      expect(beaten[state.winner === 0 ? 1 : 0]).toBe(true);
      expect(legalActions(state, 0)).toEqual([]);
      expect(legalActions(state, 1)).toEqual([]);
    }
  }

  it.each(runs)('$name', ({ played }) => {
    const first = played[0];
    if (!first) throw new Error('empty fight');
    const arms: [number, number] = [first.state.sides[0].arms, first.state.sides[1].arms];
    const vinyls = (s: BattleState) =>
      [...s.sides[0].rigs.map((r) => r.deck), ...s.sides[0].bag].sort();
    const ids = (s: BattleState) => s.sides.map((f) => f.rigs.map((r) => `${r.id}:${r.maxHp}`));

    checkState(first.state, arms);
    for (const { state, result } of played) {
      checkState(result.state, arms);
      // Swaps move vinyls between the turntables and the bag; none appear or vanish.
      expect(vinyls(result.state)).toEqual(vinyls(state));
      expect(ids(result.state)).toEqual(ids(state));

      for (const event of result.events) {
        if (event.type === 'hit' || event.type === 'blocked') expect(event.amount).toBeGreaterThan(0);
      }
      // The opponent sees that a trap was set, not where: the hidden-trap count each side sees
      // moves only with the trap-set and trap-fired events it is shown.
      for (const viewer of [0, 1] as const) {
        const owner = otherSide(viewer);
        const seen = eventsFor(result.events, viewer);
        const set = seen.filter((e) => e.type === 'trap-set' && e.side === owner).length;
        const fired = seen.filter((e) => e.type === 'trap-fired' && e.side === owner).length;
        const before = viewFor(state, viewer).sides[owner].hiddenTraps;
        expect(viewFor(result.state, viewer).sides[owner].hiddenTraps).toBe(before + set - fired);
      }
      const wins = result.events.filter((e) => e.type === 'battle-won');
      if (result.state.winner === null) {
        expect(wins).toEqual([]);
      } else if (state.winner === null) {
        // The fight ends at once: battle-won is the last event, and comes once.
        expect(wins).toEqual([{ type: 'battle-won', side: result.state.winner }]);
        expect(result.events.at(-1)).toEqual({ type: 'battle-won', side: result.state.winner });
      }
    }
  });
});
