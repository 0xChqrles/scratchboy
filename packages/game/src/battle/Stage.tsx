// The UI that sits over the scene: the opponent's HUD above his rigs, the target buttons while a
// move waits for its target, buttons over Scratch Boy's turntables with their cooldowns under them,
// and the damage numbers. Everything is placed from the rig boxes the scene reports, in whole game
// pixels.
import { textKey } from '@scratchboy/content';
import { expectedDamage, rigStatus, slowAndHasteTurns, type BattleState } from '@scratchboy/core';
import { useEffect, useMemo, useRef } from 'react';
import { useText } from '../text.tsx';
import { Glyph } from './glyphs.tsx';
import { focusFirst } from './keyboard.ts';
import { genreMark, HpBar, Mark, Stat, useGameWidth } from './parts.tsx';
import {
  currentNeed,
  OPPONENT,
  pickAlly,
  pickTarget,
  PLAYER,
  selectRig,
  useBattle,
  type Floater,
  type RigBox,
} from './store.ts';

const CARD_W = 60;
const CARD_H = 24;
const HEAD_H = 12;
const CARD_GAP = 2;
const EDGE = 2;
const FOE_HP_WIDTH = 24;
/** A text line, and the 22 px emphasis line. */
const LINE = 10;
const STRONG_LINE = 20;

const px = (n: number): string => `${n}px`;

function boxStyle(box: RigBox) {
  return { left: px(box.x), top: px(box.y), width: px(box.w), height: px(box.h) };
}

function overlaps(a: RigBox, b: RigBox): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function inside(a: RigBox, bounds: RigBox): boolean {
  return a.x >= bounds.x && a.y >= bounds.y && a.x + a.w <= bounds.x + bounds.w && a.y + a.h <= bounds.y + bounds.h;
}

/** Card x positions: centred over each rig, pushed apart so they never overlap, kept on screen. */
function cardLefts(boxes: readonly RigBox[], width: number): number[] {
  const wanted = boxes.map((box) => Math.round(box.x + box.w / 2 - CARD_W / 2));
  const lefts = [...wanted];
  for (let i = 1; i < lefts.length; i++) lefts[i] = Math.max(lefts[i] ?? 0, (lefts[i - 1] ?? 0) + CARD_W + CARD_GAP);
  for (let i = lefts.length - 1; i >= 0; i--) {
    const limit = i === lefts.length - 1 ? width - EDGE - CARD_W : (lefts[i + 1] ?? 0) - CARD_W - CARD_GAP;
    lefts[i] = Math.min(lefts[i] ?? 0, limit);
  }
  return lefts.map((left) => Math.max(EDGE, left));
}

/** Where the opponent's HUD sits: a card over each rig, the fighter's own row on top, and the
 *  whole area it covers. */
interface HudPlace {
  lefts: number[];
  top: number;
  area: RigBox;
}

function hudPlace(boxes: readonly RigBox[], width: number): HudPlace | null {
  if (boxes.length === 0) return null;
  const lefts = cardLefts(boxes, width);
  const top = Math.max(EDGE + HEAD_H - 1, Math.min(...boxes.map((box) => box.y)) - CARD_H - 2);
  const left = Math.min(...lefts);
  const right = Math.max(...lefts) + CARD_W;
  return { lefts, top, area: { x: left, y: top - HEAD_H + 1, w: right - left, h: HEAD_H - 1 + CARD_H } };
}

function OpponentHud({ width }: { width: number }) {
  const t = useText();
  const shown = useBattle((s) => s.shown);
  const stunned = useBattle((s) => s.stunned[OPPONENT]);
  const boxes = useBattle((s) => s.rigBoxes[OPPONENT]);
  const foe = shown.sides[OPPONENT];
  const place = boxes.length === foe.rigs.length ? hudPlace(boxes, width) : null;
  if (!place) return null;
  const { lefts, top, area } = place;
  const { slow, haste } = slowAndHasteTurns(shown, OPPONENT);
  return (
    <>
      <div className="foe-head" style={{ left: px(area.x), top: px(area.y), width: px(area.w) }}>
        <span className="name tx">{t(textKey(foe.id))}</span>
        <span className="slot slot-status">{slow > 0 && <Stat glyph="slow" value={slow} />}</span>
        <span className="slot slot-status">{haste > 0 && <Stat glyph="haste" value={haste} />}</span>
        <span className="slot slot-traps">
          {foe.hiddenTraps > 0 && (
            <span className="stat">
              <Glyph name="trap" />
              <span className="tx">?×{foe.hiddenTraps}</span>
            </span>
          )}
        </span>
      </div>
      {foe.rigs.map((rig, i) => {
        const status = rigStatus(shown, OPPONENT, i);
        const broken = status.state === 'broken';
        return (
          <div
            key={i}
            className={broken ? 'foe-card is-broken' : 'foe-card'}
            style={{ left: px(lefts[i] ?? 0), top: px(top), width: px(CARD_W), height: px(CARD_H) }}
          >
            <span className="line">
              <span className="name tx">{t(textKey(rig.id))}</span>
              <span className="slot slot-state">
                {status.state === 'cooling' && <Stat glyph="cooldown" value={status.cooldown} />}
              </span>
              <span className="slot">{stunned?.[i] && !broken && <Glyph name="stun" />}</span>
              <span className="slot">{shown.decks[rig.deck]?.defender && !broken && <Glyph name="defender" />}</span>
            </span>
            <span className="line">
              {broken ? <Glyph name="broken" /> : <HpBar hp={rig.hp} max={rig.maxHp} width={FOE_HP_WIDTH} />}
              <span className="num tx">{rig.hp}</span>
              <span className="slot slot-shield">{status.shield > 0 && <Stat glyph="shield" value={status.shield} />}</span>
            </span>
          </div>
        );
      })}
    </>
  );
}

/** The picked move's marker on an enemy rig, from core's genre chart. */
function effectiveness(view: BattleState, attacker: number, target: number): 'strong' | 'weak' | null {
  const from = view.sides[PLAYER].rigs[attacker];
  const to = view.sides[OPPONENT].rigs[target];
  const a = from ? view.decks[from.deck] : undefined;
  const b = to ? view.decks[to.deck] : undefined;
  return a && b ? genreMark(a.genre, b.genre) : null;
}

/** The expected damage under a target, centred below its frame and kept on screen. Its button
 *  parent's padding box starts 1 px inside the frame. */
function TargetChip(props: {
  box: RigBox;
  width: number;
  damage: number;
  mark: 'strong' | 'weak' | null;
  defender: boolean;
}) {
  const { box, width, damage, mark, defender } = props;
  const ref = useRef<HTMLSpanElement>(null);
  const w = useGameWidth(ref);
  const left = w === null ? 0 : Math.max(EDGE, Math.min(width - EDGE - w, Math.round(box.x + box.w / 2 - w / 2)));
  return (
    <span
      ref={ref}
      className="target-chip"
      style={{ left: px(left - box.x - 1), top: px(box.h), visibility: w === null ? 'hidden' : 'visible' }}
    >
      {defender && <Glyph name="defender" />}
      <Stat glyph="damage" value={damage} />
      {mark && <Mark mark={mark} />}
    </span>
  );
}

function Targets({ width }: { width: number }) {
  const t = useText();
  const state = useBattle((s) => s);
  const need = useMemo(() => currentNeed(state), [state]);
  const { view, selected, pick, rigBoxes } = state;

  useEffect(() => {
    if (need && need.kind !== 'ready') focusFirst('[data-target]');
  }, [need]);

  if (!pick || !need || need.kind === 'ready') return null;
  if (need.kind === 'ally') {
    return (
      <>
        {need.rigs.map((rig) => {
          const box = rigBoxes[PLAYER][rig];
          if (!box) return null;
          return (
            <button
              key={rig}
              type="button"
              className="target can"
              style={boxStyle(box)}
              data-target={rig}
              aria-label={t(textKey(view.sides[PLAYER].rigs[rig]?.deck ?? ''))}
              onClick={() => {
                pickAlly(rig);
                focusLevel(pick.level);
              }}
            />
          );
        })}
      </>
    );
  }
  // Only the rigs the move may aim at get a frame. A rig a defender stands in front of gets
  // nothing; the defender's own chip carries the defender glyph.
  const foe = view.sides[OPPONENT];
  return (
    <>
      {need.rigs.map((i) => {
        const rig = foe.rigs[i];
        const box = rigBoxes[OPPONENT][i];
        if (!rig || !box) return null;
        const damage = expectedDamage(view, PLAYER, selected, pick.level, i);
        return (
          <button
            key={i}
            type="button"
            className="target can"
            style={boxStyle(box)}
            data-target={i}
            aria-label={`${t(textKey(rig.id))} ${damage}`}
            onClick={() => {
              pickTarget(i);
              focusLevel(pick.level);
            }}
          >
            {damage > 0 && (
              <TargetChip
                box={box}
                width={width}
                damage={damage}
                mark={effectiveness(view, selected, i)}
                defender={view.decks[rig.deck]?.defender === true}
              />
            )}
          </button>
        );
      })}
    </>
  );
}

/** Keeps keyboard focus on the move once its target button is gone. */
function focusLevel(level: number): void {
  requestAnimationFrame(() => focusFirst(`[data-level="${level}"]`));
}

/** Tapping a turntable sprite selects it, like its tab (touch only: the tabs are the keyboard path). */
function DeckButtons() {
  const boxes = useBattle((s) => s.rigBoxes[PLAYER]);
  const picking = useBattle((s) => s.pick !== null);
  if (picking) return null;
  return (
    <>
      {boxes.map((box, i) => (
        <button key={i} type="button" className="deck-hit" style={boxStyle(box)} tabIndex={-1} aria-hidden="true" onClick={() => selectRig(i)} />
      ))}
    </>
  );
}

/** A cooling turntable's cooldown, on the table front under it, so the scene says which deck is
 *  cooling and for how long. */
function DeckCooldown({ box, cooldown }: { box: RigBox; cooldown: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const w = useGameWidth(ref);
  const left = w === null ? box.x : Math.round(box.x + box.w / 2 - w / 2);
  return (
    <span
      ref={ref}
      className="deck-cool"
      style={{ left: px(left), top: px(box.y + box.h), visibility: w === null ? 'hidden' : 'visible' }}
    >
      <Stat glyph="cooldown" value={cooldown} />
    </span>
  );
}

function DeckCooldowns() {
  const shown = useBattle((s) => s.shown);
  const boxes = useBattle((s) => s.rigBoxes[PLAYER]);
  return (
    <>
      {boxes.map((box, i) => {
        if (i >= shown.sides[PLAYER].rigs.length) return null;
        const status = rigStatus(shown, PLAYER, i);
        return status.state === 'cooling' ? <DeckCooldown key={i} box={box} cooldown={status.cooldown} /> : null;
      })}
    </>
  );
}

/** Where a damage number goes: above its rig, else beside it (left, then right), never over the
 *  opponent's HUD or another rig, and on screen. A second number on the same rig stacks away. */
function floaterSpot(box: RigBox, w: number, h: number, stack: number, avoid: readonly RigBox[], bounds: RigBox) {
  const shift = stack * (h + 1);
  const centre = Math.round(box.x + box.w / 2 - w / 2);
  const spots = [
    { x: centre, y: box.y - 2 - h - shift },
    { x: box.x - 2 - w, y: box.y + 2 + shift },
    { x: box.x + box.w + 2, y: box.y + 2 + shift },
  ];
  const free = spots.find((spot) => {
    const area = { ...spot, w, h };
    return inside(area, bounds) && !avoid.some((other) => overlaps(area, other));
  });
  return free ?? { x: centre, y: box.y + 2 + shift };
}

function FloaterView(props: { floater: Floater; box: RigBox; stack: number; avoid: readonly RigBox[]; bounds: RigBox }) {
  const { floater, box, stack, avoid, bounds } = props;
  const ref = useRef<HTMLSpanElement>(null);
  const w = useGameWidth(ref);
  const strong = floater.kind === 'strong';
  const at = w === null ? null : floaterSpot(box, w, strong ? STRONG_LINE : LINE, stack, avoid, bounds);
  return (
    <span
      ref={ref}
      className={`floater is-${floater.kind}`}
      style={at ? { left: px(at.x), top: px(at.y) } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      <span className="tx">{floater.amount}</span>
      {strong && <Mark mark="strong" />}
      {floater.kind === 'weak' && <Mark mark="weak" />}
    </span>
  );
}

function Floaters({ width, height }: { width: number; height: number }) {
  const floaters = useBattle((s) => s.floaters);
  const boxes = useBattle((s) => s.rigBoxes);
  const hud = hudPlace(boxes[OPPONENT], width);
  const bounds = { x: 1, y: 1, w: width - 2, h: height - 2 };
  const seen = new Map<string, number>();
  return (
    <>
      {floaters.map((floater) => {
        const box = boxes[floater.side][floater.rig];
        if (!box) return null;
        const key = `${floater.side}:${floater.rig}`;
        const stack = seen.get(key) ?? 0;
        seen.set(key, stack + 1);
        const others = [...boxes[0], ...boxes[1]].filter((other) => other !== box);
        const avoid = hud ? [hud.area, ...others] : others;
        return <FloaterView key={floater.id} floater={floater} box={box} stack={stack} avoid={avoid} bounds={bounds} />;
      })}
    </>
  );
}

/** `height` is the scene's height (above the command panel), in game pixels. */
export function Stage({ width, height }: { width: number; height: number }) {
  return (
    <div className="stage">
      <DeckButtons />
      <DeckCooldowns />
      <OpponentHud width={width} />
      <Targets width={width} />
      <Floaters width={width} height={height} />
    </div>
  );
}
