// The private working copy a step resolves on. Only engine code holds a draft; what leaves the
// engine is a fresh state that shares nothing with its input.
import type { BattleEvent, BattleState } from './types.ts';

export interface Draft {
  /** Mutated in place while the step resolves. */
  state: BattleState;
  /** Where events go; null when nobody listens (the computer opponent's simulations). */
  events: BattleEvent[] | null;
  /** null: each hit draws its spread from the generator. A percent: every hit counts that spread
   *  and the generator is never drawn (the computer opponent's simulations). */
  fixedSpread: number | null;
}

export function emit(draft: Draft, event: BattleEvent): void {
  draft.events?.push(event);
}

/** Deep copy of plain JSON data (battle state is plain JSON, root contract 3). Keeps key order. */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
