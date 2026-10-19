// Applying one action: the only way a fight moves forward.
import { cloneJson, type Draft } from './draft.ts';
import { isLegal } from './legal.ts';
import { applyInteraction } from './resolve.ts';
import { endTurn, settleTurn } from './turn.ts';
import type { Action, BattleState, SideIndex, StepResult } from './types.ts';

/** Applies a legal action of `side` to a copy of `state`. Throws if the action is not one of
 *  `legalActions(state, side)`. Never mutates its input; the same input gives the same output. */
export function step(state: BattleState, side: SideIndex, action: Action): StepResult {
  if (!isLegal(state, side, action)) throw new Error(`illegal action for side ${side}: ${JSON.stringify(action)}`);
  const draft: Draft = { state: cloneJson(state), events: [], fixedSpread: null };
  playAction(draft, side, action);
  return { state: draft.state, events: draft.events ?? [] };
}

/** An interaction, then the turn ends by itself if nothing is left; or 'end'. */
export function playAction(draft: Draft, side: SideIndex, action: Action): void {
  if (action.kind === 'end') {
    endTurn(draft);
    return;
  }
  applyInteraction(draft, side, action);
  settleTurn(draft);
}
