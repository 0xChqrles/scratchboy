import { describe, expect, it } from 'vitest';
import { armsLeft, legalActions, rigMix, rigReady, step } from '../src/index.ts';
import { END, FIGHTS, broken, eventsOf, otherSide, patch, play, randomFight, rigOf, sc, start, swap } from './fixtures.ts';

describe('arms', () => {
  it('Scratch Boy makes up to 2 interactions, then the turn ends by itself', () => {
    const s = start({ rigs: ['vinyl/hh-strike', 'vinyl/dub-trap', 'vinyl/jz-guard'] }, { rigs: ['rig/techno-drum'] });
    const one = play(s, sc(0, 1, { target: 0 }));
    expect(one.state.turn).toMatchObject({ side: 0, used: [0] });
    expect(eventsOf(one.events, 'turn-ended')).toEqual([]);

    const two = play(one.state, sc(1, 1, { ally: 2 }));
    expect(eventsOf(two.events, 'turn-ended')).toEqual([{ type: 'turn-ended', side: 0 }]);
    expect(eventsOf(two.events, 'turn-started')).toEqual([{ type: 'turn-started', side: 1, turn: 2 }]);
    expect(two.state.turn).toMatchObject({ number: 2, side: 1, used: [] });
    // Rig 2 was still ready, but both arms were used.
    expect(rigOf(two.state, 0, 2).cooldown).toBe(0);
  });

  it("an opponent's arms come from its data", () => {
    let s = start(
      { rigs: ['vinyl/hh-strike'] },
      { arms: 2, rigs: ['rig/techno-drum', 'rig/dub-bass', 'rig/metal-wall'] },
    );
    s = play(s, END).state;
    const one = play(s, sc(0, 1, { target: 0 }));
    expect(one.state.turn).toMatchObject({ side: 1, used: [0] });
    const two = play(one.state, sc(1, 1, { target: 0 }));
    expect(two.state.turn.side).toBe(0);

    const single = play(start({ rigs: ['vinyl/hh-strike'] }, { rigs: ['rig/techno-drum', 'rig/dub-bass'] }), END);
    expect(play(single.state, sc(1, 1, { target: 0 })).state.turn.side).toBe(0);
  });

  it('each rig takes at most one interaction per turn', () => {
    const s = start(
      { rigs: ['vinyl/hh-strike', 'vinyl/dub-trap'], bag: ['vinyl/jz-guard'] },
      { rigs: ['rig/techno-drum'] },
    );
    const swapped = play(s, swap(0, 'vinyl/jz-guard')).state;
    // Rig 0 has no cooldown, but it was touched this turn.
    expect(rigOf(swapped, 0, 0).cooldown).toBe(0);
    expect(rigReady(swapped, 0, 0)).toBe(false);
    expect(legalActions(swapped, 0).filter((a) => a.kind !== 'end' && a.rig === 0)).toEqual([]);
    expect(() => step(swapped, 0, sc(0, 1, { ally: 0 }))).toThrow(Error);
    expect(() => step(swapped, 0, swap(0, 'vinyl/hh-strike'))).toThrow(Error);
    expect(rigReady(swapped, 0, 1)).toBe(true);
  });
  it('armsLeft: the free arms, no more than the ready rigs, and 0 off turn', () => {
    const s = start({ rigs: ['vinyl/hh-strike', 'vinyl/dub-trap', 'vinyl/jz-guard'] }, { rigs: ['rig/techno-drum'] });
    expect(armsLeft(s, 0)).toBe(2);
    expect(armsLeft(s, 1)).toBe(0);
    expect(armsLeft(play(s, sc(0, 1, { target: 0 })).state, 0)).toBe(1);
    // Two arms free, one ready rig.
    const oneReady = patch(s, (d) => {
      for (const rig of d.sides[0].rigs.slice(0, 2)) rig.cooldown = 2;
    });
    expect(armsLeft(oneReady, 0)).toBe(1);
    // Nothing ready: only 'end' is legal.
    const noneReady = patch(s, (d) => {
      for (const rig of d.sides[0].rigs) rig.cooldown = 1;
    });
    expect(armsLeft(noneReady, 0)).toBe(0);
    expect(legalActions(noneReady, 0)).toEqual([END]);
    // In every state of whole fights, it is non-zero exactly when an interaction is legal.
    for (const fight of FIGHTS) {
      for (const { state, side } of randomFight(fight.setup, fight.pickSeed)) {
        expect(armsLeft(state, side) > 0).toBe(legalActions(state, side).some((a) => a.kind !== 'end'));
        expect(armsLeft(state, otherSide(side))).toBe(0);
      }
    }
  });
});

describe('ending the turn', () => {
  it('is allowed at any time, before or after an interaction', () => {
    const s = start({ rigs: ['vinyl/hh-strike', 'vinyl/dub-trap'] }, { rigs: ['rig/techno-drum'] });
    expect(legalActions(s, 0)).toContainEqual(END);
    expect(legalActions(s, 0).at(-1)).toEqual(END);
    const now = play(s, END);
    expect(now.events).toEqual([
      { type: 'turn-ended', side: 0 },
      { type: 'turn-started', side: 1, turn: 2 },
    ]);
    expect(now.state.turn).toEqual({ number: 2, side: 1, used: [], slowed: false, hasted: false });

    const after = play(s, sc(0, 1, { target: 0 }));
    expect(after.state.turn.side).toBe(0);
    expect(legalActions(after.state, 0)).toContainEqual(END);
    expect(play(after.state, END).state.turn).toMatchObject({ number: 2, side: 1 });
  });

  it('happens by itself after the last possible interaction', () => {
    const s = start({ rigs: ['vinyl/hh-strike'] }, { rigs: ['rig/techno-drum'] });
    const r = play(s, sc(0, 1, { target: 0 }));
    expect(r.events.map((e) => e.type)).toEqual([
      'scratched',
      'cooldown-started',
      'hit',
      'turn-ended',
      'turn-started',
    ]);
    expect(r.state.turn).toMatchObject({ number: 2, side: 1 });
  });

  it('only the side whose turn it is may act', () => {
    const s = start({ rigs: ['vinyl/hh-strike'] }, { rigs: ['rig/techno-drum'] });
    expect(legalActions(s, 1)).toEqual([]);
    expect(() => step(s, 1, END)).toThrow(Error);
    expect(() => step(s, 1, sc(0, 1, { target: 0 }))).toThrow(Error);
  });
});

describe('swaps', () => {
  const bagged = () =>
    start(
      { rigs: ['vinyl/hh-strike', 'vinyl/dub-trap'], bag: ['vinyl/jz-guard', 'vinyl/rm-slow', 'vinyl/cl-wall'] },
      { rigs: ['rig/techno-drum'] },
    );

  it('puts the bag vinyl on the rig and the old vinyl in its place in the bag', () => {
    const r = play(bagged(), swap(1, 'vinyl/rm-slow'));
    expect(r.events).toEqual([{ type: 'swapped', side: 0, rig: 1, out: 'vinyl/dub-trap', in: 'vinyl/rm-slow' }]);
    expect(rigOf(r.state, 0, 1).deck).toBe('vinyl/rm-slow');
    expect(r.state.sides[0].bag).toEqual(['vinyl/jz-guard', 'vinyl/dub-trap', 'vinyl/cl-wall']);
    expect(r.state.turn.used).toEqual([1]);
  });

  it('keeps the turntable HP, cooldown, shield and trap', () => {
    const trap = { payload: [{ kind: 'damage' as const, amount: 10 }] };
    const s = patch(bagged(), (d) => {
      const rig = d.sides[0].rigs[0];
      if (!rig) throw new Error('no rig');
      rig.hp = 37;
      rig.shield = 6;
      rig.trap = trap;
    });
    const rig = rigOf(play(s, swap(0, 'vinyl/jz-guard')).state, 0, 0);
    expect(rig).toEqual({ id: 'turntable/1', deck: 'vinyl/jz-guard', hp: 37, maxHp: 100, cooldown: 0, shield: 6, trap });
  });

  it('the new vinyl first scratches next turn', () => {
    let s = play(bagged(), swap(0, 'vinyl/jz-guard')).state;
    expect(legalActions(s, 0).some((a) => a.kind === 'scratch' && a.rig === 0)).toBe(false);
    s = play(s, END, END).state;
    expect(legalActions(s, 0)).toContainEqual(sc(0, 1, { ally: 0 }));
  });

  it('changes the mix of the other rigs', () => {
    const s = bagged();
    expect(rigMix(s, 0, 0)).toBe('neutral'); // hip-hop + reggae-dub
    const r = play(s, swap(1, 'vinyl/rm-slow'));
    expect(rigMix(r.state, 0, 0)).toBe('clash'); // hip-hop + rock-metal
    expect(rigMix(play(s, swap(1, 'vinyl/jz-guard')).state, 0, 0)).toBe('good'); // hip-hop + jazz-blues
  });

  it('needs a ready, working turntable and a vinyl that is in the bag', () => {
    const s = bagged();
    expect(() => step(s, 0, swap(0, 'vinyl/hh-combo'))).toThrow(Error); // not in this bag
    expect(() => step(s, 0, swap(0, 'vinyl/dub-trap'))).toThrow(Error); // loaded, not in the bag
    expect(() => step(s, 0, swap(2, 'vinyl/jz-guard'))).toThrow(Error); // no such rig

    const cooling = play(s, sc(0, 1, { target: 0 })).state;
    expect(legalActions(cooling, 0).some((a) => a.kind === 'swap' && a.rig === 0)).toBe(false);
    const dead = broken(s, 0, 0);
    expect(legalActions(dead, 0).some((a) => a.kind === 'swap' && a.rig === 0)).toBe(false);
    expect(() => step(dead, 0, swap(0, 'vinyl/jz-guard'))).toThrow(Error);
  });

  it('is never offered to a fighter with an empty bag', () => {
    let s = start({ rigs: ['vinyl/hh-strike', 'vinyl/dub-trap'] }, { rigs: ['rig/techno-drum'] });
    expect(legalActions(s, 0).some((a) => a.kind === 'swap')).toBe(false);
    s = play(s, END).state;
    expect(legalActions(s, 1).some((a) => a.kind === 'swap')).toBe(false);
  });

  it('uses an arm', () => {
    const r = play(bagged(), swap(0, 'vinyl/jz-guard'), swap(1, 'vinyl/rm-slow'));
    expect(r.state.turn.side).toBe(1);
    expect(r.state.sides[0].bag).toEqual(['vinyl/hh-strike', 'vinyl/dub-trap', 'vinyl/cl-wall']);
  });
});
