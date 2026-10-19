// Keyboard play. Tab / Shift+Tab, Enter and Space come with the real <button>s; these are the
// shortcuts: 1/2/3 pick a move, arrows switch turntables (or move between targets / bag vinyls),
// Esc cancels, E ends the turn, S opens the swap picker. Nothing works while input is locked, except
// Enter or Space for the next opening line.
import { useEffect } from 'react';
import { battleStore, cancel, endTurn, isLocked, nextLine, pickLevel, stepSelection, toggleSwap } from './store.ts';

/** Whether the player's last input was a key (not a tap or a click). The screen moves focus by
 *  itself (to the first target, the bag, the replay button) only then, so touch shows no focus ring. */
let keyboardLast = false;

/** Whether the last input was a key: focus then means a choice (a focused bag vinyl shows its moves). */
export function lastInputWasKey(): boolean {
  return keyboardLast;
}

/** Focuses the first button matching `selector` inside the battle UI, for keyboard players. */
export function focusFirst(selector: string): void {
  if (keyboardLast) document.querySelector<HTMLButtonElement>(`.battle ${selector}`)?.focus();
}

function focusables(selector: string): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(`.battle ${selector}`)];
}

/** Moves focus to the next (or previous) of these buttons, wrapping round. */
function cycle(buttons: HTMLButtonElement[], delta: number): void {
  if (buttons.length === 0) return;
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = at < 0 ? (delta > 0 ? 0 : buttons.length - 1) : (at + delta + buttons.length) % buttons.length;
  buttons[next]?.focus();
}

function onPointer(): void {
  keyboardLast = false;
}

function onKey(event: KeyboardEvent): void {
  keyboardLast = true;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const state = battleStore().getState();
  if (state.talk.length > 0) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      nextLine();
    }
    return;
  }
  if (isLocked(state)) return;
  const arrow = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
  let handled = true;
  if (arrow !== undefined) {
    if (state.pick) cycle(focusables('[data-target]'), arrow);
    else if (state.swapOpen) cycle(focusables('[data-bag]'), arrow);
    else {
      const onTab = document.activeElement instanceof HTMLElement && document.activeElement.dataset['tab'] !== undefined;
      stepSelection(arrow);
      if (onTab) focusables(`[data-tab="${battleStore().getState().selected}"]`)[0]?.focus();
    }
  } else if (event.key === 'Escape') {
    const back = state.pick ? `[data-level="${state.pick.level}"]` : state.swapOpen ? '[data-swap]' : null;
    cancel();
    if (back) focusables(back)[0]?.focus();
  } else if (event.key === '1' || event.key === '2' || event.key === '3') {
    pickLevel(Number(event.key) as 1 | 2 | 3);
  } else if (event.key === 'e' || event.key === 'E') {
    endTurn();
  } else if (event.key === 's' || event.key === 'S') {
    toggleSwap();
  } else {
    handled = false;
  }
  if (handled) event.preventDefault();
}

export function useBattleKeys(): void {
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, []);
}
