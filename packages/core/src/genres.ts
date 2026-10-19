import { GENRE_STRONG_PCT, GENRE_WEAK_PCT } from './battle/constants.ts';

export const GENRES = [
  'hip-hop',
  'techno',
  'idm-dnb',
  'jazz-blues',
  'rock-metal',
  'classical',
  'sacred-chant',
  'pop-funk',
  'world-shamanic',
  'reggae-dub',
] as const;

export type Genre = (typeof GENRES)[number];

// Each genre beats 2 genres and loses to 2.
export const BEATS: Readonly<Record<Genre, readonly [Genre, Genre]>> = {
  'hip-hop': ['techno', 'classical'],
  techno: ['jazz-blues', 'idm-dnb'],
  'jazz-blues': ['classical', 'pop-funk'],
  classical: ['idm-dnb', 'sacred-chant'],
  'idm-dnb': ['pop-funk', 'rock-metal'],
  'pop-funk': ['sacred-chant', 'reggae-dub'],
  'sacred-chant': ['rock-metal', 'world-shamanic'],
  'rock-metal': ['reggae-dub', 'hip-hop'],
  'reggae-dub': ['world-shamanic', 'techno'],
  'world-shamanic': ['hip-hop', 'jazz-blues'],
};

// Pairs of different genres that mix well. The same genre always mixes well.
export const GOOD_MIXES: readonly (readonly [Genre, Genre])[] = [
  ['hip-hop', 'jazz-blues'],
  ['hip-hop', 'techno'],
  ['hip-hop', 'pop-funk'],
  ['jazz-blues', 'rock-metal'],
  ['rock-metal', 'classical'],
  ['classical', 'sacred-chant'],
  ['sacred-chant', 'world-shamanic'],
  ['world-shamanic', 'reggae-dub'],
  ['reggae-dub', 'idm-dnb'],
  ['idm-dnb', 'techno'],
  ['techno', 'pop-funk'],
];

// Pairs that clash: one per genre.
export const CLASHES: readonly (readonly [Genre, Genre])[] = [
  ['hip-hop', 'rock-metal'],
  ['techno', 'sacred-chant'],
  ['pop-funk', 'world-shamanic'],
  ['jazz-blues', 'idm-dnb'],
  ['classical', 'reggae-dub'],
];

/** Damage multiplier, in percent, for a move of genre `attacker` landing on a rig of genre `target`. */
export function genrePct(attacker: Genre, target: Genre): number {
  if (BEATS[attacker].includes(target)) return GENRE_STRONG_PCT;
  if (BEATS[target].includes(attacker)) return GENRE_WEAK_PCT;
  return 100;
}

export type Mix = 'good' | 'clash' | 'neutral';

function pairIn(pairs: readonly (readonly [Genre, Genre])[], a: Genre, b: Genre): boolean {
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** How a vinyl of `genre` mixes with the genres on its owner's other working rigs. Any clash wins. */
export function mixOf(genre: Genre, others: readonly Genre[]): Mix {
  if (others.some((other) => pairIn(CLASHES, genre, other))) return 'clash';
  if (others.some((other) => other === genre || pairIn(GOOD_MIXES, genre, other))) return 'good';
  return 'neutral';
}
