// Small pieces the panel and the opponent HUD share: the HP bar, a glyph and number, a move's effect
// summary, a rig's status glyph, the genre chart's marker, and measuring an element in game pixels.
import { genrePct, type Effect, type Genre, type Move, type RigStatus, type TrapEffect } from '@scratchboy/core';
import { useLayoutEffect, useState, type RefObject } from 'react';
import { useText } from '../text.tsx';
import { Glyph, type GlyphName } from './glyphs.tsx';

/** An HP bar `width` game pixels wide. Its fill is a whole number of pixels, at least 1 while HP is left. */
export function HpBar({ hp, max, width }: { hp: number; max: number; width: number }) {
  const filled = hp <= 0 ? 0 : Math.max(1, Math.round((width * hp) / max));
  const danger = hp > 0 && hp * 4 <= max;
  return (
    <span className="hp" style={{ width: `${width}px` }}>
      <span className={danger ? 'hp-fill is-danger' : 'hp-fill'} style={{ width: `${filled}px` }} />
    </span>
  );
}

/** A glyph followed by a number. */
export function Stat({ glyph, value, className }: { glyph: GlyphName; value?: number | string; className?: string }) {
  return (
    <span className={className ? `stat ${className}` : 'stat'}>
      <Glyph name={glyph} />
      {value !== undefined && <span className="tx">{value}</span>}
    </span>
  );
}

function trapPart(effect: TrapEffect, key: number) {
  if (effect.kind === 'damage') return <Stat key={key} glyph="damage" value={effect.amount} />;
  if (effect.kind === 'stun') return <Stat key={key} glyph="stun" value={effect.turns} />;
  return <Stat key={key} glyph="slow" value={effect.turns} />;
}

function effectPart(effect: Effect, key: number, all: string) {
  switch (effect.kind) {
    case 'damage':
      return <Stat key={key} glyph="damage" value={effect.to === 'enemies' ? `${effect.amount} ${all}` : effect.amount} />;
    case 'stun':
      return <Stat key={key} glyph="stun" value={effect.to === 'enemies' ? `${effect.turns} ${all}` : effect.turns} />;
    case 'slow':
      return <Stat key={key} glyph="slow" value={effect.turns} />;
    case 'haste':
      return <Stat key={key} glyph="haste" value={effect.turns} />;
    case 'shield':
      return <Stat key={key} glyph="shield" value={effect.to === 'allies' ? `${effect.amount} ${all}` : effect.amount} />;
    case 'trap':
      return (
        <span key={key} className="stat">
          <Glyph name="trap" />
          {effect.payload.map(trapPart)}
        </span>
      );
  }
}

/** What a move does, from its deck data: one glyph and number per effect. */
export function EffectSummary({ move }: { move: Move }) {
  const t = useText();
  return <>{move.effects.map((effect, i) => effectPart(effect, i, t('ui.all')))}</>;
}

/** A rig's status as a glyph (and its cooldown): broken, cooling, used this turn, or ready. */
export function statusGlyph(status: RigStatus): { glyph: GlyphName; value?: number } {
  switch (status.state) {
    case 'broken':
      return { glyph: 'broken' };
    case 'cooling':
      return { glyph: 'cooldown', value: status.cooldown };
    case 'used':
      return { glyph: 'hand-used' };
    case 'ready':
      return { glyph: 'ready' };
  }
}

/** The genre chart's marker for a move of `attacker` genre on a rig of `target` genre (core's genrePct). */
export function genreMark(attacker: Genre, target: Genre): 'strong' | 'weak' | null {
  const pct = genrePct(attacker, target);
  return pct > 100 ? 'strong' : pct < 100 ? 'weak' : null;
}

/** The ×2 / ×0,5 marker. */
export function Mark({ mark }: { mark: 'strong' | 'weak' }) {
  const t = useText();
  return <span className={mark === 'strong' ? 'tx eff-strong' : 'tx eff-weak'}>{t(mark === 'strong' ? 'ui.strong' : 'ui.weak')}</span>;
}

/** An element's laid-out width in whole game pixels (null until it has been measured), so it can be
 *  centred on a whole pixel. The UI is laid out at 1 CSS px per game px inside the zoomed view, and
 *  offsetWidth reads the element's own CSS px, before the zoom. */
export function useGameWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measured = ref.current?.offsetWidth;
    if (measured !== undefined && measured !== width) setWidth(measured);
  });
  return width;
}
