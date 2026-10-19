// What the player may do, read only from core's legalActions: the screen offers a level, a target,
// an ally or a swap only when one of the legal actions contains it.
import type { Action, Level } from '@scratchboy/core';

export type Scratch = Extract<Action, { kind: 'scratch' }>;
export type Swap = Extract<Action, { kind: 'swap' }>;

/** A move picked and waiting for its target (then its ally, when it needs both). */
export interface Pick {
  level: Level;
  target: number | null;
}

export function scratchesOf(actions: readonly Action[], rig: number, level: Level): Scratch[] {
  return actions.filter((a): a is Scratch => a.kind === 'scratch' && a.rig === rig && a.level === level);
}

export function swapsOf(actions: readonly Action[], rig: number): Swap[] {
  return actions.filter((a): a is Swap => a.kind === 'swap' && a.rig === rig);
}

export function canEnd(actions: readonly Action[]): boolean {
  return actions.some((a) => a.kind === 'end');
}

/** Whether the rig can take any interaction right now (a scratch or a swap). */
export function rigCanAct(actions: readonly Action[], rig: number): boolean {
  return actions.some((a) => a.kind !== 'end' && a.rig === rig);
}

function unique(values: readonly (number | undefined)[]): number[] {
  return [...new Set(values.filter((v): v is number => v !== undefined))];
}

/** The next thing a picked move needs: a target, an ally, or nothing (the action is complete). */
export type Need =
  | { kind: 'target'; rigs: number[] }
  | { kind: 'ally'; rigs: number[] }
  | { kind: 'ready'; action: Scratch };

export function needOf(options: readonly Scratch[], pick: Pick): Need | null {
  const matching = pick.target === null ? options : options.filter((a) => a.target === pick.target);
  const first = matching[0];
  if (!first) return null;
  if (pick.target === null) {
    const targets = unique(matching.map((a) => a.target));
    if (targets.length > 0) return { kind: 'target', rigs: targets };
  }
  const allies = unique(matching.map((a) => a.ally));
  if (allies.length > 0) return { kind: 'ally', rigs: allies };
  return { kind: 'ready', action: first };
}

/** The one legal action with this ally (and the pick's target). */
export function withAlly(options: readonly Scratch[], pick: Pick, ally: number): Scratch | null {
  return options.find((a) => a.ally === ally && (pick.target === null || a.target === pick.target)) ?? null;
}

/** The one legal action with this target, when the move needs no ally. */
export function withTarget(options: readonly Scratch[], target: number): Scratch | null {
  return options.find((a) => a.target === target && a.ally === undefined) ?? null;
}
