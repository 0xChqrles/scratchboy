// The battle's React layer: exactly over the canvas, in the same zoomed view (App.tsx), laid out in
// game pixels (1 CSS px each), so every UI pixel is a whole number of device pixels (root contract 10).
import type { ScreenLayout } from '../screen.ts';
import './battle.css';
import { useBattleKeys } from './keyboard.ts';
import { PANEL_HEIGHT } from './layout.ts';
import { isLocked, useBattle } from './store.ts';
import { SwapPicker } from './Overlays.tsx';
import { Panel } from './Panel.tsx';
import { Stage } from './Stage.tsx';
import { Talk } from './Talk.tsx';

export function BattleUI({ layout }: { layout: ScreenLayout }) {
  useBattleKeys();
  const locked = useBattle(isLocked);
  const talking = useBattle((s) => s.talk.length > 0);
  const sceneHeight = layout.height - PANEL_HEIGHT;
  return (
    // data-busy: input is locked (animations, the opponent's turn, the end): tests wait on it.
    <div className="battle" data-busy={locked}>
      <Stage width={layout.width} height={sceneHeight} />
      <SwapPicker width={layout.width} sceneHeight={sceneHeight} />
      {talking ? <Talk /> : <Panel />}
    </div>
  );
}
