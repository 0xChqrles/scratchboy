// Scratch Boy's starting profile.
import { SCRATCH_BOY_ARMS, type FighterSetup } from '@scratchboy/core';

export const TURNTABLE_HP = 80;

/** One turntable per entry, START_TURNTABLES in all; each starts with this vinyl loaded. */
const LOADED = ['vinyl/boom-bap', 'vinyl/block-party'];

export const SCRATCH_BOY: FighterSetup = {
  id: 'fighter/scratch-boy',
  arms: SCRATCH_BOY_ARMS,
  initiative: 5,
  rigs: LOADED.map((deck, i) => ({ id: `turntable/${i + 1}`, hp: TURNTABLE_HP, deck })),
  bag: [
    'vinyl/cold-snap',
    'vinyl/acid-line',
    'vinyl/booby-trap',
    'vinyl/breakbeat',
    'vinyl/plainchant',
    'vinyl/toccata',
  ],
};
