// The swap picker: the bag's vinyls, to put one on the selected turntable. Each shows how its genre
// fares against the opponent's working rigs (×2 / ×0,5). A first tap (or keyboard focus) shows the
// vinyl's moves in the moves area; a second tap (or Enter) swaps it in.
import { textKey } from '@scratchboy/content';
import { rigStatus, type BattleState, type Genre } from '@scratchboy/core';
import { useEffect, useMemo } from 'react';
import { slugOf } from '../sprites.ts';
import { useText } from '../text.tsx';
import { swapsOf } from './choices.ts';
import { Glyph, SpriteFrame } from './glyphs.tsx';
import { focusFirst, lastInputWasKey } from './keyboard.ts';
import { genreMark, Mark } from './parts.tsx';
import { cancel, chooseVinyl, OPPONENT, PLAYER, playerActions, previewVinyl, useBattle } from './store.ts';

const px = (n: number): string => `${n}px`;

/** Three 100 px columns (the longest genre name and a marker fit), their gaps, the padding and the border. */
const PICKER_W = 310;

/** The markers a genre earns against the opponent's working rigs, each once. */
function marksAgainst(view: BattleState, genre: Genre): ('strong' | 'weak')[] {
  const marks = new Set<'strong' | 'weak'>();
  view.sides[OPPONENT].rigs.forEach((rig, i) => {
    const deck = view.decks[rig.deck];
    if (!deck || rigStatus(view, OPPONENT, i).state === 'broken') return;
    const mark = genreMark(genre, deck.genre);
    if (mark) marks.add(mark);
  });
  return [...marks];
}

export function SwapPicker({ width, sceneHeight }: { width: number; sceneHeight: number }) {
  const t = useText();
  const open = useBattle((s) => s.swapOpen);
  const view = useBattle((s) => s.view);
  const selected = useBattle((s) => s.selected);
  const preview = useBattle((s) => s.preview);
  const swaps = useMemo(() => swapsOf(playerActions(view), selected), [view, selected]);

  useEffect(() => {
    if (open) focusFirst('[data-bag]');
  }, [open]);

  if (!open) return null;
  const bag = view.sides[PLAYER].bag.filter((id, i, all) => all.indexOf(id) === i);
  const rows = Math.ceil(bag.length / 3);
  const height = 17 + rows * 22 + (rows - 1) * 2;
  const pickerWidth = Math.min(PICKER_W, width - 4);
  const left = Math.max(2, Math.floor((width - pickerWidth) / 2));
  const top = Math.max(2, sceneHeight - height - 2);
  return (
    <div
      className="picker"
      role="dialog"
      aria-label={t('ui.bag')}
      style={{ left: px(left), top: px(top), width: px(pickerWidth), height: px(height) }}
    >
      <div className="picker-head">
        <span className="tx">{t('ui.bag')}</span>
        <button type="button" className="close can" aria-label={t('ui.close')} onClick={cancel}>
          <Glyph name="close" />
        </button>
      </div>
      <div className="picker-grid">
        {bag.map((vinyl) => {
          const can = swaps.some((swap) => swap.vinyl === vinyl);
          const deck = view.decks[vinyl];
          const chosen = preview === vinyl;
          return (
            <button
              key={vinyl}
              type="button"
              className={['bag-item', can && 'can', chosen && 'is-selected'].filter(Boolean).join(' ')}
              aria-disabled={!can}
              aria-pressed={chosen}
              data-bag={vinyl}
              onFocus={() => {
                if (lastInputWasKey()) previewVinyl(vinyl);
              }}
              onClick={() => chooseVinyl(vinyl)}
            >
              <SpriteFrame sheet="vinyl-icon" tag={`vinyl-icon-${slugOf(vinyl)}`} size={16} />
              <span className="bag-text">
                <span className="name tx">{t(textKey(vinyl))}</span>
                <span className="line">
                  <span className="dim tx genre">{deck ? t(`genre.${deck.genre}`) : ''}</span>
                  {deck && marksAgainst(view, deck.genre).map((mark) => <Mark key={mark} mark={mark} />)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
