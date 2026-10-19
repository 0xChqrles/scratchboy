// The Phaser game: one canvas of `layout.width` x `layout.height` game pixels, drawn at 1 CSS px per
// game px inside the zoomed view (App.tsx), so each game pixel is a whole number of device pixels
// (root contract 10). React owns input; Phaser only draws.
import { PALETTE } from '@scratchboy/content';
import { AUTO, Game, Scale } from 'phaser';
import type { ScreenLayout } from '../screen.ts';
import { BattleScene } from './BattleScene.ts';

export function startGame(parent: HTMLElement, layout: ScreenLayout): Game {
  const game = new Game({
    type: AUTO,
    parent,
    width: layout.width,
    height: layout.height,
    pixelArt: true,
    backgroundColor: PALETTE['ink-1'],
    banner: false,
    // Zoom 1: the view's CSS zoom enlarges the canvas. Phaser's own bookkeeping (displayScale, read
    // from the canvas's on-screen rect) stays right for pointer maths.
    scale: { mode: Scale.NONE },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    audio: { noAudio: true },
    scene: [BattleScene],
  });
  applyLayout(game, layout);
  return game;
}

/** Applies a new screen layout: the visible size in game px. The scene re-lays out on 'resize'. */
export function applyLayout(game: Game, layout: ScreenLayout): void {
  if (!game.isBooted) {
    game.events.once('ready', () => applyLayout(game, layout));
    return;
  }
  game.scale.resize(layout.width, layout.height);
  // Phaser leaves the CSS size alone at zoom 1; set it so it never falls back to an old one.
  game.canvas.style.width = `${layout.width}px`;
  game.canvas.style.height = `${layout.height}px`;
}
