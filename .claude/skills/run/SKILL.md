---
name: run
description: Start Scratch Boy's dev server and open a scene (the M1 battle) in a browser, on a phone or in Playwright.
---

# Run Scratch Boy

## Start

```sh
pnpm install
pnpm dev            # = pnpm --filter @scratchboy/game dev ; add --port 5173 --strictPort to pin the port
```

pnpm 12 is needed (the version in the root `packageManager`). Corepack can't start it: install
pnpm itself (`npm i -g pnpm` or pnpm's standalone installer). Never add `--` before script
arguments.

## Open a scene

http://localhost:5173/?scene=battle&fixture=riff&seed=42&lang=fr

| Parameter | Values | Default |
|---|---|---|
| `scene` | `battle` (the only scene in M1) | `battle` |
| `fixture` | a key of content's `FIGHTS` (`riff`) | `riff` |
| `seed` | a whole number: the same seed replays the same fight | random |
| `lang` | `fr`, `en` | the device language, else `fr` |

Production builds ignore these parameters. If another local server holds `localhost:5173` on IPv6,
use `http://127.0.0.1:5173/…`.

## Play

- The first fight in a page opens with a dialogue (20 lines against Riff). Tap anywhere (or press
  `Enter` / `Space`) to go on; the fight starts after the last line. A replay skips it.
- Touch: tap a turntable tab (or the turntable), a move, then a pink target. Bag: tap a record
  once to see its moves, again to swap it in.
- Keyboard: `1` `2` `3` pick a move, `←` `→` (or `↑` `↓`) switch turntables or move between
  targets or bag records (the focused record's moves show), `Enter` / `Space` confirm, `Esc`
  cancels, `S` opens the bag, `E` ends the turn, `Tab` / `Shift+Tab` walk the buttons.
- Input is locked while the opening lines show, while animations play and on the opponent's turn: the UI root
  `.battle` carries `data-busy="true"` then. Wait for `data-busy="false"` before acting.

## Screenshots with Playwright

Use a real device scale factor: one browser per ratio, launched with
`--force-device-scale-factor`, the window as the viewport. Playwright's emulated
`deviceScaleFactor` hides the layout snapping that real Android phones (2.625, 2.75) and Windows
(125 %, 150 %) show, and a `viewport` option resets the ratio to 1.

```js
const { chromium } = require('playwright');
// Phone, landscape, ratio 2.625: zoom 6, 400x180 game px.
const browser = await chromium.launch({ args: ['--force-device-scale-factor=2.625', '--window-size=915,412'] });
const page = await (await browser.newContext({ viewport: null, hasTouch: true })).newPage();
await page.goto('http://127.0.0.1:5173/?scene=battle&fixture=riff&seed=42&lang=fr');
await page.waitForFunction(() => document.querySelector('.battle')?.dataset.busy === 'false');
await page.locator('[data-level="2"]').tap();   // a move; then '.target.can' for its target
await page.screenshot({ path: 'battle.png' });  // in device px
```

Ratios worth checking: 915x412 @2.625 and 844x390 @3 (phones, zoom 6), 1180x820 @2 (tablet,
zoom 7), 1440x900 @2 (laptop, zoom 9), 1536x864 @1.25 and 1280x720 @1.5 (Windows, zoom 6),
1280x720 @1 (zoom 4). For iOS, also run WebKit (`webkit.launch()`, which has no such switch: set
`deviceScaleFactor` in the context), at 932x430 @3 (zoom 7) and 844x390 @3.

Pixel check: in a screenshot, every game px is one block of zoom x zoom device px of one colour,
counted from the view's corner (`.view`'s `getBoundingClientRect()` times `devicePixelRatio`).
Hide the canvas (`canvas.style.visibility = 'hidden'`) to check the UI alone, and check a
capital's accent (`À toi`, `É…` in a move name) is whole.

Useful selectors: `[data-talk]` the opening line (tap it until it's gone), `[data-tab="i"]` turntable tabs, `[data-level="1|2|3"]` moves,
`.target.can` target buttons, `[data-swap]` the bag, `[data-bag="vinyl/<slug>"]` bag records (tap
twice to swap), `.btn-end` end turn, `[data-replay]` replay, `.result-title` the result word. A
button that can be used has the class `can`.

The view `.view` (the canvas and the UI) is laid out in game px and enlarged by CSS zoom, or by a
transform where zoom isn't exact: `getBoundingClientRect()` gives screen CSS px, `offsetLeft` /
`offsetWidth` give game px.

## On a phone

Same Wi-Fi as the computer: open the `Network` URL Vite prints (for example
`http://192.168.0.45:5173/?scene=battle&seed=42`). Hold the phone sideways.
