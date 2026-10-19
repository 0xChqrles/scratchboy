// The turn flow: starting a turn, ending it, and ending it by itself when nothing is left to do.
import { emit, type Draft } from './draft.ts';
import { isReady, isWorking, otherSide } from './facts.ts';
import type { BattleState, SideIndex } from './types.ts';

/** Whether the side on turn may still interact: an arm is free and one of its rigs is ready. */
export function canInteract(state: BattleState): boolean {
  const { side, used } = state.turn;
  const fighter = state.sides[side];
  if (used.length >= fighter.arms) return false;
  return fighter.rigs.some((_, i) => isReady(state, side, i));
}

/** Turn start: the side's shields fade, slow and haste are fixed for this turn, no rig is used. */
export function beginTurn(draft: Draft, side: SideIndex, number: number): void {
  const state = draft.state;
  const fighter = state.sides[side];
  fighter.rigs.forEach((rig, i) => {
    if (rig.shield > 0) {
      rig.shield = 0;
      emit(draft, { type: 'shield-faded', side, rig: i });
    }
  });
  const slowed = fighter.slowTurns > 0;
  if (slowed) fighter.slowTurns -= 1;
  const hasted = fighter.hasteTurns > 0;
  if (hasted) fighter.hasteTurns -= 1;
  state.turn = { number, side, used: [], slowed, hasted };
  emit(draft, { type: 'turn-started', side, turn: number });
}

/** Turn end, first half: every working rig of the side on turn that did not act and is cooling
 *  loses 1 turn of cooldown. */
export function tickCooldowns(draft: Draft): void {
  const { side, used } = draft.state.turn;
  draft.state.sides[side].rigs.forEach((rig, i) => {
    if (isWorking(rig) && !used.includes(i) && rig.cooldown > 0) {
      rig.cooldown -= 1;
      emit(draft, { type: 'cooldown-ticked', side, rig: i, cooldown: rig.cooldown });
    }
  });
}

/** Ends the current turn and starts the other side's. A turn in which its side can't interact
 *  ends by itself, so this repeats until a side can interact. It always stops: a side that can't
 *  interact has every working rig cooling, and each of those loses a turn here. */
export function endTurn(draft: Draft): void {
  for (;;) {
    const { side, number } = draft.state.turn;
    tickCooldowns(draft);
    emit(draft, { type: 'turn-ended', side });
    beginTurn(draft, otherSide(side), number + 1);
    if (canInteract(draft.state)) return;
  }
}

/** After an interaction: the turn ends by itself once every arm is used or nothing is ready. */
export function settleTurn(draft: Draft): void {
  if (draft.state.winner === null && !canInteract(draft.state)) endTurn(draft);
}
