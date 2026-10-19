# content

Read the root `AGENTS.md` first; its contracts apply here. This package is the game's DATA, typed
with `core`'s types. The story and the world are in `docs/brief.md`.

# Stable rules

## Game text

- Every real-world fact the game states about an artist must be true and checkable. That covers a
  vinyl's liner note and an NPC's line. If unsure, leave the fact out or ask the owner. Never
  invent one.
- Judge generated writing harshly. Dialogue and notes are short, specific and warm. Cut filler and
  clever twists. Never put down a real person. The jokes are affectionate: Jeff Mills as an alien
  is a tribute, not a mockery.
- Exception, the owner's call: the exchange before the Riff fight is long on purpose, so long it
  almost feels like a joke. Don't shorten it.

## Story additions

The owner's story decisions beyond `docs/brief.md`:
- When the game starts, Scratch Boy has just been dumped by his girlfriend, Scratch Girl. She was
  cheating on him with a richer DJ, and left him for that DJ.

## Balance

- A fair fight against a normal opponent lasts 8 to 12 of Scratch Boy's turns. Set HP and damage
  to hit that target, measured with two players for Scratch Boy: the computer opponent's
  `chooseAction`, and a simple greedy player (each interaction: the scratch with the most expected
  damage; it never swaps).
- No single hit breaks a full-HP turntable.

# Current state

## Files

| File | Job |
|---|---|
| `src/index.ts` | Package entry: re-exports every `src/` module. |
| `src/vinyls.ts` | `VINYLS`: the 8 M1 test vinyls, as core `Deck`s (`vinyl/<slug>`, no artist yet). |
| `src/opponents.ts` | `RIG_DECKS` (opponent rigs' decks, `rig/<slug>`), `RIFF` (`opponent/riff`), `OPPONENTS`. |
| `src/player.ts` | `SCRATCH_BOY`: the starting profile. 2 turntables of `TURNTABLE_HP` (80), boom-bap and block-party loaded, the other 6 vinyls in the bag. |
| `src/fights.ts` | `FIGHTS`: dev fight fixtures, slug -> `(seed) => BattleSetup`. Scratch Boy is side 0; `decks` holds every deck the two sides use. |
| `src/talk.ts` | `FIGHT_INTROS`: fight slug -> the lines said before it starts (`Line`: a speaker's fighter id, a locale key). Riff's 20 lines with Scratch Boy tell the Scratch Girl story. |
| `src/locales.ts` | `LOCALES`: player-facing text by locale. Key = the id with `/` turned into `.` (`vinyl.boom-bap`, `move.boom-bap-1`, `fighter.scratch-boy`); genres are `genre.<id>`; dialogue lines are `talk.<fight>-<n>`. |
| `src/locales/fr.json`, `src/locales/en.json` | The text. Both hold the same keys. French is the first language. |
| `src/palette.ts` | `PALETTE`: the one colour palette for sprites and UI. |
| `art/` | Sprites drawn by code (`art/sprites/<name>.ts`) and the sprite build (`art/build.ts`). |
| `assets/` | Built assets. Each one has a `<name>.source.json` beside it with its `source` and `license`. |
| `test/content.test.ts` | Ids, deck references, three moves per deck, text in both locales (speakers' names and dialogue lines too). |
| `test/assets.test.ts` | Every asset has a source record. |
| `test/fights.test.ts` | Every fight fixture passes core's `createBattle`; every intro belongs to a fight and is said by its fighters. |
| `test/balance.test.ts` | No single hit breaks a full-HP turntable: every damage effect (plus its partner bonus) and trap damage of each opponent rig and each vinyl, at ×2 genre, ×1.25 mix and 110% spread, stays below `TURNTABLE_HP`. |

No content hash yet.

## Commands

- `pnpm --filter @scratchboy/content test`: the content tests (Vitest).
- `pnpm --filter @scratchboy/content typecheck`: `src/` without Node types, then `src/`, `art/` and
  `test/` with them, so a Node API in `src/` fails the first pass.
- `pnpm --filter @scratchboy/content art [name ...] [--preview <dir>]`: builds `art/sprites/` into
  `assets/sprites/` (PNG sheet, Aseprite JSON, source record).
