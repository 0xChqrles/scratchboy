// The lines said before the fight, one at a time, in a box in the command panel's place. The whole
// view is the button: a tap anywhere (or Enter or Space, keyboard.ts) shows the next line, and after
// the last one the panel comes and the fight starts.
import { textKey } from '@scratchboy/content';
import { useText } from '../text.tsx';
import { nextLine, useBattle } from './store.ts';

export function Talk() {
  const t = useText();
  const line = useBattle((s) => s.talk[0]);
  if (!line) return null;
  return (
    <button type="button" className="talk" tabIndex={-1} data-talk="" onClick={nextLine}>
      <span className="talk-box">
        <span className="talk-frame can" role="status">
          <span className="talk-name tx">{t(textKey(line.speaker))}</span>
          <span className="talk-text tx">{t(line.text)}</span>
        </span>
      </span>
    </button>
  );
}
