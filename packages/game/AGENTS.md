# game

Read the root `AGENTS.md` first; its contracts apply here. This package is the client: Phaser
scenes, the React UI layer on top of the canvas, the audio engine, input and save storage.

# Stable rules

## Screen and input

- **Motion must mean something.** Animate a change of state (a hit landing, a cooldown counting
  down, a turntable breaking). Nothing purely decorative. Before adding any motion, say what it
  tells the player. Respect the reduced-motion setting.
- **Nothing on screen jumps.** Reserve space for messages and counters, so nothing shifts when they
  appear.
- **One visual language.** One way to show "you can tap this". One way to emphasize something. One
  palette, defined as tokens in one place. One pixel font.
- **Touch first, keyboard too.** Every action works with a thumb on a phone and with a keyboard on
  desktop. Test on a real phone early: the dev server can be opened from a phone on the same
  network.
- **Dev shortcuts.** In development builds, URL parameters open any scene in any state (for example
  `?scene=battle&fixture=…&seed=…` or `?scene=town&spawn=…`). Production builds ignore them.

# Current state

Started from Phaser's official React + TypeScript template (`phaserjs/template-react-ts`).
Phaser 4's own agent guides ship inside the package: `node_modules/phaser/skills/<topic>/`.

The M1 battle screen: Scratch Boy (side 0) against a `FIGHTS` fixture. How to open it, play it and
screenshot it: `.claude/skills/run/SKILL.md`.

How the battle screen works
- The first fight in a page opens with its `FIGHT_INTROS` lines (content), one at a time, in a box
  in the command panel's place, with the speaker's name. A tap anywhere, `Enter` or `Space` shows
  the next; after the last, the panel comes and the fight starts. A replay skips them. Input is
  locked until then, and the speaker plays the idle loop in place of the side on turn.
- The zustand store holds the full state (`truth`), the player's view (`viewFor(truth, 0)`), a
  queue of steps to animate (`eventsFor(events, 0)` and the view each step leads to), the
  displayed state the HUD reads (`shown`), and the selection (turntable, picked move, swap picker).
  The UI offers only what `legalActions` contains, and shows a button as tappable (pink) only while
  input is unlocked. On the opponent's turn the store waits for the animations to drain, pauses
  400 ms (0 with reduced motion), then plays `chooseAction`.
- The HUD reads `shown` through core's queries: `rigStatus` (broken, cooling, used, ready; a broken
  rig shows no cooldown or shield), `armsLeft` (free hands) and `slowAndHasteTurns`. While a step
  still holds the end of the turn on screen, no hand shows free.
- The scene plays the queued events one at a time. At each event's impact it calls `landEvent`,
  which copies that event's resulting values into `shown`; after a step's last event `shown`
  becomes the view exactly. A record turns one 45° frame per turn of cooldown (frame =
  min(cooldown, 7)), and each of the player's cooldown ticks rests 240 ms (120 reduced). A broken
  turntable shows no record. A swap lifts the old record 2 px, shows the new label, and lands as it
  comes down. A player turn that ends by itself holds 600 ms (300 reduced) before it passes. The
  side on turn plays its idle loop: that motion says whose turn it is.
- The canvas and the React layer share one view (`App.tsx`), laid out in game px (1 CSS px each)
  and enlarged by `layout.px` with CSS `zoom`, which lays out at whole device px per game px.
  Never a scale transform at a fractional ratio (2.625, 1.25): Chromium lays out and snaps in
  device px before a transform runs, which blurs the UI. Where zoom isn't exact (WebKit at a ratio
  of 3 with zoom 5 or 7: it lays out in 1/64 CSS px), `screen.ts` picks a scale transform, which is
  exact at a whole ratio. At a whole ratio the view's size and position are whole CSS px, since
  WebKit draws a WebGL canvas on whole CSS px. The text nudge that puts Micro 5's baseline on a
  whole pixel is measured for each zoom (`setTextNudges`): the browser rounds the font's metrics
  in device px. Text the nudge moves is never clipped vertically, since a capital's accent sits
  1 px above the line. Every box lands on a whole game px: shared columns are cut with CSS
  `round()` (the moves, tabs for 3-4 turntables) and the portrait prompt is centred by measured
  whole pixels, since a fractional box puts its text between device pixels. The scene reports each
  rig's box in game px; the opponent's HUD, target buttons and their damage chips, the cooldown
  under each turntable and the damage numbers are placed from those boxes, centred on their
  measured width. A damage number goes above its rig, else beside it, never over
  the HUD or another rig. The UI root carries `data-busy` while input is locked.
- The bag shows ×2 / ×0,5 against the opponent's working rigs (core's `genrePct`). A first tap on
  a vinyl (or keyboard focus) shows its moves, read-only, in the moves area; a second tap (or
  Enter) swaps it in.
- At the end of the fight the result word and the replay button take the place of the moves and
  the side buttons; the scene stays at full brightness.
- Art anchors (table, deck and hero offsets, spots) are copied from `content/art/sprites/*.ts`
  into `BattleScene.ts`, each with its source named; the table's height is read from its sheet.

## Files

| File | Job |
|---|---|
| `index.html` | Page shell; mounts `#root`. |
| `src/main.tsx` | Start: palette, font, dev params (fixture, seed, lang), the fight, then React. |
| `src/App.tsx` | The view (the canvas and the battle UI over it, on one grid) and the turn-your-phone prompt in portrait. |
| `src/PhaserGame.tsx` | Mounts the Phaser game once and applies every new screen layout to it. |
| `src/screen.ts` | The pixel grid: whole-number zoom, visible size in game px, view position, zoom or transform. |
| `src/dev.ts` | Dev URL parameters (`scene`, `fixture`, `seed`, `lang`); production ignores them. |
| `src/i18n.ts`, `src/text.tsx` | Locale choice, the translator, `fill` for `{name}` slots; the React context. |
| `src/theme.ts` | Palette tokens as `--c-*` CSS variables; the Micro 5 font and its measured text nudges. |
| `src/motion.ts` | The reduced-motion setting. |
| `src/sprites.ts` | Sprite sheets (PNG + Aseprite JSON) shared by Phaser and the DOM; tag lookup. |
| `src/style.css` | Page styles. |
| `src/phaser/main.ts` | Phaser config (`Scale.NONE` at zoom 1, `pixelArt: true`, no Phaser input) and `applyLayout`. |
| `src/phaser/BattleScene.ts` | The battle world and the event animations. |
| `src/battle/store.ts` | The battle store and flow (opening lines, player actions, bag preview, opponent turns, landing events). |
| `src/battle/shown.ts` | Applies one event's resulting values to the displayed state. |
| `src/battle/choices.ts` | What the player may pick, read from `legalActions`. |
| `src/battle/layout.ts` | Measures shared by the scene and the UI (`PANEL_HEIGHT` = 56). |
| `src/battle/BattleUI.tsx` | The UI layer's root over the canvas. |
| `src/battle/Panel.tsx` | Command panel: turntable tabs, moves, bag, end turn, message line, free hands; the result at the end. |
| `src/battle/Stage.tsx` | Over the scene: opponent HUD, target buttons, turntable buttons and cooldowns, damage numbers. |
| `src/battle/Overlays.tsx` | Swap picker (the bag). |
| `src/battle/Talk.tsx` | The opening lines' box. |
| `src/battle/parts.tsx` | HP bar, glyph + number, effect summary, status glyph, ×2 / ×0,5 marker, measuring in game px. |
| `src/battle/glyphs.tsx` | Pixel glyphs (SVG) and DOM sprite frames (vinyl icons). |
| `src/battle/keyboard.ts` | Keyboard shortcuts; focus moves by itself only for keyboard players. |
| `src/battle/battle.css` | The UI layer's styles, all in game px. |
| `vite.config.ts` | Vite config. |

An undrawn `vinyl-label-<slug>` or `vinyl-icon-<slug>` leaves its space empty.

## Commands

- `pnpm --filter @scratchboy/game dev` (or `pnpm dev` from the root)
- `pnpm --filter @scratchboy/game build`
- `pnpm --filter @scratchboy/game typecheck`
