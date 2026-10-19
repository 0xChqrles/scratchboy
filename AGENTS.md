# Scratch Boy

Scratch Boy is a top-down 2D pixel-art RPG. A young DJ from the hip-hop town duels musicians with
his turntables and the vinyl records he collects. It ships first as an iOS and Android app, also
runs in desktop browsers, and two players can duel each other from two devices. The owner's
original brief is `docs/brief.md` (French, word for word, never edited).

Each package has its own `packages/<pkg>/AGENTS.md`, which assumes you have read this file. How
these files are kept: see "AGENTS.md files".

# Stable rules

## How we work

The owner makes the decisions. Agents record them.
- Never invent a game-design rule. When a rule is open, ask with the AskUserQuestion tool: at most
  4 questions at a time, recommended option first with a one-line reason, only what the current
  milestone needs.
- Even when an answer looks obvious, show it and let the owner confirm.
- Write each decision down where it belongs (see "AGENTS.md files") as soon as it is made.
- For a question of taste or judgement (writing, balance, art), first ask how the owner decides it
  by hand, and turn that method into the rule. Propose a metric or a tool only when the method
  can't be automated.
- If a request is bad engineering practice, say so: the trade-off in two lines, then the better
  path.

Milestones
- Each milestone ends with a working game, passing tests and typecheck, and up-to-date AGENTS.md
  files. Then stop: summarize what was done, list the open decisions, and wait for the owner's
  go-ahead.
- The milestone order is the owner's call. Ask before changing it.

Scope
- Do what was asked, and finish it. Offer anything extra in one line, but don't start it.
- A later request never silently undoes an earlier one. If two instructions conflict, ask in one
  line.
- A result asked for once (a number, a check, a list) is given as a result. Don't turn it into a
  committed command unless asked.

Talking to the owner
- Plain words, short sentences, one idea per sentence. Start with the concrete thing (a file, a
  number, an example), then give the rule. No invented shorthand. Define a technical term in the
  same sentence.
- For a review or a problem: what's wrong, then why it matters, then what to change. Cut weak
  points instead of cramming them in.
- Report outcomes as they are. Show a failing test with its output. Name a skipped step. When
  something is done and verified, say so plainly.

Cost: every turn re-sends the whole conversation.
- Match the amount of checking to the size of the change. One decisive check (the tests of the
  package you touched, or one screenshot of the screen you changed) beats a pile of probes.
- Mechanical batch work (the same steps over many files): write ONE script. Never one subagent per
  item. Subagents are for independent judgement work, and only a few at a time.
- Send tool calls that don't depend on each other together in one message.

Git
- Branch from whatever is checked out. Never switch the owner's checkout. Never
  `git checkout main` to "get back".
- Several sessions share this working tree. Stage files by explicit path. Never use `git add -A`,
  `-a` or `.`. Read `git status --short` before you commit. Anything you didn't write belongs to
  another session: leave it alone.
- Commit only when asked. Don't create a GitHub repo, push, open PRs or create issues until told.
- Work on issue #N goes on a branch named `issue-N-short-slug`. The PR says `Refs #N`. Never merge
  a PR or close an issue.
- No agent or tool branding in branch names or PR titles. PR descriptions are short: what changed,
  how to verify it, and which AGENTS.md lines changed.

## Architecture

| Package | Job |
|---|---|
| `packages/core` | The game RULES in pure TypeScript: the battle engine, the type chart, effects, XP and levels, crate checks, seeded randomness, and the save and network message schemas. No I/O, no Phaser, no DOM, no clock. The ONE place where a rule is written. |
| `packages/content` | The game DATA, typed with `core`'s types: vinyls, artists, opponents, towns, dialogue, encounter tables, Tiled maps, sprites, MIDI tracks, SoundFonts, fonts, and the source and license of every asset. Builds one bundle with a content hash. |
| `packages/game` | The client: Phaser scenes (overworld, battle), the React UI layer, the audio engine, input (touch and keyboard) and save storage. Built with Vite. The Capacitor projects (`ios/`, `android/`) live here. |
| `packages/server` | (from M2) The PvP server: Colyseus rooms, join codes, and the fight it runs. |
| `packages/sim` | (later, lab use only) Headless computer-vs-computer fights that find broken vinyl combinations. Never writes content. |

`docs/brief.md` is the original brief. `inspiration/` holds reference images for the art direction.

Data flow: `content` uses `core`'s types. `game` and `server` import both. Nothing imports `game`
or `server`.

## Cross-package contracts

1. **Every rule lives in `core`.** Damage, cooldowns, type matchups, status effects, winning and
   losing, XP and crate limits are each one function in `core`, imported everywhere else. The game
   and the server never write their own version of a rule.
2. **`core` is deterministic.** It never uses `Math.random`, `Date.now` or I/O. Random numbers come
   from a seeded generator kept in the state. The same state and the same action always produce
   byte-identical output.
3. **State is plain JSON.** Battle state, saves and messages are plain objects: no classes, no
   `Map`s, no functions. A fight can be saved, sent over the network, replayed and compared.
4. **The engine's shape.** `legalActions(state, side)` lists the allowed moves.
   `step(state, side, action)` returns `{ state, events }`. `chooseAction(state, side)` is the
   computer opponent. Events (`hit`, `blocked`, `cooldown-started`, `turntable-broken`,
   `battle-won`…) are the ONLY things the screen animates or plays a sound for. The screen never
   works out an outcome itself.
5. **Ids are for comparing; names are for showing.** Every entity has a stable lowercase ASCII id
   with dashes (`vinyl/ice-cube-amerikkkas-most-wanted`). Display names live in data and locale
   files. Never key, compare or route anything by a display name, and never show an id to a
   player.
6. **The content hash.** The content build hashes the bundle together with `core`'s rules version.
   Saves carry this hash, and so does the PvP handshake. The server refuses a client with a
   different hash (error code `version_mismatch`), and the client tells the player to update the
   game.
7. **One save document.** The save is one versioned JSON document, checked with zod when it loads.
   Until the first public release, a save with a different version is dropped, not migrated.
8. **In PvP, the server owns the fight.** Clients send what they want to do. The server checks it
   with `legalActions`, applies it with `step`, and sends the events and the new state to both
   players. The server picks the random seed and declares the winner. A client never reports
   "I won". Assume players will cheat, and design so it doesn't matter. The server checks each
   crate against the format before the fight starts.
9. **Error codes, not statuses.** Every refusal from the server carries a stable string code, and
   the client acts on the code. A dropped connection, a timeout or a 5xx error never decides
   anything: the client reconnects, asks for the current state, and never declares a result
   itself.
10. **One pixel grid.** One game pixel is a whole number of screen pixels: use the largest
    whole-number zoom that fits. Extra screen space shows more of the world, never stretched
    pixels. The UI layer is laid out in game pixels and its root is scaled by the same zoom whenever the
    zoom changes.
    Smoothing is off everywhere (`pixelArt: true`, `image-rendering: pixelated`). Fonts are pixel
    fonts, used only at whole-number sizes.
11. **One audio module owns the AudioContext.** It starts audio on the first tap, and it is the
    only code that talks to the synth. A track is `{ midi, pack }`. Anything that plays music asks
    this module for a track.
12. **Every asset has a recorded source.** Each sprite, tileset, MIDI file, SoundFont and font has
    its source and license written beside it. A content test fails if an asset has none. Licenses
    ship together with the assets they cover.

## Stack

| What | Choice |
|---|---|
| Language | TypeScript, `strict`, everywhere (`tsconfig.base.json`) |
| Monorepo | pnpm workspaces; pnpm's version pinned in the root `packageManager` field |
| Game engine | Phaser + Vite |
| Menus, dialogue, inventory, battle commands | React + zustand, as a DOM layer on top of the canvas |
| Mobile | Capacitor wraps the same web build |
| Desktop | The web build in a browser (installable as a PWA). An installed app (Tauri) only if needed, e.g. for Steam |
| Maps | Tiled, JSON export |
| Sprites | Aseprite sprite sheets + JSON |
| Music | MIDI tracks, never audio files, played through SoundFont files (.sf2/.sf3) by a Web Audio SoundFont synth. One SoundFont per genre, 20 to 30 packs (techno, classical, hip-hop, rap, electronic, acid, pop, rock, metal, jazz, blues…). Towns, fights and the collection screen share one audio engine |
| PvP server | Node + Colyseus, used only to carry messages; the fight runs on `core` |
| Untrusted input | zod schemas: saves and network messages are checked when they arrive |
| Tests | Vitest, plus Playwright for browser screenshots and smoke runs |

- Exact versions are pinned in each `package.json`. `.node-version` holds the current Node LTS.
- Audio spike, before any music is built on a library (start of M4): in a desktop browser and a
  phone browser, prove that it plays a MIDI file through a SoundFont, starts after the first tap
  (iOS only allows audio after a user gesture), and keeps up during a battle animation. Report the
  result. Don't build on an unproven library. Try `spessasynth_lib` first; if it fails the spike,
  use `@tonejs/midi` + Tone.js's `Sampler`. M5 repeats the check inside the native apps.
- Before pinning any library: check its current stable version and read its docs (npm, the
  official site). Pin exact versions. Use what's already in the repo before adding a package. Read
  a library's docs and types before deciding it can't do something.
- Rejected. Don't propose these again without new facts:
  - React Native / Expo: no game engine (tilemaps, camera, collisions and sprite animation would
    be hand-built), and weak MIDI-through-samples playback.
  - Peer-to-peer PvP (WebRTC): unreliable through home routers, and nobody has the authority to
    settle a disputed result.
  - Godot or Unity: the rules could no longer be one TypeScript package shared with the server and
    the tests.

## Engineering principles

- No backward compatibility before the first public release. Remove old paths. No fallbacks or
  migrations.
- Pick the simplest implementation that fully meets the current need. No abstraction, setting or
  extra layer "for later".
- Grow in layers: build the smallest version that works end to end, then add each feature on top
  of a game that already works. Never trade a working build for unfinished complexity.
- Give each module one clear job.
- Prefer established, well-maintained libraries to hand-written code.
- Make decisions that will last. No stopgaps meant to be replaced later.
- The code is the most reliable source of truth. When a doc disagrees with the code, fix the doc
  to describe how the code works now, and name that edit in your reply.
- Tune balance on real fights (replays, playtests), never on an imagined "typical" fight. Ask
  before reading any production data.

## AGENTS.md files

- This file holds the repo-wide rules: architecture, cross-package contracts, testing, workflow,
  commands and the repo-wide Do-NOT list. Each `packages/<pkg>/AGENTS.md` holds that package's file
  map, its own rules, its Do-NOT list and its commands.
- Every `CLAUDE.md` is a symlink to the `AGENTS.md` next to it. Edit the AGENTS.md.
- Agents write down the owner's decisions; they don't make them. Record a rule when the owner has
  decided it, or when updating a file to match the code. Never record a rule you inferred or simply
  think is good.
- Each file has two zones. **Stable rules** (contracts, Do-NOT lists) change only when the owner
  explicitly decides; point the change out clearly in your reply. **Current state** (what exists
  right now) can be updated freely.
- Write each rule once, in the widest file it applies to. Narrower files point to it.
- Describe how things work now: the rule, its constants and where they live, plus one line on why
  when that line stops someone from undoing it. No history, no dates, no "used to". Leave out
  rejected alternatives, except a one-line warning about one an agent is likely to propose again.
- Keep the files lean. If a file keeps growing, cut narrative instead of adding more.
- Name every edit to these files in your reply. When in doubt, don't edit; ask.

## Testing

- Write tests when a change touches a contract or a rule: the battle engine, cooldowns, damage,
  the type chart, effects, crate checks, the save schema, network message checks, and content
  integrity.
- Don't test visual polish, simple wiring or config.
- Test against the rules written in the AGENTS.md files, not against how the code happens to work.
- A failing rule test is a real bug. Fix the code; never weaken the test.
- `core`'s tests use their own small set of test vinyls, never the real catalogue, so tuning a
  vinyl never breaks a rules test.
- Golden replays: a test file holds `{ seed, sides, actions }` and the event log those must
  produce. `core` and `server` read the same files, so the two can't drift apart.
- Content tests check that every reference points to something real (a vinyl's pack exists, a
  map's NPC exists), that every vinyl has exactly three moves at levels 1, 2 and 3, and that every
  asset has a recorded source.
- Run `pnpm test` and `pnpm typecheck` before calling a rule-touching task done.

## CI, deploys and scripts

- `.github/workflows/ci.yml` runs on every PR and every push to `main`: pnpm (version from
  `packageManager`), the current Node LTS (from `.node-version`), then `pnpm install --frozen-lockfile`,
  `pnpm -r --if-present run typecheck` and `pnpm test`. It is meant to be a required check before
  merging. Third-party actions are pinned to a commit SHA.
- Deploys happen only through CI: PR, checks, merge, then a deploy workflow. Never deploy from a
  laptop, except in an emergency. The server's host is chosen when PvP has to work over the
  internet.
- When you add or rename a package, update every workflow that lists packages. A package missing
  from the deploy workflow silently never deploys.
- Assume the repo may become public: no secrets, keys or private config in git. Secrets come from
  CI secrets or environment variables.
- pnpm passes arguments straight through to scripts. Never add a `--` separator.
- A command whose job is to report (an inventory, a stats dump) prints its report and exits 0. If
  CI needs it to fail on a finding, add an opt-in `--ci` flag.

## Design and UX

- **Show, don't tell.** Teach by playing. The first fight IS the tutorial. Every step is a real
  decision the player can get wrong, and the feedback does the teaching. A coach speaks up after a
  mistake or when the player is stuck, never to congratulate.
- **Few words.** Keep player-facing text short. Only say what the screen can't show. An ending can
  have no words at all.
- **Landscape on every device.** Phones and desktop share one layout.
- **French and English from day one.** All player-facing text lives in locale files, and every text
  is written in both languages when it is added.
- **Art direction.** Original pixel art made for this game, 8-bit in spirit, in the line of RPGs
  like Pokémon and Dofus. Each place draws on its music genre (hip-hop, metal…) and the story.

The screen-side rules (motion, layout, touch, dev shortcuts) are in `packages/game/AGENTS.md`.

## Do NOT

- Don't write a rule anywhere but `core`.
- Don't use `Math.random`, `Date.now` or I/O in `core`.
- Don't trust a client in PvP: no results reported by a client, no unchecked crates.
- Don't key, compare or route by a display name. Don't show an id to a player.
- Don't scale pixel art by a fraction, and don't smooth it.
- Don't commit an asset without its source and license, and never commit a secret.
- Don't add save or content migrations before the first public release.
- Don't add a dependency before checking whether the existing ones already cover the need.
- Don't deploy from a laptop.

# Current state

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install every package's dependencies. |
| `pnpm dev` | Start the game's dev server. It listens on the network too, so a phone on the same Wi-Fi can open the "Network" URL Vite prints. |
| `pnpm build` | Production build of the game into `packages/game/dist/`. |
| `pnpm test` | Run every package's tests. |
| `pnpm typecheck` | Typecheck every package. |

Setup note: Corepack (0.31 and 0.36 tested) can't start pnpm 12. Install pnpm itself
(`npm i -g pnpm`, or pnpm's standalone installer); it switches to the version in `packageManager`.

## What exists

The workspace with `core` (the battle engine, with tests), `content` (the M1 vinyls, Riff, locales,
palette, sprites) and `game`, whose M1 battle screen plays a whole fight against Riff by touch or
keyboard. Open it with `.claude/skills/run/SKILL.md`
(`http://localhost:5173/?scene=battle&fixture=riff&seed=42&lang=fr`).

## Roadmap

- **M0, foundation.** Done.
- **M1, one fight.** Done: the engine in `core`, the 8 test vinyls and Riff in `content`, the battle
  screen in `game`.
- **M2, PvP.** The `server` package. Two browsers fight through it with a join code, with
  reconnection, the turn timer, crate checks and the golden replays shared with `core`. Done when a
  phone and a laptop on the owner's network finish a fight, and closing one tab mid-fight and
  reopening it resumes the fight.
- **M3, a town.** The hip-hop town as a Tiled map: walking, collisions, NPC dialogue, one
  trainer-style fight that opens the M1 battle and returns to the map, a record shop that repairs
  turntables, and saving. Free CC0 placeholder tiles are fine (for example Kenney's 16×16 packs).
- **M4, music.** First the audio spike (see Stack). Then a town theme, a battle theme, and playing a
  vinyl from the crate, with two packs (8-bit hip-hop, 8-bit classical).
- **M5, native apps.** Capacitor builds for iOS and Android. Check safe areas, the audio start
  (repeat the M4 check natively), performance and saves on real devices.
- **Then, one layer at a time:** XP and levels with vinyl difficulty, rarity and crate weight; the
  Detroit ruins and their cast; arenas and dungeons; the fusion machine and the shaman; the balance
  lab (`sim`); internet hosting for PvP; much later, a multiplayer story mode.

## Open decisions

Ask each one when the milestone that needs it starts. Brackets hold the owner's suggested default,
which still needs confirming.

- M1 follow-ups, raised after M1 was built:
  - The bag preview (first tap shows a vinyl's moves, second tap swaps) was added by the screen
    work, not decided.
  - Before any vinyl has a move with both an ally shield and a trap: such a move shows where the
    trap went (the shield names the turntable).
  - The computer opponent, when a plan works at a 100% spread but can't be played out at 90% (a
    defender that falls at 100% still stands at 90%, so a later target is illegal): it plays the
    plan's moves only while they stay legal and scores where it stops. Not decided.
  - At a whole pixel ratio (2 or 3), `screen.ts` keeps the view on whole CSS px, which can hide 1
    or 2 game px of world (1180×820 at ratio 2 shows 336×234 instead of 337×234). Contract 10 says
    extra space shows more of the world. Getting it back needs a per-browser choice in `screen.ts`.
- M2: the fight's random generator is 32 bits and can be worked out from the damage numbers a
  player sees, so a PvP player could predict rolls.
- M2: since a fighter may end a turn at any time, two PvP players can end turns forever; nothing
  stops a stalled fight yet.
- XP milestone: the skill tree (initiative, scratching accuracy "in time", carrying more, how many
  crates he can play…) and items or artifacts that change his skills.
- M2: PvP format [open format: each player builds a crate from the whole catalogue under a budget,
  and the server checks it]. PvP turn timer [30 seconds, then the turn passes].
- M3: how turntables are repaired after a fight [record shops repair them], and what losing costs
  [back to the last record shop visited].
- Before any public build: real names and real songs [prototype with public-domain music and
  original tunes "in the style of"; every name and track in data files so they can be swapped].
- Art direction details: tile size [16×16]. (Palette: `content/src/palette.ts`; font: Micro 5.)
- In the milestone that builds each one: rarity tiers, level curve, weight limit, where the rest of
  the collection is stored, fusion rules.
