// The M1 test vinyls: the 8 records of Scratch Boy's bag. Names live in src/locales/.
import type { Deck } from '@scratchboy/core';

export const VINYLS: readonly Deck[] = [
  {
    id: 'vinyl/boom-bap',
    genre: 'hip-hop',
    defender: false,
    moves: [
      { id: 'move/boom-bap-1', effects: [{ kind: 'damage', amount: 5, to: 'enemy' }] },
      { id: 'move/boom-bap-2', effects: [{ kind: 'damage', amount: 10, to: 'enemy' }] },
      { id: 'move/boom-bap-3', effects: [{ kind: 'damage', amount: 7, to: 'enemies' }] },
    ],
  },
  {
    id: 'vinyl/block-party',
    genre: 'hip-hop',
    defender: true,
    moves: [
      { id: 'move/block-party-1', effects: [{ kind: 'shield', amount: 8, to: 'ally' }] },
      { id: 'move/block-party-2', effects: [{ kind: 'shield', amount: 6, to: 'allies' }] },
      { id: 'move/block-party-3', effects: [{ kind: 'damage', amount: 14, to: 'enemy' }] },
    ],
  },
  {
    // Ice moves: stuns and slows.
    id: 'vinyl/cold-snap',
    genre: 'hip-hop',
    defender: false,
    moves: [
      { id: 'move/cold-snap-1', effects: [{ kind: 'stun', turns: 1, to: 'enemy' }] },
      {
        id: 'move/cold-snap-2',
        effects: [
          { kind: 'damage', amount: 6, to: 'enemy' },
          { kind: 'slow', turns: 1 },
        ],
      },
      {
        id: 'move/cold-snap-3',
        effects: [
          { kind: 'damage', amount: 8, to: 'enemy' },
          { kind: 'stun', turns: 2, to: 'enemy' },
        ],
      },
    ],
  },
  {
    id: 'vinyl/acid-line',
    genre: 'techno',
    defender: false,
    moves: [
      {
        id: 'move/acid-line-1',
        effects: [
          { kind: 'damage', amount: 4, to: 'enemy' },
          { kind: 'haste', turns: 2 },
        ],
      },
      { id: 'move/acid-line-2', effects: [{ kind: 'slow', turns: 2 }] },
      { id: 'move/acid-line-3', effects: [{ kind: 'damage', amount: 16, to: 'enemy' }] },
    ],
  },
  {
    id: 'vinyl/booby-trap',
    genre: 'techno',
    defender: false,
    moves: [
      { id: 'move/booby-trap-1', effects: [{ kind: 'trap', payload: [{ kind: 'damage', amount: 10 }] }] },
      { id: 'move/booby-trap-2', effects: [{ kind: 'trap', payload: [{ kind: 'stun', turns: 2 }] }] },
      {
        id: 'move/booby-trap-3',
        effects: [{ kind: 'damage', amount: 12, to: 'enemy' }],
        partner: { with: { genre: 'hip-hop' }, bonus: { kind: 'damage', amount: 4 } },
      },
    ],
  },
  {
    id: 'vinyl/breakbeat',
    genre: 'idm-dnb',
    defender: false,
    moves: [
      { id: 'move/breakbeat-1', effects: [{ kind: 'damage', amount: 6, to: 'enemy' }] },
      { id: 'move/breakbeat-2', effects: [{ kind: 'damage', amount: 11, to: 'enemy' }] },
      { id: 'move/breakbeat-3', effects: [{ kind: 'damage', amount: 18, to: 'enemy' }] },
    ],
  },
  {
    id: 'vinyl/plainchant',
    genre: 'sacred-chant',
    defender: false,
    moves: [
      { id: 'move/plainchant-1', effects: [{ kind: 'shield', amount: 10, to: 'ally' }] },
      { id: 'move/plainchant-2', effects: [{ kind: 'stun', turns: 1, to: 'enemies' }] },
      { id: 'move/plainchant-3', effects: [{ kind: 'damage', amount: 15, to: 'enemy' }] },
    ],
  },
  {
    id: 'vinyl/toccata',
    genre: 'classical',
    defender: false,
    moves: [
      { id: 'move/toccata-1', effects: [{ kind: 'damage', amount: 7, to: 'enemy' }] },
      { id: 'move/toccata-2', effects: [{ kind: 'damage', amount: 12, to: 'enemy' }] },
      { id: 'move/toccata-3', effects: [{ kind: 'damage', amount: 20, to: 'enemy' }] },
    ],
  },
];
