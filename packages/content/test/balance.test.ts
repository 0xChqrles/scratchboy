// Balance rule: no single hit breaks a full-HP turntable (packages/content/AGENTS.md, "Balance").
import { DAMAGE_SPREAD_PCT, GENRE_STRONG_PCT, MIX_GOOD_DAMAGE_PCT, type Deck } from '@scratchboy/core';
import { describe, expect, it } from 'vitest';
import { RIG_DECKS, TURNTABLE_HP, VINYLS } from '../src/index.ts';

/** The biggest hit a base damage can make, in millionths: the best genre (×2), a good mix (×1.25)
 *  and the top of the random spread (110%). */
function maxHitMillionths(base: number): number {
  return base * GENRE_STRONG_PCT * MIX_GOOD_DAMAGE_PCT * (100 + DAMAGE_SPREAD_PCT);
}

/** Every single hit a deck's moves can make, by its base damage: each damage effect plus the move's
 *  partner damage bonus, and each damage payload of a trap the move sets. */
function hits(deck: Deck): { move: string; base: number }[] {
  return deck.moves.flatMap((move) => {
    const bonus = move.partner?.bonus.kind === 'damage' ? move.partner.bonus.amount : 0;
    return move.effects.flatMap((effect) => {
      if (effect.kind === 'damage') return [{ move: move.id, base: effect.amount + bonus }];
      if (effect.kind === 'trap') {
        return effect.payload.flatMap((payload) => (payload.kind === 'damage' ? [{ move: move.id, base: payload.amount }] : []));
      }
      return [];
    });
  });
}

/** The hits of `decks` that can break a turntable at full HP, with their biggest damage. */
function breakingHits(decks: readonly Deck[]): { move: string; base: number; max: number }[] {
  return decks
    .flatMap(hits)
    .filter((hit) => maxHitMillionths(hit.base) >= TURNTABLE_HP * 1_000_000)
    .map((hit) => ({ ...hit, max: Math.floor(maxHitMillionths(hit.base) / 1_000_000) }));
}

describe('no single hit breaks a full-HP turntable', () => {
  it('from an opponent rig', () => {
    expect(breakingHits(RIG_DECKS)).toEqual([]);
  });

  it('from a vinyl (in PvP, turntables hit turntables)', () => {
    expect(breakingHits(VINYLS)).toEqual([]);
  });
});
