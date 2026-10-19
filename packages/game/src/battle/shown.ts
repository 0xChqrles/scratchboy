// The displayed state: what the HUD shows while the scene plays a step's events. Each event's
// resulting values (hp, shield, cooldown…) are copied in when its animation lands; nothing is
// worked out here. After a step's last event the store replaces it with the view itself.
import type { BattleEvent, BattleState, RigState, SideIndex } from '@scratchboy/core';

function rigAt(state: BattleState, side: SideIndex, rig: number): RigState {
  const found = state.sides[side].rigs[rig];
  if (!found) throw new Error(`no rig ${rig} on side ${side}`);
  return found;
}

/** The displayed state with one event's resulting values applied. Never mutates `shown`. */
export function applyEvent(shown: BattleState, event: BattleEvent): BattleState {
  const next = structuredClone(shown);
  switch (event.type) {
    case 'hit':
      rigAt(next, event.side, event.rig).hp = event.hp;
      break;
    case 'blocked':
    case 'shield-raised':
      rigAt(next, event.side, event.rig).shield = event.shield;
      break;
    case 'shield-faded':
      rigAt(next, event.side, event.rig).shield = 0;
      break;
    case 'trap-set':
      // Own traps show where they are; the other side's only count up.
      if (event.rig !== null) rigAt(next, event.side, event.rig).trap = { payload: [] };
      else next.sides[event.side].hiddenTraps += 1;
      break;
    case 'trap-fired': {
      const fighter = next.sides[event.side];
      const trapped = rigAt(next, event.side, event.rig);
      if (trapped.trap !== null) trapped.trap = null;
      else fighter.hiddenTraps = Math.max(0, fighter.hiddenTraps - 1);
      break;
    }
    case 'stunned':
      rigAt(next, event.side, event.rig).cooldown = event.cooldown;
      break;
    case 'slowed':
      next.sides[event.side].slowTurns = event.turns;
      break;
    case 'hasted':
      next.sides[event.side].hasteTurns = event.turns;
      break;
    case 'cooldown-started':
      rigAt(next, event.side, event.rig).cooldown = event.turns;
      break;
    case 'cooldown-ticked':
      rigAt(next, event.side, event.rig).cooldown = event.cooldown;
      break;
    case 'rig-broken':
      // The hit before it already carried hp 0. What a broken rig still shows (no cooldown, no
      // shield) is core's rigStatus, read by the HUD and the scene.
      break;
    case 'scratched':
      next.turn.used.push(event.rig);
      break;
    case 'swapped': {
      const fighter = next.sides[event.side];
      rigAt(next, event.side, event.rig).deck = event.in;
      const slot = fighter.bag.indexOf(event.in);
      if (slot >= 0) fighter.bag[slot] = event.out;
      next.turn.used.push(event.rig);
      break;
    }
    case 'turn-started':
      // Whether this turn is slowed or hasted arrives with the step's view. Until then slowTurns and
      // hasteTurns still count this turn, so core's slowAndHasteTurns shows the same totals.
      next.turn = { number: event.turn, side: event.side, used: [], slowed: false, hasted: false };
      break;
    case 'battle-won':
      next.winner = event.side;
      break;
    case 'battle-started':
    case 'turn-ended':
      break;
  }
  return next;
}
