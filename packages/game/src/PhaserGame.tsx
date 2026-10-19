import type { Game } from 'phaser';
import { useLayoutEffect, useRef } from 'react';
import { applyLayout, startGame } from './phaser/main.ts';
import type { ScreenLayout } from './screen.ts';

// Mounts the Phaser canvas once, destroys it on unmount, and applies every new screen layout to it.
export function PhaserGame({ layout }: { layout: ScreenLayout }) {
  const container = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const firstLayout = useRef(layout);

  useLayoutEffect(() => {
    const parent = container.current;
    if (!parent) return;
    const started = startGame(parent, firstLayout.current);
    game.current = started;
    return () => {
      game.current = null;
      started.destroy(true);
    };
  }, []);

  useLayoutEffect(() => {
    if (game.current) applyLayout(game.current, layout);
  }, [layout]);

  return <div className="game-canvas" ref={container} />;
}
