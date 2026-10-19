// Read-only answers for the screen, so it never computes a rule itself.
import type { Mix } from '../genres.ts';
import { cooldownFor } from './cooldown.ts';
import { damageAmount } from './damage.ts';
import { deckOf, isReady, isWorking, mixAt, moveOf, otherSide, partnerDamage, rigOf } from './facts.ts';
import type { BattleState, Level, SideIndex } from './types.ts';

/** Working, not cooling, and not yet used this turn. */
export function rigReady(state: BattleState, side: SideIndex, rig: number): boolean {
  rigOf(state, side, rig);
  return isReady(state, side, rig);
}

/** What a rig is now, for the screen: broken, cooling, used this turn, or ready. */
export interface RigStatus {
  state: 'broken' | 'cooling' | 'used' | 'ready';
  /** Own turns it still sits out. 0 when broken: a broken rig loses its cooldown. */
  cooldown: number;
  /** 0 when broken: a broken rig loses its shield. */
  shield: number;
}

/** The rig's status. A rig at 0 HP shows as broken, with no cooldown or shield, even in a state
 *  whose other fields still hold them (a screen's displayed state between two events). */
export function rigStatus(state: BattleState, side: SideIndex, rig: number): RigStatus {
  const found = rigOf(state, side, rig);
  if (!isWorking(found)) return { state: 'broken', cooldown: 0, shield: 0 };
  const { cooldown, shield } = found;
  if (cooldown > 0) return { state: 'cooling', cooldown, shield };
  const used = state.turn.side === side && state.turn.used.includes(rig);
  return { state: used ? 'used' : 'ready', cooldown, shield };
}

/** How many more interactions the side can make this turn: one per free arm, and no more than its
 *  ready rigs (each rig takes one interaction per turn). 0 off its turn and once the fight is over. */
export function armsLeft(state: BattleState, side: SideIndex): number {
  if (state.winner !== null || state.turn.side !== side) return 0;
  const fighter = state.sides[side];
  const ready = fighter.rigs.filter((_, i) => isReady(state, side, i)).length;
  return Math.max(0, Math.min(fighter.arms - state.turn.used.length, ready));
}

/** The fighter's own turns still slowed and hasted, its current turn included when it is one. */
export function slowAndHasteTurns(state: BattleState, side: SideIndex): { slow: number; haste: number } {
  const fighter = state.sides[side];
  const onTurn = state.turn.side === side;
  return {
    slow: fighter.slowTurns + (onTurn && state.turn.slowed ? 1 : 0),
    haste: fighter.hasteTurns + (onTurn && state.turn.hasted ? 1 : 0),
  };
}

/** How the rig's deck mixes with its owner's other working rigs. */
export function rigMix(state: BattleState, side: SideIndex, rig: number): Mix {
  rigOf(state, side, rig);
  return mixAt(state.decks, state.sides[side], rig);
}

/** The cooldown that scratch would start now. Off its turn, a side's slow and haste are the ones
 *  its next turn will have. */
export function scratchCooldown(state: BattleState, side: SideIndex, rig: number, level: Level): number {
  rigOf(state, side, rig);
  const fighter = state.sides[side];
  const onTurn = state.turn.side === side;
  const slowed = onTurn ? state.turn.slowed : fighter.slowTurns > 0;
  const hasted = onTurn ? state.turn.hasted : fighter.hasteTurns > 0;
  return cooldownFor(state.decks, fighter, rig, level, slowed, hasted);
}

/** The damage the move's damage effects would do to `targetRig` of the other side, with the spread
 *  at 100% and before shields. */
export function expectedDamage(
  state: BattleState,
  side: SideIndex,
  rig: number,
  level: Level,
  targetRig: number,
): number {
  const fighter = state.sides[side];
  const attacker = deckOf(state.decks, rigOf(state, side, rig));
  const target = deckOf(state.decks, rigOf(state, otherSide(side), targetRig));
  const move = moveOf(attacker, level);
  const bonus = partnerDamage(state.decks, fighter, rig, move);
  const mix = mixAt(state.decks, fighter, rig);
  let total = 0;
  for (const effect of move.effects) {
    if (effect.kind === 'damage') total += damageAmount(effect.amount + bonus, attacker.genre, target.genre, mix, 100);
  }
  return total;
}
