// Computer opponents and the decks of their rigs. Opponent rigs carry their own moves and never swap.
import type { Deck, FighterSetup } from '@scratchboy/core';

/** Every opponent rig's deck: what gives each instrument its 3 moves. */
export const RIG_DECKS: readonly Deck[] = [
  {
    id: 'rig/riff-guitar',
    genre: 'rock-metal',
    defender: false,
    moves: [
      { id: 'move/riff-guitar-1', effects: [{ kind: 'damage', amount: 6, to: 'enemy' }] },
      { id: 'move/riff-guitar-2', effects: [{ kind: 'damage', amount: 5, to: 'enemies' }] },
      { id: 'move/riff-guitar-3', effects: [{ kind: 'damage', amount: 16, to: 'enemy' }] },
    ],
  },
  {
    id: 'rig/riff-amp',
    genre: 'rock-metal',
    defender: true,
    moves: [
      { id: 'move/riff-amp-1', effects: [{ kind: 'shield', amount: 10, to: 'ally' }] },
      { id: 'move/riff-amp-2', effects: [{ kind: 'trap', payload: [{ kind: 'damage', amount: 8 }] }] },
      {
        id: 'move/riff-amp-3',
        effects: [
          { kind: 'stun', turns: 1, to: 'enemy' },
          { kind: 'damage', amount: 8, to: 'enemy' },
        ],
      },
    ],
  },
];

/** Riff, a metal guitarist. A normal character: one arm. */
export const RIFF: FighterSetup = {
  id: 'opponent/riff',
  arms: 1,
  initiative: 4,
  rigs: [
    { id: 'rig/riff-guitar', hp: 60, deck: 'rig/riff-guitar' },
    { id: 'rig/riff-amp', hp: 120, deck: 'rig/riff-amp' },
  ],
  bag: [],
};

export const OPPONENTS: readonly FighterSetup[] = [RIFF];
