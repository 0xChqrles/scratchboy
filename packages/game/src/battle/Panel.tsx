// The command panel: Scratch Boy's turntables as tabs (left), the selected turntable's three moves
// (middle), swap and end turn (right), and one message line with his status and free hands. At the
// end of the fight the result and the replay button take the place of the moves and the buttons.
import { textKey } from '@scratchboy/content';
import {
  armsLeft,
  rigMix,
  rigStatus,
  scratchCooldown,
  slowAndHasteTurns,
  type BattleState,
  type Level,
  type RigStatus,
} from '@scratchboy/core';
import { useEffect, useMemo } from 'react';
import { fill } from '../i18n.ts';
import { slugOf } from '../sprites.ts';
import { useText } from '../text.tsx';
import { canEnd, scratchesOf, swapsOf } from './choices.ts';
import { Glyph, SpriteFrame } from './glyphs.tsx';
import { focusFirst } from './keyboard.ts';
import { EffectSummary, HpBar, Stat, statusGlyph } from './parts.tsx';
import {
  endTurn,
  isLocked,
  OPPONENT,
  pickLevel,
  PLAYER,
  playerActions,
  replay,
  selectRig,
  toggleSwap,
  useBattle,
} from './store.ts';

const LEVELS: readonly Level[] = [1, 2, 3];
const TAB_HP_WIDTH = 24;

function cls(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

function Tab({ index, selected, tappable }: { index: number; selected: boolean; tappable: boolean }) {
  const t = useText();
  const shown = useBattle((s) => s.shown);
  const rig = shown.sides[PLAYER].rigs[index];
  if (!rig) return null;
  const deck = shown.decks[rig.deck];
  const status = rigStatus(shown, PLAYER, index);
  const working = status.state !== 'broken';
  const mix = working ? rigMix(shown, PLAYER, index) : 'neutral';
  const state = statusGlyph(status);
  return (
    <button
      type="button"
      className={cls('tab', tappable && 'can', selected && 'is-selected', !working && 'is-broken')}
      aria-pressed={selected}
      aria-disabled={!tappable}
      data-tab={index}
      onClick={() => selectRig(index)}
    >
      <SpriteFrame sheet="vinyl-icon" tag={`vinyl-icon-${slugOf(rig.deck)}`} size={16} />
      <span className="tab-text">
        <span className="line">
          <span className="name tx">{t(textKey(rig.deck))}</span>
          <span className="slot">{deck?.defender && working && <Glyph name="defender" />}</span>
          <span className="slot">
            {mix === 'good' && <Glyph name="mix-good" />}
            {mix === 'clash' && <Glyph name="mix-clash" />}
          </span>
        </span>
        <span className="line">
          <HpBar hp={rig.hp} max={rig.maxHp} width={TAB_HP_WIDTH} />
          <span className="num tx">{rig.hp}</span>
          <span className="slot slot-shield">{status.shield > 0 && <Stat glyph="shield" value={status.shield} />}</span>
          <span className="slot">{working && rig.trap !== null && <Glyph name="trap" />}</span>
          <span className="slot slot-state">
            <Stat glyph={state.glyph} {...(state.value !== undefined ? { value: state.value } : {})} />
          </span>
        </span>
      </span>
    </button>
  );
}

/** The displayed state with `vinyl` on turntable `rig`: core then says what its moves would cost there. */
function withVinyl(state: BattleState, rig: number, vinyl: string): BattleState {
  const next = structuredClone(state);
  const target = next.sides[PLAYER].rigs[rig];
  if (target) target.deck = vinyl;
  return next;
}

function MoveButton(props: {
  level: Level;
  state: BattleState;
  rig: number;
  can: boolean;
  picked: boolean;
  /** Why the turntable can't play now (broken, cooling, used this turn), shown in place of the
   *  cooldown the move would start. */
  reason: RigStatus | null;
}) {
  const t = useText();
  const { level, state, rig, can, picked, reason } = props;
  const loaded = state.sides[PLAYER].rigs[rig];
  const move = loaded ? state.decks[loaded.deck]?.moves[level - 1] : undefined;
  if (!move) return <span className="move" />;
  return (
    <button
      type="button"
      className={cls('move', can && 'can', picked && 'is-selected')}
      aria-disabled={!can}
      aria-pressed={picked}
      data-level={level}
      onClick={() => pickLevel(level)}
    >
      <span className="move-name">
        <span className="tx">
          <span className="key">{level}</span> {t(textKey(move.id))}
        </span>
      </span>
      <span className="line move-info">
        <span className="slot slot-state">
          {reason ? <Glyph name={statusGlyph(reason).glyph} /> : <Stat glyph="cooldown" value={scratchCooldown(state, PLAYER, rig, level)} />}
        </span>
        <EffectSummary move={move} />
      </span>
    </button>
  );
}

/** The selected turntable's moves, as the HUD shows it now. Tappable only once the animations are
 *  done and legalActions offers them. While the bag is open, a chosen vinyl's moves show here,
 *  read-only. */
function Moves() {
  const shown = useBattle((s) => s.shown);
  const view = useBattle((s) => s.view);
  const selected = useBattle((s) => s.selected);
  const pick = useBattle((s) => s.pick);
  const preview = useBattle((s) => s.preview);
  const locked = useBattle(isLocked);
  const actions = useMemo(() => playerActions(view), [view]);
  const state = useMemo(() => (preview ? withVinyl(shown, selected, preview) : shown), [preview, shown, selected]);
  if (!shown.sides[PLAYER].rigs[selected]) return <div className="moves" />;
  const status = rigStatus(shown, PLAYER, selected);
  const reason = !preview && status.state !== 'ready' ? status : null;
  return (
    <div className={cls('moves', preview && 'is-preview')}>
      {LEVELS.map((level) => (
        <MoveButton
          key={level}
          level={level}
          state={state}
          rig={selected}
          can={!locked && !preview && scratchesOf(actions, selected, level).length > 0}
          picked={pick?.level === level}
          reason={reason}
        />
      ))}
    </div>
  );
}

function Message() {
  const t = useText();
  const shown = useBattle((s) => s.shown);
  const note = useBattle((s) => s.note);
  const turnEnds = useBattle((s) => s.shownTurnEnds);
  const me = shown.sides[PLAYER];
  const { slow, haste } = slowAndHasteTurns(shown, PLAYER);
  const free = turnEnds ? 0 : armsLeft(shown, PLAYER);
  let text = '';
  if (note) text = t(note);
  else if (shown.winner === null) {
    text = shown.turn.side === PLAYER ? t('ui.your-turn') : fill(t('ui.their-turn'), { name: t(textKey(shown.sides[OPPONENT].id)) });
  }
  return (
    <div className="message">
      <span className="status">
        <span className="slot slot-status">{slow > 0 && <Stat glyph="slow" value={slow} />}</span>
        <span className="slot slot-status">{haste > 0 && <Stat glyph="haste" value={haste} />}</span>
      </span>
      <span className={cls('message-text tx', note && 'is-note')} role="status">
        {text}
      </span>
      <span className="arms" role="img" aria-label={fill(t('ui.arms'), { n: free })}>
        {Array.from({ length: me.arms }, (_, i) => (
          <Glyph key={i} name={i < free ? 'hand' : 'hand-used'} />
        ))}
      </span>
    </div>
  );
}

/** The end of the fight: the result word where the moves were. The scene already shows who is down. */
function Result() {
  const t = useText();
  const won = useBattle((s) => s.shown.winner === PLAYER);
  return (
    <div className="result" role="status">
      <span className={cls('result-title tx', won ? 'is-won' : 'is-lost')}>{won ? t('ui.win') : t('ui.lose')}</span>
    </div>
  );
}

function ReplayButton() {
  const t = useText();
  useEffect(() => focusFirst('[data-replay]'), []);
  return (
    <button type="button" className="btn btn-replay can" data-replay="" onClick={replay}>
      <span className="tx">{t('ui.replay')}</span>
    </button>
  );
}

export function Panel() {
  const t = useText();
  const view = useBattle((s) => s.view);
  const selected = useBattle((s) => s.selected);
  const swapOpen = useBattle((s) => s.swapOpen);
  const locked = useBattle(isLocked);
  const over = useBattle((s) => s.shown.winner !== null && s.batches.length === 0);
  const actions = useMemo(() => playerActions(view), [view]);
  const count = view.sides[PLAYER].rigs.length;
  const canSwap = !locked && swapsOf(actions, selected).length > 0;
  const canEndTurn = !locked && canEnd(actions);
  return (
    <div className="panel">
      <div className="tabs" style={{ gridTemplateRows: `repeat(${count <= 2 ? count : 2}, 1fr)` }} data-count={count}>
        {view.sides[PLAYER].rigs.map((_, i) => (
          <Tab key={i} index={i} selected={i === selected} tappable={!locked} />
        ))}
      </div>
      <Message />
      {over ? <Result /> : <Moves />}
      <div className="side">
        {over ? (
          <ReplayButton />
        ) : (
          <>
            <button
              type="button"
              className={cls('btn btn-swap', canSwap && 'can', swapOpen && 'is-selected')}
              aria-disabled={!canSwap}
              aria-expanded={swapOpen}
              aria-label={t('ui.swap')}
              data-swap=""
              onClick={toggleSwap}
            >
              <span className="tx">{t('ui.bag')}</span>
            </button>
            <button
              type="button"
              className={cls('btn btn-end', canEndTurn && 'can')}
              aria-disabled={!canEndTurn}
              onClick={endTurn}
            >
              <span className="tx">{t('ui.end-turn')}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
