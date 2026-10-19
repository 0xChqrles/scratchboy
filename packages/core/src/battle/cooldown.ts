// The cooldown rule: how many of its owner's turns a rig sits out after a scratch.
import {
  HASTE_COOLDOWN,
  MIN_COOLDOWN,
  MIX_CLASH_COOLDOWN,
  MIX_GOOD_COOLDOWN,
  PARTNER_COOLDOWN,
  SLOW_COOLDOWN,
} from './constants.ts';
import { deckOf, mixAt, moveOf, partnerCooldown } from './facts.ts';
import type { Deck, FighterState, Level } from './types.ts';

/** The cooldown a level-`level` scratch on rig `index` starts: the level, adjusted for slow, haste,
 *  the rig's mix and a met cooldown partner bonus, and never below MIN_COOLDOWN. */
export function cooldownFor(
  decks: Record<string, Deck>,
  fighter: FighterState,
  index: number,
  level: Level,
  slowed: boolean,
  hasted: boolean,
): number {
  const rig = fighter.rigs[index];
  if (rig === undefined) throw new Error(`no rig ${index}`);
  const move = moveOf(deckOf(decks, rig), level);
  let turns: number = level;
  if (slowed) turns += SLOW_COOLDOWN;
  if (hasted) turns += HASTE_COOLDOWN;
  const mix = mixAt(decks, fighter, index);
  if (mix === 'clash') turns += MIX_CLASH_COOLDOWN;
  else if (mix === 'good') turns += MIX_GOOD_COOLDOWN;
  if (partnerCooldown(decks, fighter, index, move)) turns += PARTNER_COOLDOWN;
  return Math.max(MIN_COOLDOWN, turns);
}
