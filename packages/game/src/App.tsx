import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BattleUI } from './battle/BattleUI.tsx';
import { Glyph } from './battle/glyphs.tsx';
import { PhaserGame } from './PhaserGame.tsx';
import { getScreen, subscribeScreen, type ScreenLayout } from './screen.ts';
import { useText } from './text.tsx';
import { setTextNudges } from './theme.ts';

// The battle scene (the only scene in M1): the canvas, the UI layer over it, and the prompt to turn
// a phone sideways. The game stays mounted under that prompt.
//
// The canvas and the UI share one view, laid out in game px (1 CSS px each) and enlarged by
// `layout.px` (root contract 10): with CSS zoom, which lays out at exactly `layout.zoom` device px
// per game px, or with a scale transform where zoom can't be exact (screen.ts picks).
export function App() {
  const layout = useSyncExternalStore(subscribeScreen, getScreen);
  const view = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (view.current) setTextNudges(view.current, layout.px);
  }, [layout.px, layout.zoom, layout.enlarge]);
  return (
    <>
      <div className="screen" style={{ left: `${layout.left}px`, top: `${layout.top}px` }}>
        <div className="view" ref={view} style={{ ...enlarge(layout), width: `${layout.width}px`, height: `${layout.height}px` }}>
          <PhaserGame layout={layout} />
          <BattleUI layout={layout} />
        </div>
      </div>
      {layout.portrait && <RotatePrompt layout={layout} />}
    </>
  );
}

function enlarge(layout: ScreenLayout) {
  return layout.enlarge === 'zoom' ? { zoom: layout.px } : { transform: `scale(${layout.px})`, transformOrigin: '0 0' };
}

/** Drawn at 3 game pixels per pixel: a portrait view is narrow, so its game pixels are small. Laid
 *  out at 1 CSS px per prompt pixel and enlarged with CSS zoom (3 × layout.px: a whole number of
 *  device px per prompt pixel, and exact in WebKit too at a ratio of 1, 2 or 3). The icon and the
 *  text are centred on each other, and the prompt on the screen, by whole pixels measured once
 *  drawn. */
function RotatePrompt({ layout }: { layout: ScreenLayout }) {
  const t = useText();
  const body = useRef<HTMLDivElement>(null);
  const icon = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ icon: 0, text: 0, h: 0 });
  useLayoutEffect(() => {
    if (body.current) setTextNudges(body.current, layout.px * 3);
  }, [layout.px, layout.zoom]);
  useLayoutEffect(() => {
    const next = { icon: icon.current?.offsetWidth ?? 0, text: text.current?.offsetWidth ?? 0, h: body.current?.offsetHeight ?? 0 };
    if (next.icon !== size.icon || next.text !== size.text || next.h !== size.h) setSize(next);
  });
  const w = Math.max(size.icon, size.text);
  const x = layout.left + Math.floor((layout.width - w * 3) / 2) * layout.px;
  const y = layout.top + Math.floor((layout.height - size.h * 3) / 2) * layout.px;
  const indent = (inner: number) => ({ marginLeft: `${Math.floor((w - inner) / 2)}px` });
  return (
    <div className="rotate" role="alert">
      <div className="rotate-at" style={{ left: `${x}px`, top: `${y}px`, visibility: w > 0 ? 'visible' : 'hidden' }}>
        <div className="rotate-body" ref={body} style={{ zoom: layout.px * 3 }}>
          <span className="rotate-icon" ref={icon} style={indent(size.icon)}>
            <Glyph name="rotate" />
          </span>
          <span className="tx" ref={text} style={indent(size.text)}>
            {t('ui.rotate')}
          </span>
        </div>
      </div>
    </div>
  );
}
