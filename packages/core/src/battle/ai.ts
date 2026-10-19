// The computer opponent. From its own view, it tries every complete way to play the rest of its
// turn with the damage spread fixed at 100% (no random draws) and scores where each one ends. Only
// the plans tied on the best score are played again with the spread fixed at its lowest (90%); the
// one that scores best there wins, and it plays that plan's first action. Ties left go to the plan
// found first.
//
// Two plain scratches (no swap, no trap, no rig of the other side broken this turn so far) end in
// the same state whichever goes first, at either spread: a hit at 90% is never bigger than at 100%,
// so nothing breaks at 90% either. The order with the lower rig first is always found first. So a
// plan where a plain scratch follows a plain scratch of a higher rig is skipped: it can never be the
// first best plan.
import { makeScorer, type Scorer } from './ai-score.ts';
import { DAMAGE_SPREAD_PCT } from './constants.ts';
import type { Draft } from './draft.ts';
import { deckOf, moveOf, otherSide, rigOf, setsTrap, workingCount } from './facts.ts';
import { isLegal, legalActions } from './legal.ts';
import { applyInteraction } from './resolve.ts';
import { canInteract, tickCooldowns } from './turn.ts';
import type { Action, BattleState, FighterState, SideIndex } from './types.ts';
import { viewFor } from './view.ts';

/** The spread every plan is scored at, and the one tied plans are played again at. */
const FULL_SPREAD = 100;
const LOWEST_SPREAD = 100 - DAMAGE_SPREAD_PCT;

interface Search {
  me: SideIndex;
  score: Scorer;
  /** Working rigs of the other side when the decision starts. */
  standing: number;
  /** Best score from a mid-turn state (and the plain scratch that led there, if any). */
  memo: Map<string, number>;
}

/** The rig of the plain scratch just played, or -1 when the last interaction was not plain. */
type LastPlain = number;

/** Where one action leaves a plan, at full spread. */
type Next =
  /** A plain scratch after a plain scratch of a higher rig: the twin found first stands for it. */
  | { kind: 'skip' }
  /** The turn ends: the state after its cooldowns tick. */
  | { kind: 'end'; state: BattleState }
  /** The turn goes on. */
  | { kind: 'more'; state: BattleState; last: LastPlain };

export function chooseAction(state: BattleState, side: SideIndex): Action {
  const view = viewFor(state, side);
  const actions = legalActions(view, side);
  const first = actions[0];
  if (first === undefined) throw new Error(`side ${side} cannot act: not its turn, or the fight is over`);
  if (actions.length === 1) return first;
  const search: Search = {
    me: side,
    score: makeScorer(view, side),
    standing: workingCount(view.sides[otherSide(side)]),
    memo: new Map(),
  };
  const best = bestPlan(search, view, -1);
  let low = -Infinity;
  let choice = first;
  for (const action of actions) {
    const value = lowPlanValue(search, view, view, action, -1, best);
    if (value > low) {
      low = value;
      choice = action;
    }
  }
  return choice;
}

/** Plays `action` on a copy of `state`, at full spread. */
function advance(search: Search, state: BattleState, action: Action, last: LastPlain): Next {
  const draft: Draft = { state: simCopy(state), events: null, fixedSpread: FULL_SPREAD };
  if (action.kind !== 'end') {
    applyInteraction(draft, search.me, action);
    const plain =
      action.kind === 'scratch' &&
      !scratchSetsTrap(state, search.me, action) &&
      workingCount(draft.state.sides[otherSide(search.me)]) === search.standing;
    if (plain && last > action.rig) return { kind: 'skip' };
    if (draft.state.winner === null && canInteract(draft.state)) {
      return { kind: 'more', state: draft.state, last: plain ? action.rig : -1 };
    }
  }
  if (draft.state.winner === null) tickCooldowns(draft);
  return { kind: 'end', state: draft.state };
}

/** The best score at full spread of the plans that go on from `next`. */
function planValue(search: Search, next: Next): number {
  if (next.kind === 'skip') return -Infinity;
  if (next.kind === 'end') return search.score(next.state);
  return bestPlan(search, next.state, next.last);
}

function bestPlan(search: Search, state: BattleState, last: LastPlain): number {
  const key = `${last}|${stateKey(state)}`;
  const known = search.memo.get(key);
  if (known !== undefined) return known;
  let best = -Infinity;
  for (const action of legalActions(state, search.me)) {
    best = Math.max(best, planValue(search, advance(search, state, action, last)));
  }
  search.memo.set(key, best);
  return best;
}

/**
 * The best score at the lowest spread of the plans that start with `action` and score `target` at
 * full spread; -Infinity when none does. `state` is where the plan so far stands at full spread,
 * `low` where it stands at the lowest spread. At the lowest spread a plan plays its actions while
 * they are legal and the fight goes on, then the turn ends.
 */
function lowPlanValue(
  search: Search,
  state: BattleState,
  low: BattleState,
  action: Action,
  last: LastPlain,
  target: number,
): number {
  const next = advance(search, state, action, last);
  if (planValue(search, next) !== target) return -Infinity;
  const draft: Draft = { state: simCopy(low), events: null, fixedSpread: LOWEST_SPREAD };
  if (action.kind !== 'end' && isLegal(draft.state, search.me, action)) {
    applyInteraction(draft, search.me, action);
    if (next.kind === 'more' && draft.state.winner === null && canInteract(draft.state)) {
      let best = -Infinity;
      for (const then of legalActions(next.state, search.me)) {
        best = Math.max(best, lowPlanValue(search, next.state, draft.state, then, next.last, target));
      }
      return best;
    }
  }
  if (draft.state.winner === null) tickCooldowns(draft);
  return search.score(draft.state);
}

function scratchSetsTrap(state: BattleState, side: SideIndex, action: Extract<Action, { kind: 'scratch' }>): boolean {
  return setsTrap(moveOf(deckOf(state.decks, rigOf(state, side, action.rig)), action.level));
}

/** A copy a simulation may change. Decks are never changed, so they are shared. */
function simCopy(state: BattleState): BattleState {
  return {
    rng: state.rng,
    decks: state.decks,
    sides: [fighterCopy(state.sides[0]), fighterCopy(state.sides[1])],
    turn: { ...state.turn, used: [...state.turn.used] },
    winner: state.winner,
  };
}

function fighterCopy(fighter: FighterState): FighterState {
  return { ...fighter, rigs: fighter.rigs.map((rig) => ({ ...rig })), bag: [...fighter.bag] };
}

/** Everything a mid-turn state's best plan depends on. */
function stateKey(state: BattleState): string {
  const parts: string[] = [];
  for (const fighter of state.sides) {
    parts.push(`${fighter.slowTurns},${fighter.hasteTurns}`, fighter.bag.join(','));
    for (const rig of fighter.rigs) {
      const trap = rig.trap === null ? '' : JSON.stringify(rig.trap.payload);
      parts.push(`${rig.deck},${rig.hp},${rig.cooldown},${rig.shield},${trap}`);
    }
  }
  parts.push([...state.turn.used].sort((a, b) => a - b).join(','));
  return parts.join('|');
}
