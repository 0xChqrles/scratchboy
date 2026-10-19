// Fight fixtures for dev URLs: a fixture slug -> the fight it starts, for a given seed.
import type { BattleSetup, Deck, FighterSetup } from '@scratchboy/core';
import { RIFF, RIG_DECKS } from './opponents.ts';
import { SCRATCH_BOY } from './player.ts';
import { VINYLS } from './vinyls.ts';

const ALL_DECKS = new Map<string, Deck>([...VINYLS, ...RIG_DECKS].map((deck) => [deck.id, deck]));

/** Scratch Boy is side 0. `decks` holds every deck the two fighters load or carry. */
function fight(seed: number, opponent: FighterSetup): BattleSetup {
  const sides: [FighterSetup, FighterSetup] = [SCRATCH_BOY, opponent];
  const decks: Record<string, Deck> = {};
  for (const side of sides) {
    for (const id of [...side.rigs.map((rig) => rig.deck), ...side.bag]) {
      const deck = ALL_DECKS.get(id);
      if (!deck) throw new Error(`fight fixture: ${side.id} uses unknown deck '${id}'`);
      decks[id] = deck;
    }
  }
  return { seed, decks, sides };
}

export const FIGHTS: Readonly<Record<string, (seed: number) => BattleSetup>> = {
  riff: (seed) => fight(seed, RIFF),
};
