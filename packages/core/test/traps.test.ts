import { describe, expect, it } from 'vitest';
import type { BattleState, SideIndex, Trap } from '../src/index.ts';
import { eventsFor, legalActions, step, viewFor } from '../src/index.ts';
import { END, broken, eventsOf, patch, play, rigOf, sc, start, withSpread } from './fixtures.ts';

const DAMAGE_TRAP: Trap = { payload: [{ kind: 'damage', amount: 10 }] };

function withTrap(state: BattleState, side: SideIndex, rig: number, trap: Trap = DAMAGE_TRAP): BattleState {
  return patch(state, (d) => {
    const r = d.sides[side].rigs[rig];
    if (!r) throw new Error('no rig');
    r.trap = trap;
  });
}

// Side 0: dub-trap (sets traps) + hh-strike, a neutral mix. Side 1: one techno rig, one arm.
const fresh = (opponent: string[] = ['rig/techno-drum']) =>
  start({ rigs: ['vinyl/dub-trap', 'vinyl/hh-strike'] }, { rigs: opponent });

describe('setting a trap', () => {
  it('sets it on the chosen working turntable, which can differ from the one that scratched', () => {
    const r = play(fresh(), sc(0, 1, { ally: 1 }));
    expect(eventsOf(r.events, 'trap-set')).toEqual([{ type: 'trap-set', side: 0, rig: 1 }]);
    expect(rigOf(r.state, 0, 1).trap).toEqual(DAMAGE_TRAP);
    expect(rigOf(r.state, 0, 0).trap).toBeNull();
    expect(r.state.sides[0].hiddenTraps).toBe(0); // only views count hidden traps

    const self = play(fresh(), sc(0, 2, { ally: 0 }));
    expect(rigOf(self.state, 0, 0).trap).toEqual({ payload: [{ kind: 'stun', turns: 2 }] });
  });

  it('allows one trap per turntable, and only on a working one', () => {
    const trapped = withTrap(fresh(), 0, 1);
    const allies = legalActions(trapped, 0).flatMap((a) => (a.kind === 'scratch' && a.rig === 0 ? [a.ally] : []));
    expect(new Set(allies)).toEqual(new Set([0]));
    expect(() => step(trapped, 0, sc(0, 1, { ally: 1 }))).toThrow(Error);

    const dead = broken(fresh(), 0, 1);
    expect(() => step(dead, 0, sc(0, 1, { ally: 1 }))).toThrow(Error);
    expect(() => step(fresh(), 0, sc(0, 1, { ally: 2 }))).toThrow(Error);
    expect(() => step(fresh(), 0, sc(0, 1))).toThrow(Error);
  });
});

describe('what each side may see', () => {
  it('viewFor hides the other side traps and the generator, and says how many traps were set', () => {
    const s = play(fresh(), sc(0, 1, { ally: 1 })).state;
    const before = JSON.stringify(s);

    const theirs = viewFor(s, 1);
    expect(theirs.rng).toBe(0);
    expect(theirs.sides[0].rigs.map((r) => r.trap)).toEqual([null, null]);
    expect(theirs.sides[0].hiddenTraps).toBe(1);
    expect(theirs.sides[1]).toEqual(s.sides[1]);

    const mine = viewFor(s, 0);
    expect(mine.rng).toBe(0);
    expect(rigOf(mine, 0, 1).trap).toEqual(DAMAGE_TRAP);
    expect(mine.sides[0]).toEqual(s.sides[0]);
    expect(mine.sides[1].hiddenTraps).toBe(0);

    // Nothing else is hidden.
    for (const view of [theirs, mine]) {
      expect(view.turn).toEqual(s.turn);
      expect(view.decks).toEqual(s.decks);
      expect(view.winner).toBe(s.winner);
    }
    expect(JSON.stringify(s)).toBe(before);
  });

  it("viewFor hides an opponent's traps from Scratch Boy too", () => {
    const s = withTrap(fresh(['rig/techno-drum', 'rig/dub-bass']), 1, 1);
    const view = viewFor(s, 0);
    expect(view.sides[1].rigs.map((r) => r.trap)).toEqual([null, null]);
    expect(view.sides[1].hiddenTraps).toBe(1);
  });

  it('a trapped turntable that breaks does not show the other side where the trap was', () => {
    // Scratch Boy hides a trap on turntable 1. For all the opponent knows, it could be on either.
    let s = play(fresh(['rig/techno-drum', 'rig/dub-bass']), sc(0, 1, { ally: 1 }), END, END).state;
    expect(viewFor(s, 1).sides[0].hiddenTraps).toBe(1);

    // Turntable 1 scratches an opponent rig holding a trap, and that trap breaks it.
    s = withTrap(s, 1, 0);
    s = patch(s, (d) => {
      const rig = d.sides[0].rigs[1];
      if (rig) rig.hp = 1;
    });
    const r = play(s, sc(1, 1, { target: 0 }));
    expect(eventsOf(r.events, 'trap-fired')).toEqual([{ type: 'trap-fired', side: 1, rig: 0, by: { side: 0, rig: 1 } }]);
    expect(eventsOf(r.events, 'rig-broken')).toEqual([{ type: 'rig-broken', side: 0, rig: 1 }]);
    expect(r.state.winner).toBeNull();

    // The opponent saw no trap of Scratch Boy's go off, so its count must not drop.
    const theirs = viewFor(r.state, 1);
    expect(theirs.sides[0].hiddenTraps).toBe(1);
    expect(theirs.sides[0].rigs.map((rig) => rig.trap)).toEqual([null, null]);

    // Nothing can target the broken turntable, so its trap never goes off: a move on every enemy
    // rig sets off nothing, and the count stays.
    expect(r.state.turn.side).toBe(1);
    const after = play(r.state, sc(1, 2)); // dub-bass: stun 1 on every enemy rig
    expect(eventsOf(after.events, 'trap-fired')).toEqual([]);
    expect(viewFor(after.state, 1).sides[0].hiddenTraps).toBe(1);
  });

  it('eventsFor hides where the other side set a trap', () => {
    const { events } = play(fresh(), sc(0, 1, { ally: 1 }));
    expect(eventsOf(eventsFor(events, 1), 'trap-set')).toEqual([{ type: 'trap-set', side: 0, rig: null }]);
    expect(eventsOf(eventsFor(events, 0), 'trap-set')).toEqual([{ type: 'trap-set', side: 0, rig: 1 }]);
    const others = (list: typeof events) => list.filter((e) => e.type !== 'trap-set');
    expect(others(eventsFor(events, 1))).toEqual(others(events));
  });
});

describe('a trap going off', () => {
  it('hits the rig that targeted it before the move resolves, then is gone', () => {
    let s = play(fresh(), sc(0, 1, { ally: 1 }), END).state;
    s = withSpread(s, 100);
    const r = play(s, sc(0, 1, { target: 1 }));
    expect(r.events.slice(0, 5).map((e) => e.type)).toEqual(['scratched', 'cooldown-started', 'trap-fired', 'hit', 'hit']);
    expect(eventsOf(r.events, 'trap-fired')).toEqual([{ type: 'trap-fired', side: 0, rig: 1, by: { side: 1, rig: 0 } }]);
    const [payload, move] = eventsOf(r.events, 'hit');
    // The trapped rig (hip-hop, neutral mix) is the attacker: hip-hop on techno is x2.
    expect(payload).toEqual({ type: 'hit', side: 1, rig: 0, amount: 20, hp: 80, effectiveness: 'strong' });
    expect(move).toMatchObject({ side: 0, rig: 1 });
    expect(rigOf(r.state, 0, 1).trap).toBeNull();
    expect(viewFor(r.state, 1).sides[0].hiddenTraps).toBe(0);
  });

  it('a stun trap adds to the cooldown the move just started', () => {
    const s = play(fresh(), sc(0, 2, { ally: 1 }), END).state;
    const r = play(s, sc(0, 1, { target: 1 }));
    expect(eventsOf(r.events, 'stunned')).toEqual([{ type: 'stunned', side: 1, rig: 0, turns: 2, cooldown: 3 }]);
    expect(rigOf(r.state, 1, 0).cooldown).toBe(3);
  });

  it("a slow trap slows the fighter that set it off", () => {
    const s = play(fresh(), sc(0, 3, { ally: 1 }), END).state;
    const r = play(s, sc(0, 1, { target: 1 }));
    expect(eventsOf(r.events, 'slowed')).toHaveLength(1);
    expect(eventsOf(r.events, 'slowed')[0]).toMatchObject({ side: 1 });
    expect(r.state.sides[1].slowTurns).toBe(2);
  });

  it('does not go off for a move aimed at another rig', () => {
    const s = play(fresh(), sc(0, 1, { ally: 1 }), END).state;
    const r = play(s, sc(0, 1, { target: 0 }));
    expect(eventsOf(r.events, 'trap-fired')).toEqual([]);
    expect(rigOf(r.state, 0, 1).trap).toEqual(DAMAGE_TRAP);
  });

  it('does not go off for a move that targets no enemy rig', () => {
    const s = withTrap(play(fresh(['rig/dub-bass']), END).state, 0, 0);
    const r = play(s, sc(0, 3)); // slow 2
    expect(eventsOf(r.events, 'trap-fired')).toEqual([]);
    expect(rigOf(r.state, 0, 0).trap).toEqual(DAMAGE_TRAP);
  });

  it('a move on every enemy rig sets off every trap, in rig order', () => {
    const s = withTrap(withTrap(play(fresh(['rig/dub-bass']), END).state, 0, 0), 0, 1);
    const r = play(s, sc(0, 2)); // stun 1 on every enemy rig
    expect(eventsOf(r.events, 'trap-fired')).toEqual([
      { type: 'trap-fired', side: 0, rig: 0, by: { side: 1, rig: 0 } },
      { type: 'trap-fired', side: 0, rig: 1, by: { side: 1, rig: 0 } },
    ]);
    const firstStun = r.events.findIndex((e) => e.type === 'stunned');
    const lastTrap = r.events.findLastIndex((e) => e.type === 'trap-fired');
    expect(lastTrap).toBeLessThan(firstStun);
    expect(r.state.sides[0].rigs.map((rig) => rig.trap)).toEqual([null, null]);
  });

  it('a trap that breaks the attacking rig still lets the move land when its fighter has rigs left', () => {
    let s = play(fresh(['rig/techno-drum', 'rig/dub-bass']), sc(0, 1, { ally: 1 }), END).state;
    s = patch(s, (d) => {
      const rig = d.sides[1].rigs[0];
      if (rig) rig.hp = 5;
    });
    const r = play(s, sc(0, 1, { target: 1 }));
    expect(r.events.slice(0, 6).map((e) => e.type)).toEqual([
      'scratched',
      'cooldown-started',
      'trap-fired',
      'hit',
      'rig-broken',
      'hit',
    ]);
    expect(eventsOf(r.events, 'rig-broken')).toEqual([{ type: 'rig-broken', side: 1, rig: 0 }]);
    expect(eventsOf(r.events, 'hit')[1]).toMatchObject({ side: 0, rig: 1 });
    expect(rigOf(r.state, 0, 1).hp).toBeLessThan(100);
    expect(r.state.winner).toBeNull();
  });

  it("wins the fight when it breaks the attacker's last rig, and the move never lands", () => {
    let s = play(fresh(), sc(0, 1, { ally: 1 }), END).state;
    s = patch(s, (d) => {
      const rig = d.sides[1].rigs[0];
      if (rig) rig.hp = 5;
    });
    const r = play(s, sc(0, 2, { target: 1 }));
    expect(r.events.map((e) => e.type)).toEqual([
      'scratched',
      'cooldown-started',
      'trap-fired',
      'hit',
      'rig-broken',
      'battle-won',
    ]);
    expect(eventsOf(r.events, 'battle-won')).toEqual([{ type: 'battle-won', side: 0 }]);
    expect(r.state.winner).toBe(0);
    expect(rigOf(r.state, 0, 1).hp).toBe(100);
    expect(legalActions(r.state, 0)).toEqual([]);
    expect(legalActions(r.state, 1)).toEqual([]);
  });
});
