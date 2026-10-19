// What an interaction does: a scratch (cooldown, traps it sets off, then its effects in order) or a
// swap. The action is assumed legal; callers check it first.
import { cooldownFor } from './cooldown.ts';
import { hitRig } from './damage.ts';
import { emit, type Draft } from './draft.ts';
import { deckOf, isWorking, moveOf, otherSide, partnerDamage, rigOf, type RigRef } from './facts.ts';
import type { Action, Effect, Move, SideIndex, TrapEffect } from './types.ts';

type Scratch = Extract<Action, { kind: 'scratch' }>;
type Swap = Extract<Action, { kind: 'swap' }>;

export function applyInteraction(draft: Draft, side: SideIndex, action: Scratch | Swap): void {
  if (action.kind === 'scratch') scratch(draft, side, action);
  else swap(draft, side, action);
}

function scratch(draft: Draft, side: SideIndex, action: Scratch): void {
  const state = draft.state;
  const fighter = state.sides[side];
  const rig = rigOf(state, side, action.rig);
  const move = moveOf(deckOf(state.decks, rig), action.level);
  state.turn.used.push(action.rig);
  emit(draft, { type: 'scratched', side, rig: action.rig, level: action.level, move: move.id });

  const turns = cooldownFor(state.decks, fighter, action.rig, action.level, state.turn.slowed, state.turn.hasted);
  rig.cooldown = turns;
  emit(draft, { type: 'cooldown-started', side, rig: action.rig, turns });

  const by: RigRef = { side, rig: action.rig };
  fireTraps(draft, by, action, move);
  if (state.winner !== null) return;

  const bonus = partnerDamage(state.decks, fighter, action.rig, move);
  for (const effect of move.effects) {
    applyEffect(draft, by, action, effect, bonus);
    if (state.winner !== null) return;
  }
}

/** The enemy rigs a move targets: the chosen target for its 'enemy' effects, every working enemy
 *  rig for its 'enemies' effects. Only damage and stun effects target rigs. */
function targetedRigs(draft: Draft, side: SideIndex, action: Scratch, move: Move): number[] {
  const rigs = draft.state.sides[otherSide(side)].rigs;
  const hit = rigs.map(() => false);
  for (const effect of move.effects) {
    if (effect.kind !== 'damage' && effect.kind !== 'stun') continue;
    if (effect.to === 'enemy') {
      if (action.target !== undefined) hit[action.target] = true;
    } else {
      rigs.forEach((rig, i) => {
        if (isWorking(rig)) hit[i] = true;
      });
    }
  }
  return hit.flatMap((isHit, i) => (isHit ? [i] : []));
}

/** Each trap on a targeted enemy rig fires, in rig order, on the scratching rig, then is gone. */
function fireTraps(draft: Draft, by: RigRef, action: Scratch, move: Move): void {
  const foe = otherSide(by.side);
  for (const index of targetedRigs(draft, by.side, action, move)) {
    const trapped = rigOf(draft.state, foe, index);
    const trap = trapped.trap;
    if (trap === null) continue;
    trapped.trap = null;
    const at: RigRef = { side: foe, rig: index };
    emit(draft, { type: 'trap-fired', side: foe, rig: index, by: { side: by.side, rig: by.rig } });
    for (const payload of trap.payload) {
      applyPayload(draft, at, by, payload);
      if (draft.state.winner !== null) return;
    }
  }
}

/** A trap's payload hits the rig that set it off (`by`); its damage comes from the trapped rig. */
function applyPayload(draft: Draft, trapped: RigRef, by: RigRef, payload: TrapEffect): void {
  switch (payload.kind) {
    case 'damage':
      hitRig(draft, trapped, by, payload.amount);
      return;
    case 'stun':
      stunRig(draft, by, payload.turns);
      return;
    case 'slow':
      slowFighter(draft, by.side, payload.turns);
      return;
  }
}

function applyEffect(draft: Draft, by: RigRef, action: Scratch, effect: Effect, bonus: number): void {
  const state = draft.state;
  const foe = otherSide(by.side);
  switch (effect.kind) {
    case 'damage':
      for (const rig of effectTargets(draft, foe, effect.to === 'enemies', action.target)) {
        hitRig(draft, by, { side: foe, rig }, effect.amount + bonus);
        if (state.winner !== null) return;
      }
      return;
    case 'stun':
      for (const rig of effectTargets(draft, foe, effect.to === 'enemies', action.target)) {
        stunRig(draft, { side: foe, rig }, effect.turns);
      }
      return;
    case 'slow':
      slowFighter(draft, foe, effect.turns);
      return;
    case 'haste': {
      const fighter = state.sides[by.side];
      fighter.hasteTurns = Math.max(fighter.hasteTurns, effect.turns);
      emit(draft, { type: 'hasted', side: by.side, turns: fighter.hasteTurns });
      return;
    }
    case 'shield':
      for (const rig of effectTargets(draft, by.side, effect.to === 'allies', action.ally)) {
        const shielded = rigOf(state, by.side, rig);
        shielded.shield += effect.amount;
        emit(draft, { type: 'shield-raised', side: by.side, rig, amount: effect.amount, shield: shielded.shield });
      }
      return;
    case 'trap': {
      if (action.ally === undefined) throw new Error('a trap needs an ally rig');
      const holder = rigOf(state, by.side, action.ally);
      if (!isWorking(holder) || holder.trap !== null) return;
      holder.trap = { payload: effect.payload.map((p) => ({ ...p })) };
      emit(draft, { type: 'trap-set', side: by.side, rig: action.ally });
      return;
    }
  }
}

/** The working rigs of `side` an effect lands on: every working rig for an 'enemies' / 'allies'
 *  effect (`all`), otherwise the chosen rig if it still works. */
function effectTargets(draft: Draft, side: SideIndex, all: boolean, chosen: number | undefined): number[] {
  const rigs = draft.state.sides[side].rigs;
  if (all) return rigs.flatMap((rig, i) => (isWorking(rig) ? [i] : []));
  if (chosen === undefined) throw new Error('the move needs a chosen rig');
  return isWorking(rigOf(draft.state, side, chosen)) ? [chosen] : [];
}

/** Stun N: N turns are added to the rig's cooldown. */
function stunRig(draft: Draft, ref: RigRef, turns: number): void {
  const rig = rigOf(draft.state, ref.side, ref.rig);
  if (!isWorking(rig)) return;
  rig.cooldown += turns;
  emit(draft, { type: 'stunned', side: ref.side, rig: ref.rig, turns, cooldown: rig.cooldown });
}

/** Slow N keeps the longer of the current and the new duration. The event carries the resulting
 *  duration, so the screen never works it out. */
function slowFighter(draft: Draft, side: SideIndex, turns: number): void {
  const fighter = draft.state.sides[side];
  fighter.slowTurns = Math.max(fighter.slowTurns, turns);
  emit(draft, { type: 'slowed', side, turns: fighter.slowTurns });
}

/** The bag vinyl goes onto the rig and the old vinyl takes its place in the bag. The rig keeps its
 *  HP, cooldown, shield and trap, and counts as used. */
function swap(draft: Draft, side: SideIndex, action: Swap): void {
  const state = draft.state;
  const fighter = state.sides[side];
  const rig = rigOf(state, side, action.rig);
  const slot = fighter.bag.indexOf(action.vinyl);
  if (slot < 0) throw new Error(`'${action.vinyl}' is not in the bag`);
  const out = rig.deck;
  rig.deck = action.vinyl;
  fighter.bag[slot] = out;
  state.turn.used.push(action.rig);
  emit(draft, { type: 'swapped', side, rig: action.rig, out, in: action.vinyl });
}
