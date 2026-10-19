// Which actions a side may take right now.
import {
  deckOf,
  enemyTargets,
  isReady,
  isWorking,
  LEVELS,
  moveOf,
  needsAlly,
  needsTarget,
  otherSide,
  rigOf,
  setsTrap,
} from './facts.ts';
import type { Action, BattleState, Level, SideIndex } from './types.ts';

type Scratch = Extract<Action, { kind: 'scratch' }>;

/** Every legal action of `side`, in a fixed order: scratches by rig, level, target, ally; then
 *  swaps by rig and bag order; then 'end'. Empty when it is not that side's turn or the fight is over. */
export function legalActions(state: BattleState, side: SideIndex): Action[] {
  if (state.winner !== null || state.turn.side !== side) return [];
  const fighter = state.sides[side];
  const actions: Action[] = [];
  if (state.turn.used.length < fighter.arms) {
    const indexes = fighter.rigs.map((_, i) => i);
    const ready = indexes.filter((i) => isReady(state, side, i));
    const targets = enemyTargets(state.decks, state.sides[otherSide(side)]);
    const allies = indexes.filter((i) => isWorking(rigOf(state, side, i)));
    const trapFree = allies.filter((i) => rigOf(state, side, i).trap === null);
    for (const rig of ready) {
      const deck = deckOf(state.decks, rigOf(state, side, rig));
      for (const level of LEVELS) {
        const move = moveOf(deck, level);
        const targetChoices: (number | null)[] = needsTarget(move) ? targets : [null];
        const allyChoices: (number | null)[] = needsAlly(move) ? (setsTrap(move) ? trapFree : allies) : [null];
        for (const target of targetChoices) {
          for (const ally of allyChoices) actions.push(scratchAction(rig, level, target, ally));
        }
      }
    }
    const vinyls = fighter.bag.filter((id, i) => fighter.bag.indexOf(id) === i);
    for (const rig of ready) {
      for (const vinyl of vinyls) actions.push({ kind: 'swap', rig, vinyl });
    }
  }
  actions.push({ kind: 'end' });
  return actions;
}

function scratchAction(rig: number, level: Level, target: number | null, ally: number | null): Scratch {
  const action: Scratch = { kind: 'scratch', rig, level };
  if (target !== null) action.target = target;
  if (ally !== null) action.ally = ally;
  return action;
}

/** Whether `action` is exactly one of the legal actions: same fields, same values, nothing extra. */
export function isLegal(state: BattleState, side: SideIndex, action: Action): boolean {
  if (typeof action !== 'object' || action === null) return false;
  const given = action as unknown as Record<string, unknown>;
  const givenKeys = Object.keys(given);
  return legalActions(state, side).some((legal) => {
    const fields = legal as unknown as Record<string, unknown>;
    const keys = Object.keys(fields);
    return keys.length === givenKeys.length && keys.every((key) => given[key] === fields[key]);
  });
}
