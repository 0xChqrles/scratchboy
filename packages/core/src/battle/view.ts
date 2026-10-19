// What one side may see (root contract 8: assume players cheat).
import { cloneJson } from './draft.ts';
import { otherSide } from './facts.ts';
import type { BattleEvent, BattleState, SideIndex } from './types.ts';

/** The state as `side` sees it: the other side's traps are hidden (only their count shows, in
 *  hiddenTraps) and the generator state is 0. Viewing a view again changes nothing. The count
 *  includes traps left on broken rigs, so it only moves with the trap-set and trap-fired events
 *  `side` is shown. */
export function viewFor(state: BattleState, side: SideIndex): BattleState {
  const view = cloneJson(state);
  const other = view.sides[otherSide(side)];
  const set = other.rigs.filter((rig) => rig.trap !== null).length;
  other.hiddenTraps += set;
  for (const rig of other.rigs) rig.trap = null;
  view.rng = 0;
  return view;
}

/** The events as `side` sees them: the other side's trap-set events don't say which rig. */
export function eventsFor(events: readonly BattleEvent[], side: SideIndex): BattleEvent[] {
  return events.map((event) =>
    event.type === 'trap-set' && event.side !== side ? { ...event, rig: null } : { ...event },
  );
}
