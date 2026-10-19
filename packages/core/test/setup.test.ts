import { describe, expect, it } from 'vitest';
import type { BattleSetup, Deck } from '../src/index.ts';
import { BAG_MAX, MAX_RIGS, createBattle } from '../src/index.ts';
import { DECKS, eventsOf, setupOf } from './fixtures.ts';

const A = { rigs: ['vinyl/hh-strike', 'vinyl/jz-guard'] };
const B = { rigs: ['rig/techno-drum'] };

describe('createBattle checks the setup', () => {
  it('accepts a valid setup', () => {
    expect(() => createBattle(setupOf(A, B))).not.toThrow();
  });

  it('refuses a fighter with no rig', () => {
    expect(() => createBattle(setupOf({ rigs: [] }, B))).toThrow(Error);
  });

  it(`accepts ${MAX_RIGS} rigs and refuses more`, () => {
    const four = ['vinyl/hh-strike', 'vinyl/hh-combo', 'vinyl/jz-guard', 'vinyl/dub-trap'];
    expect(() => createBattle(setupOf({ rigs: four }, B))).not.toThrow();
    expect(() => createBattle(setupOf({ rigs: [...four, 'vinyl/rm-slow'] }, B))).toThrow(Error);
  });

  it('refuses a rig deck that does not exist', () => {
    expect(() => createBattle(setupOf({ rigs: ['vinyl/nope'] }, B))).toThrow(Error);
  });

  it('refuses a bag vinyl that does not exist', () => {
    expect(() => createBattle(setupOf({ ...A, bag: ['vinyl/nope'] }, B))).toThrow(Error);
  });

  it('refuses a deck without its 3 levels', () => {
    const short = {
      ...DECKS['rig/techno-drum'],
      id: 'rig/short',
      moves: DECKS['rig/techno-drum']?.moves.slice(0, 2),
    } as unknown as Deck;
    const setup: BattleSetup = {
      ...setupOf(A, { rigs: ['rig/short'] }),
      decks: { ...DECKS, 'rig/short': short },
    };
    expect(() => createBattle(setup)).toThrow(Error);
  });

  it(`counts loaded vinyls in the bag limit of ${BAG_MAX}`, () => {
    const base = DECKS['vinyl/hh-strike'];
    if (!base) throw new Error('missing fixture');
    const extras = Array.from({ length: BAG_MAX }, (_, i) => ({ ...base, id: `vinyl/extra-${i + 1}` }));
    const decks = { ...DECKS, ...Object.fromEntries(extras.map((d) => [d.id, d])) };
    const withBag = (n: number): BattleSetup => ({
      ...setupOf({ ...A, bag: extras.slice(0, n).map((d) => d.id) }, B),
      decks,
    });
    // 2 loaded + 6 in the bag = 8: allowed. 2 + 7 = 9: refused.
    expect(() => createBattle(withBag(BAG_MAX - 2))).not.toThrow();
    expect(() => createBattle(withBag(BAG_MAX - 1))).toThrow(Error);
  });

  it('does not change the setup it is given', () => {
    const setup = setupOf(A, B);
    const before = JSON.stringify(setup);
    createBattle(setup);
    expect(JSON.stringify(setup)).toBe(before);
  });
});

describe('the start of the fight', () => {
  it('emits battle-started, then starts the first turn', () => {
    const { state, events } = createBattle(setupOf(A, B));
    expect(events[0]).toEqual({ type: 'battle-started', first: 0 });
    expect(events[1]).toEqual({ type: 'turn-started', side: 0, turn: 1 });
    expect(state.turn).toEqual({ number: 1, side: 0, used: [], slowed: false, hasted: false });
    expect(state.winner).toBeNull();
  });

  it('builds every rig at full HP, ready, with no shield or trap', () => {
    const { state } = createBattle(setupOf(A, B));
    for (const fighter of state.sides) {
      expect(fighter.slowTurns).toBe(0);
      expect(fighter.hasteTurns).toBe(0);
      expect(fighter.hiddenTraps).toBe(0);
      for (const rig of fighter.rigs) {
        expect(rig.hp).toBe(rig.maxHp);
        expect(rig.cooldown).toBe(0);
        expect(rig.shield).toBe(0);
        expect(rig.trap).toBeNull();
      }
    }
    expect(state.sides[0].rigs.map((r) => r.deck)).toEqual(A.rigs);
  });

  it('gives the first turn to the higher initiative, whatever the seed', () => {
    for (let seed = 0; seed < 30; seed++) {
      const low = createBattle(setupOf({ ...A, initiative: 3 }, { ...B, initiative: 9 }, seed));
      expect(low.events[0]).toEqual({ type: 'battle-started', first: 1 });
      expect(low.state.turn.side).toBe(1);
      const high = createBattle(setupOf({ ...A, initiative: 9 }, { ...B, initiative: 3 }, seed));
      expect(high.events[0]).toEqual({ type: 'battle-started', first: 0 });
      expect(high.state.turn.side).toBe(0);
    }
  });

  it('settles an initiative tie with a coin flip from the seed', () => {
    const firsts = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      const setup = setupOf({ ...A, initiative: 7 }, { ...B, initiative: 7 }, seed);
      const one = createBattle(setup);
      const two = createBattle(setup);
      expect(JSON.stringify(two)).toBe(JSON.stringify(one));
      const started = eventsOf(one.events, 'battle-started')[0];
      expect(started).toBeDefined();
      expect(one.state.turn.side).toBe(started?.first);
      firsts.add(one.state.turn.side);
    }
    expect([...firsts].sort()).toEqual([0, 1]);
  });
});
