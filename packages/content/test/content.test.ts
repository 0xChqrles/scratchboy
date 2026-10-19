// Content integrity: ids, references, every deck's three moves, and text in both locales.
import { BAG_MAX, GENRES, START_TURNTABLES, type Deck, type FighterSetup } from '@scratchboy/core';
import { describe, expect, it } from 'vitest';
import { FIGHT_INTROS, FIGHTS, LOCALES, OPPONENTS, RIG_DECKS, SCRATCH_BOY, VINYLS, type Locale } from '../src/index.ts';

const DECKS: readonly Deck[] = [...VINYLS, ...RIG_DECKS];
const FIGHTERS: readonly FighterSetup[] = [SCRATCH_BOY, ...OPPONENTS];
const ID = /^[a-z]+\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugOf = (id: string): string => id.slice(id.indexOf('/') + 1);
/** Locale key of an entity id: 'vinyl/boom-bap' -> 'vinyl.boom-bap'. */
const textKey = (id: string): string => id.replace('/', '.');

function artistIds(): string[] {
  return DECKS.flatMap((deck) => [
    ...(deck.artist === undefined ? [] : [deck.artist]),
    ...deck.moves.flatMap((move) => (move.partner && 'artist' in move.partner.with ? [move.partner.with.artist] : [])),
  ]);
}

function deckRefs(fighter: FighterSetup): string[] {
  return [...fighter.rigs.map((rig) => rig.deck), ...fighter.bag];
}

describe('decks', () => {
  it('have unique ids: vinyl/<slug> for vinyls, rig/<slug> for opponent rigs', () => {
    const ids = DECKS.map((deck) => deck.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const vinyl of VINYLS) expect(vinyl.id).toMatch(/^vinyl\//);
    for (const rig of RIG_DECKS) expect(rig.id).toMatch(/^rig\//);
  });

  it('each have exactly three moves, levels 1, 2 and 3, with unique ids move/<deck-slug>-<level>', () => {
    const moveIds: string[] = [];
    for (const deck of DECKS) {
      expect(deck.moves, deck.id).toHaveLength(3);
      deck.moves.forEach((move, i) => {
        expect(move.id).toBe(`move/${slugOf(deck.id)}-${i + 1}`);
        expect(move.effects.length, move.id).toBeGreaterThan(0);
        moveIds.push(move.id);
      });
    }
    expect(new Set(moveIds).size).toBe(moveIds.length);
  });
});

describe('ids and references', () => {
  it('every id is lowercase ASCII with dashes and a kind/ prefix', () => {
    const ids = [
      ...DECKS.flatMap((deck) => [deck.id, ...deck.moves.map((move) => move.id)]),
      ...artistIds(),
      ...FIGHTERS.flatMap((fighter) => [fighter.id, ...fighter.rigs.map((rig) => rig.id), ...deckRefs(fighter)]),
    ];
    for (const id of ids) expect(id).toMatch(ID);
  });

  it('every referenced deck exists', () => {
    const known = DECKS.map((deck) => deck.id);
    for (const fighter of FIGHTERS) {
      for (const id of deckRefs(fighter)) expect(known, `${fighter.id} uses ${id}`).toContain(id);
    }
    for (const [slug, fight] of Object.entries(FIGHTS)) {
      const setup = fight(1);
      for (const [id, deck] of Object.entries(setup.decks)) expect(deck.id, `${slug}: decks key`).toBe(id);
      for (const side of setup.sides) {
        for (const id of deckRefs(side)) expect(setup.decks[id], `${slug}: ${side.id} uses ${id}`).toBeDefined();
      }
    }
  });

  it('Scratch Boy starts with START_TURNTABLES turntables and at most BAG_MAX vinyls', () => {
    expect(SCRATCH_BOY.rigs).toHaveLength(START_TURNTABLES);
    expect(SCRATCH_BOY.rigs.length + SCRATCH_BOY.bag.length).toBeLessThanOrEqual(BAG_MAX);
  });
});

describe('locales', () => {
  it('fr and en have the same keys', () => {
    expect(Object.keys(LOCALES.en).sort()).toEqual(Object.keys(LOCALES.fr).sort());
  });

  for (const locale of ['fr', 'en'] satisfies Locale[]) {
    it(`${locale} names every genre, vinyl, move, opponent, rig, artist and speaker, and has every line`, () => {
      const lines = Object.values(FIGHT_INTROS).flat();
      const keys = [
        ...GENRES.map((genre) => `genre.${genre}`),
        ...DECKS.flatMap((deck) => [deck.id, ...deck.moves.map((move) => move.id)]).map(textKey),
        ...OPPONENTS.map((opponent) => textKey(opponent.id)),
        ...artistIds().map(textKey),
        ...lines.flatMap((line) => [textKey(line.speaker), line.text]),
      ];
      const text = LOCALES[locale];
      expect(keys.filter((key) => !text[key]?.trim())).toEqual([]);
    });
  }
});
