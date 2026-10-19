import { describe, expect, it } from 'vitest';
import type { Action, BattleState, SideIndex } from '../src/index.ts';
import { MIN_COOLDOWN, legalActions, rigReady, scratchCooldown, slowAndHasteTurns } from '../src/index.ts';
import { END, broken, eventsOf, play, rigOf, sc, start, swap } from './fixtures.ts';

function actionsOn(state: BattleState, side: SideIndex, rig: number): Action[] {
  return legalActions(state, side).filter((a) => a.kind !== 'end' && a.rig === rig);
}

function cooldowns(state: BattleState, side: SideIndex, rig: number): number[] {
  return [1, 2, 3].map((level) => scratchCooldown(state, side, rig, level as 1 | 2 | 3));
}

describe('cooldown counting', () => {
  it("level 2 in turn 1 sits out the owner's turns 2 and 3 and is ready on turn 4", () => {
    // Hip-hop + reggae-dub: a neutral mix, so the cooldown is the plain level.
    let s = start({ rigs: ['vinyl/hh-strike', 'vinyl/dub-trap'] }, { rigs: ['rig/techno-drum'] });
    expect(s.turn).toMatchObject({ number: 1, side: 0 });

    let r = play(s, sc(0, 2, { target: 0 }));
    expect(eventsOf(r.events, 'cooldown-started')).toEqual([{ type: 'cooldown-started', side: 0, rig: 0, turns: 2 }]);
    expect(rigOf(r.state, 0, 0).cooldown).toBe(2);

    // End of own turn 1: the rig acted this turn, so it does not tick.
    r = play(r.state, END);
    expect(rigOf(r.state, 0, 0).cooldown).toBe(2);
    expect(eventsOf(r.events, 'cooldown-ticked')).toEqual([]);
    // The opponent's turn never ticks it either.
    s = play(r.state, END).state;
    expect(rigOf(s, 0, 0).cooldown).toBe(2);

    // Own turn 2: sits out.
    expect(s.turn).toMatchObject({ number: 3, side: 0 });
    expect(rigReady(s, 0, 0)).toBe(false);
    expect(actionsOn(s, 0, 0)).toEqual([]);
    r = play(s, END);
    expect(eventsOf(r.events, 'cooldown-ticked')).toEqual([{ type: 'cooldown-ticked', side: 0, rig: 0, cooldown: 1 }]);
    s = play(r.state, END).state;

    // Own turn 3: sits out.
    expect(s.turn).toMatchObject({ number: 5, side: 0 });
    expect(rigReady(s, 0, 0)).toBe(false);
    expect(actionsOn(s, 0, 0)).toEqual([]);
    r = play(s, END);
    expect(eventsOf(r.events, 'cooldown-ticked')).toEqual([{ type: 'cooldown-ticked', side: 0, rig: 0, cooldown: 0 }]);
    s = play(r.state, END).state;

    // Own turn 4: ready.
    expect(s.turn).toMatchObject({ number: 7, side: 0 });
    expect(rigReady(s, 0, 0)).toBe(true);
    expect(actionsOn(s, 0, 0)).toContainEqual(sc(0, 1, { target: 0 }));
  });

  it('counts the same way when the turns end by themselves', () => {
    let s = start({ rigs: ['vinyl/hh-strike'] }, { rigs: ['rig/techno-drum'] });
    s = play(s, sc(0, 2, { target: 0 })).state; // the only rig is cooling: the turn ends by itself
    expect(s.turn).toMatchObject({ number: 2, side: 1 });

    let r = play(s, END); // own turn 2: nothing ready, ends by itself
    expect(r.events).toEqual([
      { type: 'turn-ended', side: 1 },
      { type: 'turn-started', side: 0, turn: 3 },
      { type: 'cooldown-ticked', side: 0, rig: 0, cooldown: 1 },
      { type: 'turn-ended', side: 0 },
      { type: 'turn-started', side: 1, turn: 4 },
    ]);
    r = play(r.state, END); // own turn 3: same
    expect(eventsOf(r.events, 'cooldown-ticked')).toEqual([{ type: 'cooldown-ticked', side: 0, rig: 0, cooldown: 0 }]);
    expect(r.state.turn).toMatchObject({ number: 6, side: 1 });

    s = play(r.state, END).state; // own turn 4: ready
    expect(s.turn).toMatchObject({ number: 7, side: 0 });
    expect(rigReady(s, 0, 0)).toBe(true);
  });

  it('belongs to the turntable slot, not the vinyl', () => {
    let s = start(
      { rigs: ['vinyl/hh-strike', 'vinyl/dub-trap'], bag: ['vinyl/jz-guard'] },
      { rigs: ['rig/techno-drum'] },
    );
    s = play(s, sc(0, 2, { target: 0 }), swap(1, 'vinyl/jz-guard')).state; // 2 arms used: turn over
    expect(rigOf(s, 0, 0).cooldown).toBe(2);
    expect(rigOf(s, 0, 1)).toMatchObject({ deck: 'vinyl/jz-guard', cooldown: 0 });

    s = play(s, END).state;
    // The swapped slot is ready with its new vinyl; the cooling slot can't be scratched or swapped.
    expect(rigReady(s, 0, 1)).toBe(true);
    expect(actionsOn(s, 0, 1)).toContainEqual(sc(1, 1, { ally: 0 }));
    expect(actionsOn(s, 0, 0)).toEqual([]);
    // After this swap nothing is left to touch, so the turn ends by itself and the cooling slot
    // (which did not act) ticks, still holding the same vinyl.
    const r = play(s, swap(1, 'vinyl/dub-trap'));
    expect(eventsOf(r.events, 'cooldown-ticked')).toEqual([{ type: 'cooldown-ticked', side: 0, rig: 0, cooldown: 1 }]);
    expect(rigOf(r.state, 0, 1)).toMatchObject({ deck: 'vinyl/dub-trap', cooldown: 0 });
    expect(rigOf(r.state, 0, 0)).toMatchObject({ deck: 'vinyl/hh-strike', cooldown: 1 });
  });
});

describe('the cooldown a scratch starts', () => {
  it('is the level for a neutral mix', () => {
    const s = start({ rigs: ['vinyl/hh-strike', 'vinyl/dub-trap'] }, { rigs: ['rig/techno-drum'] });
    expect(cooldowns(s, 0, 0)).toEqual([1, 2, 3]);
    // A single rig has no other rig to mix with: neutral too.
    const single = start({ rigs: ['vinyl/hh-strike'] }, { rigs: ['rig/techno-drum'] });
    expect(cooldowns(single, 0, 0)).toEqual([1, 2, 3]);
  });

  it('is 1 longer for a mix clash, and the clash ends when the other rig breaks', () => {
    const s = start({ rigs: ['vinyl/hh-strike', 'vinyl/rm-slow'] }, { rigs: ['rig/techno-drum'] });
    expect(cooldowns(s, 0, 0)).toEqual([2, 3, 4]);
    const r = play(s, sc(0, 1, { target: 0 }));
    expect(eventsOf(r.events, 'cooldown-started')).toEqual([{ type: 'cooldown-started', side: 0, rig: 0, turns: 2 }]);
    expect(rigOf(r.state, 0, 0).cooldown).toBe(2);

    expect(cooldowns(broken(s, 0, 1), 0, 0)).toEqual([1, 2, 3]);
  });

  it(`is 1 shorter for a good mix, never below MIN_COOLDOWN (${MIN_COOLDOWN})`, () => {
    const s = start({ rigs: ['vinyl/hh-strike', 'vinyl/jz-guard'] }, { rigs: ['rig/techno-drum'] });
    expect(cooldowns(s, 0, 0)).toEqual([1, 1, 2]);
    // Same genre is a good mix.
    const same = start({ rigs: ['vinyl/hh-strike', 'vinyl/hh-combo'] }, { rigs: ['rig/techno-drum'] });
    expect(cooldowns(same, 0, 0)).toEqual([1, 1, 2]);
  });

  it('floors a good mix plus haste at MIN_COOLDOWN', () => {
    let s = start({ rigs: ['vinyl/hh-strike', 'vinyl/jz-guard'] }, { rigs: ['rig/techno-drum'] });
    s = play(s, sc(1, 3), END, END).state; // haste 2, then the opponent passes
    expect(s.turn).toMatchObject({ number: 3, side: 0, hasted: true });
    expect(cooldowns(s, 0, 0)).toEqual([1, 1, 1]);
    const r = play(s, sc(0, 1, { target: 0 }));
    expect(eventsOf(r.events, 'cooldown-started')).toEqual([
      { type: 'cooldown-started', side: 0, rig: 0, turns: MIN_COOLDOWN },
    ]);
    expect(rigOf(r.state, 0, 0).cooldown).toBe(MIN_COOLDOWN);
  });

  it('is 1 shorter with a met cooldown partner bonus, on that move only', () => {
    // hh-combo level 2 partners with artist/dub-one (dub-trap); hip-hop + reggae-dub is neutral.
    const s = start({ rigs: ['vinyl/hh-combo', 'vinyl/dub-trap'] }, { rigs: ['rig/techno-drum'] });
    expect(cooldowns(s, 0, 0)).toEqual([1, 1, 3]);
    const r = play(s, sc(0, 2, { target: 0 }));
    expect(eventsOf(r.events, 'cooldown-started')).toEqual([{ type: 'cooldown-started', side: 0, rig: 0, turns: 1 }]);

    // The partner must sit on another WORKING rig.
    expect(cooldowns(broken(s, 0, 1), 0, 0)).toEqual([1, 2, 3]);
    // Without the partner artist: the plain mix rule.
    const clash = start({ rigs: ['vinyl/hh-combo', 'vinyl/rm-slow'] }, { rigs: ['rig/techno-drum'] });
    expect(cooldowns(clash, 0, 0)).toEqual([2, 3, 4]);
  });
});

describe('slow and haste', () => {
  it("slow N: the target fighter's next N turns start cooldowns 1 turn longer", () => {
    let s = start(
      { rigs: ['vinyl/rm-slow', 'vinyl/dub-trap'] },
      { rigs: ['rig/techno-drum', 'rig/dub-bass'] }, // techno + reggae-dub: neutral
    );
    let r = play(s, sc(0, 2));
    expect(eventsOf(r.events, 'slowed')).toHaveLength(1);
    expect(eventsOf(r.events, 'slowed')[0]).toMatchObject({ side: 1 });
    expect(r.state.sides[1].slowTurns).toBe(2);
    // The slowing side is not slowed.
    expect(cooldowns(r.state, 0, 1)).toEqual([1, 2, 3]);

    s = play(r.state, END).state;
    expect(s.turn).toMatchObject({ number: 2, side: 1, slowed: true });
    expect(cooldowns(s, 1, 0)).toEqual([2, 3, 4]);
    s = play(s, END, END).state;
    expect(s.turn).toMatchObject({ number: 4, side: 1, slowed: true });
    expect(cooldowns(s, 1, 0)).toEqual([2, 3, 4]);
    r = play(s, sc(0, 1, { target: 1 }));
    expect(eventsOf(r.events, 'cooldown-started')).toEqual([{ type: 'cooldown-started', side: 1, rig: 0, turns: 2 }]);
    s = play(r.state, END).state;
    expect(s.turn).toMatchObject({ number: 6, side: 1, slowed: false });
    expect(s.sides[1].slowTurns).toBe(0);
    expect(cooldowns(s, 1, 1)).toEqual([1, 2, 3]);
  });

  it("haste N: the acting fighter's next N turns start cooldowns 1 turn shorter, not the current one", () => {
    let s = start({ rigs: ['vinyl/jz-guard', 'vinyl/dub-trap'] }, { rigs: ['rig/techno-drum'] });
    const r = play(s, sc(0, 3));
    expect(eventsOf(r.events, 'hasted')).toHaveLength(1);
    expect(eventsOf(r.events, 'hasted')[0]).toMatchObject({ side: 0 });
    expect(r.state.sides[0].hasteTurns).toBe(2);
    expect(r.state.turn.hasted).toBe(false);
    expect(cooldowns(r.state, 0, 1)).toEqual([1, 2, 3]);

    s = play(r.state, END, END).state;
    expect(s.turn).toMatchObject({ number: 3, side: 0, hasted: true });
    expect(cooldowns(s, 0, 1)).toEqual([1, 1, 2]);
    s = play(s, END, END).state;
    expect(s.turn).toMatchObject({ number: 5, side: 0, hasted: true });
    expect(cooldowns(s, 0, 1)).toEqual([1, 1, 2]);
    s = play(s, END, END).state;
    expect(s.turn).toMatchObject({ number: 7, side: 0, hasted: false });
    expect(cooldowns(s, 0, 1)).toEqual([1, 2, 3]);
  });

  it('slowAndHasteTurns: the own turns still slowed or hasted, the current one included', () => {
    let s = start(
      { rigs: ['vinyl/rm-slow', 'vinyl/dub-trap'] },
      { rigs: ['rig/techno-drum', 'rig/dub-bass'] },
    );
    s = play(s, sc(0, 2)).state; // slow 2 on side 1
    expect(slowAndHasteTurns(s, 1)).toEqual({ slow: 2, haste: 0 });
    s = play(s, END).state; // side 1's first slowed turn
    expect(slowAndHasteTurns(s, 1)).toEqual({ slow: 2, haste: 0 });
    s = play(s, END).state; // side 0's turn: one slowed turn left for side 1
    expect(slowAndHasteTurns(s, 1)).toEqual({ slow: 1, haste: 0 });
    s = play(s, END).state; // side 1's last slowed turn
    expect(slowAndHasteTurns(s, 1)).toEqual({ slow: 1, haste: 0 });
    s = play(s, END, END).state;
    expect(slowAndHasteTurns(s, 1)).toEqual({ slow: 0, haste: 0 });

    // Haste 2 on the acting side: not its current turn, its next two.
    const h = play(start({ rigs: ['vinyl/jz-guard', 'vinyl/dub-trap'] }, { rigs: ['rig/techno-drum'] }), sc(0, 3)).state;
    expect(slowAndHasteTurns(h, 0)).toEqual({ slow: 0, haste: 2 });
    expect(slowAndHasteTurns(play(h, END, END).state, 0)).toEqual({ slow: 0, haste: 2 });
  });

  it('applying slow again keeps the longer duration', () => {
    // rm-slow level 2 = slow 2; hh-combo level 3 = stun 2 + slow 1. Three arms and a third rig keep
    // the turn going, so the opponent's turn start has not used up a slowed turn yet.
    const s = start(
      { arms: 3, rigs: ['vinyl/rm-slow', 'vinyl/hh-combo', 'vinyl/dub-trap'] },
      { rigs: ['rig/techno-drum'] },
    );
    expect(play(s, sc(0, 2), sc(1, 3, { target: 0 })).state.sides[1].slowTurns).toBe(2);
    const reversed = play(s, sc(1, 3, { target: 0 }));
    expect(reversed.state.sides[1].slowTurns).toBe(1);
    expect(play(reversed.state, sc(0, 2)).state.sides[1].slowTurns).toBe(2);
  });

  it('applying haste again keeps the longer duration', () => {
    // jz-guard level 3 = haste 2; rm-slow level 3 = damage + stun 1 + haste 1. The opponent has a
    // second rig, so the stun does not end its turn by itself (which would start side 0's next turn
    // and use up a hasted turn).
    const s = start(
      { rigs: ['vinyl/jz-guard', 'vinyl/rm-slow'] },
      { rigs: ['rig/techno-drum', 'rig/dub-bass'] }, // techno + reggae-dub: neutral
    );
    expect(play(s, sc(0, 3), sc(1, 3, { target: 0 })).state.sides[0].hasteTurns).toBe(2);
    const reversed = play(s, sc(1, 3, { target: 0 }));
    expect(reversed.state.sides[0].hasteTurns).toBe(1);
    const both = play(reversed.state, sc(0, 3));
    expect(eventsOf(both.events, 'hasted')).toHaveLength(1);
    expect(both.state.sides[0].hasteTurns).toBe(2);
  });
});

describe('stun', () => {
  it('adds N to the cooldown of a ready rig, which then sits out its next N turns', () => {
    let s = start({ rigs: ['vinyl/rm-slow'] }, { rigs: ['rig/techno-drum', 'rig/dub-bass'] });
    const r = play(s, sc(0, 3, { target: 0 })); // damage, stun 1, haste 1
    expect(eventsOf(r.events, 'stunned')).toEqual([{ type: 'stunned', side: 1, rig: 0, turns: 1, cooldown: 1 }]);
    s = r.state;
    expect(s.turn).toMatchObject({ number: 2, side: 1 });
    expect(rigReady(s, 1, 0)).toBe(false);
    expect(actionsOn(s, 1, 0)).toEqual([]);
    expect(rigReady(s, 1, 1)).toBe(true);
    s = play(s, END).state; // ticks to 0; side 0's only rig is cooling, so its turn ends by itself
    expect(s.turn).toMatchObject({ number: 4, side: 1 });
    expect(rigReady(s, 1, 0)).toBe(true);
  });

  it('adds N to a cooldown that is already running', () => {
    let s = start({ rigs: ['vinyl/rm-slow', 'vinyl/hh-combo'] }, { rigs: ['rig/techno-drum'] });
    s = play(s, END, sc(0, 2, { target: 0 })).state; // the opponent's rig cools for 2
    expect(rigOf(s, 1, 0).cooldown).toBe(2);
    const r = play(s, sc(1, 3, { target: 0 })); // stun 2
    expect(eventsOf(r.events, 'stunned')).toEqual([{ type: 'stunned', side: 1, rig: 0, turns: 2, cooldown: 4 }]);
    expect(rigOf(r.state, 1, 0).cooldown).toBe(4);
  });

  it('a stun on every enemy rig hits every working rig', () => {
    let s = start(
      { rigs: ['vinyl/hh-strike', 'vinyl/dub-trap', 'vinyl/jz-guard'] },
      { rigs: ['rig/dub-bass'] },
    );
    s = broken(s, 0, 1);
    s = play(s, END).state;
    const r = play(s, sc(0, 2)); // stun 1 on every enemy rig
    expect(eventsOf(r.events, 'stunned')).toEqual([
      { type: 'stunned', side: 0, rig: 0, turns: 1, cooldown: 1 },
      { type: 'stunned', side: 0, rig: 2, turns: 1, cooldown: 1 },
    ]);
    expect(rigOf(r.state, 0, 1).cooldown).toBe(0);
  });
});
