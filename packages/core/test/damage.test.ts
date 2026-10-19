import { describe, expect, it } from 'vitest';
import type { BattleState, Level } from '../src/index.ts';
import {
  MIN_DAMAGE,
  expectedDamage,
  genrePct,
  legalActions,
  nextInt,
  rigStatus,
  step,
} from '../src/index.ts';
import {
  END,
  type EventOf,
  type SideOpts,
  act,
  broken,
  eventsOf,
  patch,
  play,
  rigOf,
  sc,
  spreadAt,
  start,
  swap,
  withSpread,
} from './fixtures.ts';

/** Side 0 scratches its rig 0 at `level` on side 1's rig 0, with the damage spread fixed. */
function hitOn(attacker: SideOpts, target: string, level: Level, spread: number): EventOf<'hit'> {
  const s = withSpread(start(attacker, { rigs: [target] }), spread);
  const hits = eventsOf(act(s, sc(0, level, { target: 0 })).events, 'hit');
  expect(hits).toHaveLength(1);
  const hit = hits[0];
  if (!hit) throw new Error('no hit');
  return hit;
}

const SOLO = { rigs: ['vinyl/hh-strike'] }; // one rig: no other rig to mix with, so a neutral mix

describe('the damage formula', () => {
  it('doubles on a strong genre, halves on a weak one', () => {
    expect(genrePct('hip-hop', 'techno')).toBe(200);
    expect(genrePct('hip-hop', 'rock-metal')).toBe(50);
    expect(hitOn(SOLO, 'rig/techno-drum', 1, 100)).toEqual({
      type: 'hit', side: 1, rig: 0, amount: 20, hp: 80, effectiveness: 'strong',
    });
    expect(hitOn(SOLO, 'rig/dub-bass', 1, 100)).toEqual({
      type: 'hit', side: 1, rig: 0, amount: 10, hp: 90, effectiveness: 'normal',
    });
    expect(hitOn(SOLO, 'rig/metal-wall', 1, 100)).toEqual({
      type: 'hit', side: 1, rig: 0, amount: 5, hp: 95, effectiveness: 'weak',
    });
  });

  it('is x1.25 for a good mix and x0.75 for a clash', () => {
    const good = { rigs: ['vinyl/hh-strike', 'vinyl/jz-guard'] };
    const clash = { rigs: ['vinyl/hh-strike', 'vinyl/rm-slow'] };
    const neutral = { rigs: ['vinyl/hh-strike', 'vinyl/dub-trap'] };
    expect(hitOn(good, 'rig/dub-bass', 1, 100).amount).toBe(12); // 12.5
    expect(hitOn(clash, 'rig/dub-bass', 1, 100).amount).toBe(7); // 7.5
    expect(hitOn(neutral, 'rig/dub-bass', 1, 100).amount).toBe(10);
    expect(hitOn(good, 'rig/techno-drum', 1, 100).amount).toBe(25);
    expect(hitOn(clash, 'rig/metal-wall', 1, 100).amount).toBe(3); // 3.75
  });

  it('rounds down once, at the end', () => {
    const clash = { rigs: ['vinyl/hh-strike', 'vinyl/rm-slow'] };
    // 10 x 0.5 x 0.75 x 1.10 = 4.125 -> 4 (rounding each step would give 3).
    expect(hitOn(clash, 'rig/metal-wall', 1, 110).amount).toBe(4);
    const good = { rigs: ['vinyl/hh-strike', 'vinyl/jz-guard'] };
    // 10 x 1.25 x 0.95 = 11.875 -> 11.
    expect(hitOn(good, 'rig/dub-bass', 1, 95).amount).toBe(11);
  });

  it('draws a whole-percent spread from 90 to 110 from the fight generator', () => {
    const base = start({ rigs: ['vinyl/hh-strike', 'vinyl/jz-guard'] }, { rigs: ['rig/techno-drum'] });
    const amounts = new Set<number>();
    for (let rng = 1; rng <= 400; rng++) {
      const s = patch(base, (d) => {
        d.rng = rng;
      });
      const hit = eventsOf(act(s, sc(0, 2, { target: 0 })).events, 'hit')[0];
      // 20 x 2 (strong) x 1.25 (good mix) x spread, rounded down once.
      expect(hit?.amount).toBe(Math.floor((20 * 200 * 125 * spreadAt(rng)) / 1_000_000));
      if (hit) amounts.add(hit.amount);
    }
    expect(Math.min(...amounts)).toBe(45);
    expect(Math.max(...amounts)).toBe(55);
  });

  it('is the same for the same state and action', () => {
    const s = start({ rigs: ['vinyl/hh-strike'] }, { rigs: ['rig/techno-drum'] }, 1234);
    const one = act(s, sc(0, 2, { target: 0 }));
    const two = act(s, sc(0, 2, { target: 0 }));
    expect(JSON.stringify(two)).toBe(JSON.stringify(one));
  });

  it(`is at least MIN_DAMAGE (${MIN_DAMAGE})`, () => {
    // dub-bass level 1 = 1 damage; reggae-dub on rock-metal is weak: 0.5 -> at least 1.
    for (const spread of [90, 100, 110]) {
      let s = start({ rigs: ['vinyl/rm-slow'] }, { rigs: ['rig/dub-bass'] });
      s = withSpread(play(s, END).state, spread);
      const hit = eventsOf(act(s, sc(0, 1, { target: 0 })).events, 'hit');
      expect(hit).toEqual([{ type: 'hit', side: 0, rig: 0, amount: MIN_DAMAGE, hp: 100 - MIN_DAMAGE, effectiveness: 'weak' }]);
    }
  });

  it('adds a met damage partner bonus to the base damage', () => {
    // hh-combo level 1: 10 damage, +6 while a jazz-blues vinyl sits on another working rig.
    const partnered = { rigs: ['vinyl/hh-combo', 'vinyl/jz-guard'] };
    expect(hitOn(partnered, 'rig/dub-bass', 1, 100).amount).toBe(20); // (10 + 6) x 1.25
    expect(hitOn(partnered, 'rig/techno-drum', 1, 100).amount).toBe(40); // (10 + 6) x 2 x 1.25
    expect(hitOn({ rigs: ['vinyl/hh-combo', 'vinyl/dub-trap'] }, 'rig/dub-bass', 1, 100).amount).toBe(10);

    const s = withSpread(broken(start(partnered, { rigs: ['rig/dub-bass'] }), 0, 1), 100);
    expect(eventsOf(act(s, sc(0, 1, { target: 0 })).events, 'hit')[0]?.amount).toBe(10);
  });
});

describe('breaking a rig', () => {
  it('stops HP at 0, emits rig-broken and clears the rig cooldown and shield', () => {
    let s = start({ rigs: ['vinyl/hh-strike'] }, { rigs: ['rig/techno-drum', 'rig/dub-bass'] });
    s = patch(s, (d) => {
      const rig = d.sides[1].rigs[0];
      if (!rig) throw new Error('no rig');
      rig.hp = 5;
      rig.cooldown = 2;
      rig.shield = 3;
    });
    const r = act(withSpread(s, 100), sc(0, 2, { target: 0 }));
    expect(eventsOf(r.events, 'blocked')).toEqual([{ type: 'blocked', side: 1, rig: 0, amount: 3, shield: 0 }]);
    expect(eventsOf(r.events, 'hit')[0]).toMatchObject({ side: 1, rig: 0, hp: 0 });
    expect(eventsOf(r.events, 'rig-broken')).toEqual([{ type: 'rig-broken', side: 1, rig: 0 }]);
    expect(rigOf(r.state, 1, 0)).toMatchObject({ hp: 0, cooldown: 0, shield: 0, trap: null });
    expect(r.state.winner).toBeNull();
    // A broken rig can't act any more.
    expect(r.state.turn.side).toBe(1);
    expect(legalActions(r.state, 1).some((a) => a.kind === 'scratch' && a.rig === 0)).toBe(false);
  });
  it('rigStatus: broken at 0 HP with no cooldown or shield; otherwise cooling, used this turn or ready', () => {
    let s = start(
      { arms: 3, rigs: ['vinyl/hh-strike', 'vinyl/dub-trap', 'vinyl/jz-guard'], bag: ['vinyl/rm-slow'] },
      { rigs: ['rig/techno-drum'] },
    );
    s = play(s, sc(0, 2, { target: 0 }), swap(1, 'vinyl/rm-slow')).state;
    const cooldown = rigOf(s, 0, 0).cooldown;
    expect(cooldown).toBeGreaterThan(0);
    expect(rigStatus(s, 0, 0)).toEqual({ state: 'cooling', cooldown, shield: 0 });
    expect(rigStatus(s, 0, 1)).toEqual({ state: 'used', cooldown: 0, shield: 0 });
    expect(rigStatus(s, 0, 2)).toEqual({ state: 'ready', cooldown: 0, shield: 0 });
    // A rig at 0 HP whose fields still hold a cooldown and a shield (a screen's displayed state
    // between the hit and the end of the step) is broken, with neither.
    const shown = patch(s, (d) => {
      const rig = d.sides[1].rigs[0];
      if (!rig) throw new Error('no rig');
      rig.hp = 0;
      rig.cooldown = 2;
      rig.shield = 3;
    });
    expect(rigStatus(shown, 1, 0)).toEqual({ state: 'broken', cooldown: 0, shield: 0 });
    const shielded = patch(s, (d) => {
      const rig = d.sides[1].rigs[0];
      if (!rig) throw new Error('no rig');
      rig.shield = 3;
    });
    expect(rigStatus(shielded, 1, 0)).toEqual({ state: 'ready', cooldown: 0, shield: 3 });
  });
});

describe('shields', () => {
  it('add up on the same rig', () => {
    const s = start({ rigs: ['vinyl/jz-guard', 'vinyl/cl-wall'] }, { rigs: ['rig/techno-drum'] });
    const r = play(s, sc(0, 1, { ally: 1 }), sc(1, 1, { ally: 1 }));
    expect(eventsOf(r.events, 'shield-raised')).toEqual([
      { type: 'shield-raised', side: 0, rig: 1, amount: 8, shield: 8 },
      { type: 'shield-raised', side: 0, rig: 1, amount: 10, shield: 18 },
    ]);
    expect(rigOf(r.state, 0, 1).shield).toBe(18);
  });

  it('soak damage before HP does', () => {
    let s = start({ rigs: ['vinyl/jz-guard', 'vinyl/cl-wall'] }, { rigs: ['rig/techno-drum'] });
    s = play(s, sc(0, 1, { ally: 1 }), sc(1, 1, { ally: 1 })).state; // 18 shield on cl-wall
    // techno on classical is x1; 20 damage: 18 soaked, 2 to HP.
    const r = act(withSpread(s, 100), sc(0, 2, { target: 1 }));
    expect(eventsOf(r.events, 'blocked')).toEqual([{ type: 'blocked', side: 0, rig: 1, amount: 18, shield: 0 }]);
    expect(eventsOf(r.events, 'hit')).toEqual([{ type: 'hit', side: 0, rig: 1, amount: 2, hp: 98, effectiveness: 'normal' }]);
  });

  it('a shield that soaks everything leaves HP alone and emits no hit', () => {
    let s = start({ rigs: ['vinyl/jz-guard', 'vinyl/cl-wall'] }, { rigs: ['rig/techno-drum'] });
    s = play(s, sc(0, 1, { ally: 1 }), sc(1, 1, { ally: 1 })).state;
    const r = act(withSpread(s, 100), sc(0, 1, { target: 1 }));
    expect(eventsOf(r.events, 'blocked')).toEqual([{ type: 'blocked', side: 0, rig: 1, amount: 10, shield: 8 }]);
    expect(eventsOf(r.events, 'hit')).toEqual([]);
    expect(rigOf(r.state, 0, 1).hp).toBe(100);
  });

  it("last through the opponent's turn and fade at the start of the owner's next turn", () => {
    let s = start({ rigs: ['vinyl/jz-guard', 'vinyl/cl-wall'] }, { rigs: ['rig/techno-drum', 'rig/dub-bass'] });
    s = play(s, sc(1, 1, { ally: 1 }), END).state;
    expect(s.turn.side).toBe(1);
    expect(rigOf(s, 0, 1).shield).toBe(10);
    const r = play(s, END);
    expect(r.events).toEqual([
      { type: 'turn-ended', side: 1 },
      { type: 'shield-faded', side: 0, rig: 1 },
      { type: 'turn-started', side: 0, turn: 3 },
    ]);
    expect(rigOf(r.state, 0, 1).shield).toBe(0);
  });

  it('a shield on every own rig skips broken rigs', () => {
    let s = start({ rigs: ['vinyl/jz-guard', 'vinyl/cl-wall', 'vinyl/hh-strike'] }, { rigs: ['rig/techno-drum'] });
    s = broken(s, 0, 2);
    const r = act(s, sc(0, 2));
    expect(eventsOf(r.events, 'shield-raised')).toEqual([
      { type: 'shield-raised', side: 0, rig: 0, amount: 5, shield: 5 },
      { type: 'shield-raised', side: 0, rig: 1, amount: 5, shield: 5 },
    ]);
    expect(rigOf(r.state, 0, 2).shield).toBe(0);
  });
});

describe('targeting', () => {
  it('a single-target move must aim at a working defender', () => {
    const s = start({ rigs: ['vinyl/hh-strike', 'vinyl/hh-combo'] }, { rigs: ['rig/techno-drum', 'rig/metal-wall'] });
    const targets = legalActions(s, 0).flatMap((a) => (a.kind === 'scratch' && a.target !== undefined ? [a.target] : []));
    expect(targets.length).toBeGreaterThan(0);
    expect(new Set(targets)).toEqual(new Set([1]));
    expect(() => step(s, 0, sc(0, 1, { target: 0 }))).toThrow(Error);

    // Once the defender breaks, the other rig can be targeted.
    const weak = withSpread(
      patch(s, (d) => {
        const rig = d.sides[1].rigs[1];
        if (rig) rig.hp = 1;
      }),
      100,
    );
    const r = act(weak, sc(0, 1, { target: 1 }));
    expect(eventsOf(r.events, 'rig-broken')).toEqual([{ type: 'rig-broken', side: 1, rig: 1 }]);
    expect(legalActions(r.state, 0)).toContainEqual(sc(1, 1, { target: 0 }));
  });

  it('a defender vinyl protects its turntable side too', () => {
    const s = play(start({ rigs: ['vinyl/hh-strike', 'vinyl/cl-wall'] }, { rigs: ['rig/techno-drum'] }), END).state;
    const targets = legalActions(s, 1).flatMap((a) => (a.kind === 'scratch' && a.target !== undefined ? [a.target] : []));
    expect(new Set(targets)).toEqual(new Set([1]));
  });

  it('a move on every enemy rig hits every working rig, defenders included, one spread draw each in rig order', () => {
    let s = start({ rigs: ['vinyl/hh-strike'] }, { rigs: ['rig/techno-drum', 'rig/dub-bass', 'rig/metal-wall'] }, 77);
    s = broken(s, 1, 1);
    const first = nextInt(s.rng, 90, 110);
    const second = nextInt(first.rng, 90, 110);
    const r = act(s, sc(0, 3));
    expect(eventsOf(r.events, 'hit')).toEqual([
      // 12 x 2 on techno, 12 x 0.5 on rock-metal; one rig: neutral mix.
      { type: 'hit', side: 1, rig: 0, amount: Math.floor((12 * 200 * first.value) / 10_000), hp: 100 - Math.floor((12 * 200 * first.value) / 10_000), effectiveness: 'strong' },
      { type: 'hit', side: 1, rig: 2, amount: Math.floor((12 * 50 * second.value) / 10_000), hp: 100 - Math.floor((12 * 50 * second.value) / 10_000), effectiveness: 'weak' },
    ]);
    expect(rigOf(r.state, 1, 1).hp).toBe(0);
  });
});

describe('expectedDamage', () => {
  function expected(state: BattleState, level: Level, target: number) {
    return expectedDamage(state, state.turn.side, 0, level, target);
  }

  it('counts the spread at 100%, before shields', () => {
    let s = start({ rigs: ['vinyl/hh-strike'] }, { rigs: ['rig/techno-drum', 'rig/metal-wall'] });
    expect(expected(s, 2, 1)).toBe(10); // 20 x 0.5
    expect(expected(s, 3, 0)).toBe(24); // 12 x 2, every enemy rig
    expect(expected(s, 3, 1)).toBe(6);
    s = patch(s, (d) => {
      const rig = d.sides[1].rigs[1];
      if (rig) rig.shield = 50;
    });
    expect(expected(s, 2, 1)).toBe(10);
  });

  it('matches the real hit at a 100% spread, partner bonus and mix included', () => {
    const s = withSpread(start({ rigs: ['vinyl/hh-combo', 'vinyl/jz-guard'] }, { rigs: ['rig/techno-drum'] }), 100);
    const hit = eventsOf(act(s, sc(0, 1, { target: 0 })).events, 'hit')[0];
    expect(expected(s, 1, 0)).toBe(40);
    expect(hit?.amount).toBe(40);
  });

  it('is at least MIN_DAMAGE for a damage move and 0 for a move without damage', () => {
    const s = play(start({ rigs: ['vinyl/rm-slow'] }, { rigs: ['rig/dub-bass'] }), END).state;
    expect(expected(s, 1, 0)).toBe(MIN_DAMAGE);
    expect(expected(s, 2, 0)).toBe(0); // stun only
  });
});
