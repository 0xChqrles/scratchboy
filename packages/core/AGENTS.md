# core

Read the root `AGENTS.md` first; its contracts apply here. This package is the game's RULES: pure
TypeScript that runs unchanged in the game, the server and the tests.

# Stable rules

## Combat rules

Constants live in `src/battle/constants.ts` unless a line names another file.

Fighters and rigs
- Every fighter has 1 to 4 rigs (`MIN_RIGS = 1`, `MAX_RIGS = 4`). A rig has its own HP and 3
  moves, at levels 1, 2 and 3 (`MOVE_LEVELS = 3`).
- Scratch Boy's rigs are his turntables. A turntable's moves are those of the vinyl loaded on it.
  He starts the game with 2 turntables and can own up to 4 (`START_TURNTABLES = 2`,
  `MAX_TURNTABLES = 4`).
- A computer opponent's rigs (a guitar, an amp, a band member…) carry their own moves and never
  swap.
- A rig at 0 HP is broken for the rest of the fight. Attacks damage turntables, never vinyls.
- A fighter loses the moment all its rigs are broken. The fight ends at once.
- A rig's genre is its loaded vinyl's genre, or for an opponent rig, its own genre.

Genres
- 10 genres, ids in `src/genres.ts`: `hip-hop`, `techno`, `idm-dnb`, `jazz-blues`, `rock-metal`,
  `classical`, `sacred-chant`, `pop-funk`, `world-shamanic`, `reggae-dub`.
- Each genre beats 2 genres and loses to 2. If A beats B, A's moves on a B rig do ×2 and B's moves
  on an A rig do ×½. The beats chart and the mix chart (11 good pairs; 5 clashes, one per genre)
  are in `src/genres.ts`.

The bag
- Scratch Boy carries up to 8 vinyls in his bag, counting the ones on his turntables
  (`BAG_MAX = 8`). In a fight he swaps from the bag. Before the fight he picks which vinyls start
  on his turntables. Every turntable starts loaded.

Turns
- Each fighter has an initiative stat. The higher initiative takes the first turn; a tie is settled
  by a coin flip from the fight's seed. Then the sides alternate.
- In its turn, a fighter makes up to one interaction per arm. Scratch Boy has 2 arms
  (`SCRATCH_BOY_ARMS = 2`). An opponent's arms are in its data: normal characters and bosses
  differ.
- An interaction is a scratch (one of a rig's 3 moves) or, for Scratch Boy, a swap.
- Only a ready rig can be touched: not cooling (its vinyl is back in its rest position) and not
  broken. Each rig takes at most one interaction per turn, so two arms work two different rigs.
- Interactions resolve one at a time, in the order the fighter picks.
- A swap puts a bag vinyl on a ready turntable. The vinyl it replaces goes back to the bag. The
  turntable keeps its HP, cooldown, shield and trap. The new vinyl first scratches next turn.
- A fighter may end its turn at any time, after any number of interactions. With nothing ready,
  ending the turn is the only option, so the turn ends by itself.

Cooldowns
- A level-N scratch sets that rig's cooldown to N, then adjusts it: +1 if the fighter is slowed
  (`SLOW_COOLDOWN = 1`), −1 if hasted (`HASTE_COOLDOWN = -1`), +1 for a mix clash
  (`MIX_CLASH_COOLDOWN = 1`), −1 for a good mix (`MIX_GOOD_COOLDOWN = -1`), −1 for a cooldown
  partner bonus (`PARTNER_COOLDOWN = -1`).
- A cooldown never goes below 1 turn (`MIN_COOLDOWN = 1`).
- The cooldown counts the owner's turns the rig sits out. It drops by 1 at the end of each of the
  owner's turns in which that rig did not act. The counter belongs to the turntable slot, not the
  vinyl. Example: level 2 on turntable A in your turn 1; A sits out your turns 2 and 3; A is ready
  on your turn 4.

Damage
- Damage = base damage × genre multiplier × mix multiplier × random spread, rounded down once at
  the end, and at least 1 (`MIN_DAMAGE = 1`).
- Genre multiplier: the attacking rig's genre against the target rig's genre. ×2 strong, ×½ weak,
  ×1 otherwise (`GENRE_STRONG_PCT = 200`, `GENRE_WEAK_PCT = 50`). The chart is in
  `src/genres.ts`.
- Mix multiplier: ×1.25 for a good mix, ×0.75 for a clash (`MIX_GOOD_DAMAGE_PCT = 125`,
  `MIX_CLASH_DAMAGE_PCT = 75`).
- Random spread: a whole percent from 90 to 110, drawn from the fight's seed
  (`DAMAGE_SPREAD_PCT = 10`).
- A shield soaks damage before HP does.

Targeting
- The attacker picks the target rig. Some moves hit every rig of the other side.
- Defenders: some vinyls (and some opponent rigs) are defenders. While a fighter has a working
  defender rig, a single-target move aimed at that fighter must target a defender rig. Moves that
  hit every rig still hit them all.

Move kinds. A move carries one or more effects.
- Attack: damage to one target rig, or to every rig of the other side.
- Block: a shield of N points on one of your rigs, or on all of them. It soaks damage until the
  start of your next turn, then it's gone. Shields on the same rig add up.
- Trap: set, hidden, on one of your working turntables, which can differ from the one that
  scratched. The opponent sees that a trap was set, not where.
  The first opponent move that targets that turntable sets it off: the trap's effect hits the rig
  that made the move, before the move resolves. Then the trap is gone. One trap per turntable.
- Stun N: the target rig sits out its owner's next N turns, even if it was ready (N is added to its
  cooldown).
- Slow N: for the target fighter's next N turns, every cooldown it starts lasts 1 turn longer.
  Haste N is the mirror: 1 turn shorter. Applying it again keeps the longer duration.

Bad mixes are weak, two ways
- Partner effects: a move can carry a bonus (extra damage, or 1 turn off its cooldown) that applies
  while a rig of a given genre (or a vinyl of a given artist) sits on another of the owner's
  working rigs.
- Mix rule: every rig (a loaded vinyl, or an opponent's own rig) is checked against the owner's
  other working rigs, using the mix chart in `src/genres.ts`. Any clash gives it the clash effect
  (cooldown +1, damage ×0.75). Otherwise, any good mix gives it the good effect (cooldown −1,
  damage ×1.25). The same genre counts as a good mix.

Hidden information and the computer opponent
- `viewFor(state, side)` is what one side may see: the other side's hidden traps and the random
  generator's state are left out (root contract 8: assume players cheat).
- `chooseAction(state, side)` looks one turn ahead. It scores every legal way to play its turn by
  the resulting state, counting the random spread at 100%, and plays the best. Among plans that
  score the same, it plays the one whose result still holds at the lowest spread (90%). It decides
  from its view, never from the full state.

# Current state

## Files

| File | Job |
|---|---|
| `src/index.ts` | Package entry: the battle API, its types and constants, the genre charts, the generator. |
| `src/genres.ts` | Genre ids, the beats chart and the mix chart (`genrePct`, `mixOf`). |
| `src/rng.ts` | Seeded generator (mulberry32); its whole state is one number kept in the battle state. |
| `src/battle/types.ts` | Plain-JSON shapes: decks, setup, state, actions, events. |
| `src/battle/constants.ts` | Combat constants. |
| `src/battle/setup.ts` | `createBattle`: checks the setup, picks who starts, starts the first turn. |
| `src/battle/legal.ts` | `legalActions`, and the exact-match check `step` uses. |
| `src/battle/step.ts` | `step`: checks the action, applies it to a copy, lets the turn end by itself. |
| `src/battle/turn.ts` | Turn start (shields fade, slow and haste fixed), turn end (cooldown ticks), self-ending turns. |
| `src/battle/resolve.ts` | What a scratch (cooldown, traps it sets off, effects in order) and a swap do. |
| `src/battle/damage.ts` | The damage formula, and one hit: shield, HP, breaking, winning. A broken rig loses its cooldown and shield but keeps its trap, which can never go off. |
| `src/battle/cooldown.ts` | The cooldown a scratch starts. |
| `src/battle/facts.ts` | Shared reads: readiness, mix, partner bonuses, defender targets, what a move needs. |
| `src/battle/draft.ts` | The working copy a step resolves on; JSON cloning. |
| `src/battle/view.ts` | `viewFor`, `eventsFor`: what one side may see. The other side's `hiddenTraps` counts traps on broken rigs too, so it moves only with the `trap-set` and `trap-fired` events that side is shown. |
| `src/battle/query.ts` | Screen helpers: `rigReady`, `rigMix`, `scratchCooldown`, `expectedDamage`. |
| `src/battle/ai.ts` | `chooseAction`: tries every way to play the rest of the turn, from the side's view, at a 100% spread, then plays the plans tied on the best score again at 90%. Ties left go to the plan found first. |
| `src/battle/ai-score.ts` | How the computer opponent scores the state a turn would end in: enemy rigs broken this turn first, then HP-sized points (damage, likely incoming hits, future turns, slows, hastes, traps). |
| `test/fixtures.ts` | Test vinyls and opponent rigs (never the real catalogue), setup and play helpers, `randomFight`, and the `FIGHTS` used for whole-fight checks. |
| `test/setup.test.ts` | `createBattle`: every setup check, who starts, the first events. |
| `test/turns.test.ts` | Arms, ending the turn (by choice and by itself), swaps. |
| `test/cooldowns.test.ts` | Cooldown counting, the cooldown a scratch starts, slow and haste, stun. |
| `test/damage.test.ts` | The damage formula, breaking a rig, shields, targeting and defenders, `expectedDamage`. |
| `test/traps.test.ts` | Setting a trap, what each side may see (also when a trapped turntable breaks), a trap going off. |
| `test/legal.test.ts` | `legalActions` against a rule oracle (exact list and order), and `step` refusing every other action. |
| `test/win.test.ts` | Breaking the last rig ends the fight at once; nothing happens after. |
| `test/contract.test.ts` | Whole fights: determinism, no input changes, plain JSON, invariants in every state (including hidden-trap counts that move only with the events each side sees). |
| `test/ai.test.ts` | `chooseAction`: legal, sensible (kills, the kill that still holds at 90%, strong-genre targets, no early end), view-only, fast. |
| `test/purity.test.ts` | `src/` has no clock, global randomness, I/O or Node API. |
| `test/golden/*.json` | Golden replays, built from the test decks: the setup (`seed`, `decks`, `sides`), then each action with the side that played it and the exact events it emits, then the final state without `decks`. `server` is to replay the same files (root Testing rule). |
| `test/golden.test.ts` | Replays every golden file with `createBattle` and `step`, and checks the exact event log and final state, byte for byte. |

## Commands

- `pnpm --filter @scratchboy/core test`: the rule tests (Vitest).
- `pnpm --filter @scratchboy/core typecheck`: `src/` without Node types, then `src/` and `test/`
  with them.
