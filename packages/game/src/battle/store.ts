// The battle's whole state and flow. The player is side 0. Every action goes through core's
// legalActions and step; the scene animates each step's events in order and lands their values on
// the displayed state (`shown`) one by one; the computer opponent plays once the animations drain.
import {
  chooseAction,
  createBattle,
  eventsFor,
  legalActions,
  step,
  viewFor,
  type Action,
  type BattleEvent,
  type BattleState,
  type Level,
  type SideIndex,
} from '@scratchboy/core';
import { FIGHT_INTROS, FIGHTS, type Line } from '@scratchboy/content';
import { createStore, useStore, type StoreApi } from 'zustand';
import { reducedMotion } from '../motion.ts';
import {
  canEnd,
  needOf,
  rigCanAct,
  scratchesOf,
  swapsOf,
  withAlly,
  type Need,
  type Pick,
} from './choices.ts';
import { applyEvent } from './shown.ts';

export const PLAYER: SideIndex = 0;
export const OPPONENT: SideIndex = 1;

/** The beat between the end of the animations and the computer opponent's next action. */
const OPPONENT_PAUSE_MS = 400;
/** How long a damage number stays on screen. */
const FLOATER_MS = 900;
const FLOATER_REDUCED_MS = 600;
/** How long a short event word stays in the message line. */
const NOTE_MS = 1400;

/** A box in game pixels, in the visible area's coordinates. */
export interface RigBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One step's events (as the player sees them) and the view they lead to. */
export interface Batch {
  events: BattleEvent[];
  view: BattleState;
}

export type FloaterKind = 'strong' | 'normal' | 'weak' | 'blocked';

export interface Floater {
  id: number;
  side: SideIndex;
  rig: number;
  amount: number;
  kind: FloaterKind;
}

export interface BattleStore {
  /** Counts fights started in this page: a replay is a new fight. */
  fight: number;
  fixture: string;
  seed: number;
  /** The full state. Only `step` and `chooseAction` read it. */
  truth: BattleState;
  /** viewFor(truth, PLAYER): what the player may see, once every queued event has played. */
  view: BattleState;
  /** What the HUD shows now: the view, as far as the animations have got. */
  shown: BattleState;
  /** The step being played still holds the end of the turn on screen: its side has no free hand
   *  left, even when a cooldown tick on the way out has made a rig ready for its next turn. */
  shownTurnEnds: boolean;
  /** Rigs shown as stunned, by side then rig: set by a 'stunned' event, gone once the rig is ready. */
  stunned: boolean[][];
  /** Steps whose events the scene has still to play, oldest first. */
  batches: Batch[];
  /** The player's selected turntable. */
  selected: number;
  /** A move picked on the selected turntable, waiting for its target or ally. */
  pick: Pick | null;
  swapOpen: boolean;
  /** The bag vinyl shown in the moves area while the swap picker is open: a second tap swaps it in. */
  preview: string | null;
  /** Each rig's on-screen box, reported by the scene. */
  rigBoxes: [RigBox[], RigBox[]];
  floaters: Floater[];
  /** A short event word for the message line (a locale key), or null. */
  note: string | null;
  /** The lines still to be said before the fight starts; the first is on screen. The fight waits
   *  until they are done. */
  talk: readonly Line[];
}

let store: StoreApi<BattleStore> | null = null;
let opponentTimer: ReturnType<typeof setTimeout> | null = null;
let noteTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;

export function battleStore(): StoreApi<BattleStore> {
  if (!store) throw new Error('startBattle() has not been called');
  return store;
}

export function useBattle<T>(selector: (state: BattleStore) => T): T {
  return useStore(battleStore(), selector);
}

function get(): BattleStore {
  return battleStore().getState();
}

function set(patch: Partial<BattleStore>): void {
  battleStore().setState(patch);
}

/** A fresh random seed for a fight. */
export function newSeed(): number {
  const words = new Uint32Array(1);
  crypto.getRandomValues(words);
  return words[0] ?? 0;
}

function freshFight(fixture: string, seed: number): BattleStore {
  const setup = FIGHTS[fixture];
  if (!setup) throw new Error(`unknown fight fixture '${fixture}'`);
  const { state } = createBattle(setup(seed));
  const view = viewFor(state, PLAYER);
  const previous = store?.getState();
  const fight = (previous?.fight ?? 0) + 1;
  return {
    fight,
    fixture,
    seed,
    truth: state,
    view,
    shown: view,
    shownTurnEnds: false,
    stunned: view.sides.map((side) => side.rigs.map(() => false)),
    batches: [],
    selected: firstActiveRig(view),
    pick: null,
    swapOpen: false,
    preview: null,
    rigBoxes: previous?.rigBoxes ?? [[], []],
    floaters: [],
    note: null,
    // Said once per page: a replay starts straight away.
    talk: fight === 1 ? (FIGHT_INTROS[fixture] ?? []) : [],
  };
}

/** Starts (or restarts) a fight from a fixture and a seed. */
export function startBattle(fixture: string, seed: number): void {
  if (opponentTimer !== null) clearTimeout(opponentTimer);
  if (noteTimer !== null) clearTimeout(noteTimer);
  opponentTimer = null;
  noteTimer = null;
  const fresh = freshFight(fixture, seed);
  if (store) store.setState(fresh, true);
  else store = createStore<BattleStore>(() => fresh);
  settle();
}

/** The same fixture again, with a new seed. */
export function replay(): void {
  startBattle(get().fixture, newSeed());
}

// ------------------------------------------------------------------------------------ reading

/** Input is locked while the opening lines are said, while animations run, on the opponent's turn
 *  and once the fight is over. */
export function isLocked(state: BattleStore): boolean {
  return state.talk.length > 0 || state.batches.length > 0 || state.truth.turn.side !== PLAYER || state.truth.winner !== null;
}

/** The player's legal actions right now (none while it is not the player's turn). */
export function playerActions(view: BattleState): Action[] {
  return legalActions(view, PLAYER);
}

/** What the picked move still needs, from the legal actions. */
export function currentNeed(state: BattleStore): Need | null {
  if (!state.pick) return null;
  return needOf(scratchesOf(playerActions(state.view), state.selected, state.pick.level), state.pick);
}

function firstActiveRig(view: BattleState): number {
  const actions = playerActions(view);
  const index = view.sides[PLAYER].rigs.findIndex((_, i) => rigCanAct(actions, i));
  return Math.max(0, index);
}

// ------------------------------------------------------------------------------------ the flow

function sameAction(a: Action, b: Action): boolean {
  const x = a as unknown as Record<string, unknown>;
  const y = b as unknown as Record<string, unknown>;
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every((key) => x[key] === y[key]);
}

function queueStep(truth: BattleState, events: BattleEvent[]): void {
  const view = viewFor(truth, PLAYER);
  set({ truth, view, batches: [...get().batches, { events: eventsFor(events, PLAYER), view }] });
}

/** Plays one of the player's legal actions. Anything else is ignored. */
function play(action: Action): void {
  const state = get();
  if (isLocked(state)) return;
  if (!playerActions(state.view).some((legal) => sameAction(legal, action))) return;
  const result = step(state.truth, PLAYER, action);
  set({ pick: null, swapOpen: false, preview: null });
  queueStep(result.state, result.events);
}

/** After the opening lines and the animations: the opponent plays, or the player gets a turntable
 *  that can act. */
function settle(): void {
  const state = get();
  if (state.talk.length > 0 || state.batches.length > 0 || state.truth.winner !== null) return;
  if (state.truth.turn.side === OPPONENT) {
    scheduleOpponent();
    return;
  }
  if (!rigCanAct(playerActions(state.view), state.selected)) set({ selected: firstActiveRig(state.view) });
}

function scheduleOpponent(): void {
  if (opponentTimer !== null) return;
  const fight = get().fight;
  opponentTimer = setTimeout(
    () => {
      opponentTimer = null;
      const state = get();
      const waiting = state.batches.length > 0 || state.truth.winner !== null;
      if (state.fight !== fight || waiting || state.truth.turn.side !== OPPONENT) return;
      const result = step(state.truth, OPPONENT, chooseAction(state.truth, OPPONENT));
      queueStep(result.state, result.events);
    },
    reducedMotion() ? 0 : OPPONENT_PAUSE_MS,
  );
}

// ------------------------------------------------------------------------------------ the scene's calls

/** The scene's impact moment for one event: its resulting values land on the displayed state. */
export function landEvent(fight: number, event: BattleEvent): void {
  const state = get();
  if (state.fight !== fight) return;
  const shown = applyEvent(state.shown, event);
  const batch = state.batches[0];
  const rest = batch ? batch.events.slice(batch.events.indexOf(event) + 1) : [];
  const shownTurnEnds = rest.some((later) => later.type === 'turn-ended' && later.side === shown.turn.side);
  const patch: Partial<BattleStore> = { shown, shownTurnEnds };
  if (event.type === 'stunned') {
    patch.stunned = state.stunned.map((rigs, side) => rigs.map((on, rig) => on || (side === event.side && rig === event.rig)));
  }
  if (event.type === 'hit' || event.type === 'blocked') {
    const kind: FloaterKind = event.type === 'blocked' ? 'blocked' : event.effectiveness;
    const floater: Floater = { id: nextId++, side: event.side, rig: event.rig, amount: event.amount, kind };
    patch.floaters = [...state.floaters, floater];
    setTimeout(
      () => {
        const now = get();
        if (now.fight === fight) set({ floaters: now.floaters.filter((f) => f.id !== floater.id) });
      },
      reducedMotion() ? FLOATER_REDUCED_MS : FLOATER_MS,
    );
  }
  set(patch);
  if (event.type === 'trap-fired') showNote('ui.trap-fired');
  if (event.type === 'trap-set' && event.rig === null) showNote('ui.trap-set');
}

function showNote(key: string): void {
  if (noteTimer !== null) clearTimeout(noteTimer);
  set({ note: key });
  noteTimer = setTimeout(() => {
    noteTimer = null;
    set({ note: null });
  }, NOTE_MS);
}

/** The scene has played a whole step: the displayed state becomes the view exactly. */
export function finishBatch(fight: number, batch: Batch): void {
  const state = get();
  const [done, ...rest] = state.batches;
  if (state.fight !== fight || !done || done !== batch) return;
  const stunned = state.stunned.map((rigs, side) =>
    rigs.map((on, rig) => {
      const shownRig = done.view.sides[side]?.rigs[rig];
      return on && shownRig !== undefined && shownRig.hp > 0 && shownRig.cooldown > 0;
    }),
  );
  set({ shown: done.view, shownTurnEnds: false, batches: rest, stunned });
  settle();
}

export function reportRigBoxes(side: SideIndex, boxes: RigBox[]): void {
  const state = get();
  if (JSON.stringify(state.rigBoxes[side]) === JSON.stringify(boxes)) return;
  const rigBoxes: [RigBox[], RigBox[]] = [...state.rigBoxes];
  rigBoxes[side] = boxes;
  set({ rigBoxes });
}

// ------------------------------------------------------------------------------------ the player's input

/** Shows the next opening line; after the last one, the fight starts. */
export function nextLine(): void {
  const state = get();
  if (state.talk.length === 0) return;
  set({ talk: state.talk.slice(1) });
  settle();
}

export function selectRig(rig: number): void {
  const state = get();
  if (isLocked(state) || rig < 0 || rig >= state.view.sides[PLAYER].rigs.length) return;
  set({ selected: rig, pick: null, swapOpen: false, preview: null });
}

/** Moves the selection by `delta` turntables, wrapping round. */
export function stepSelection(delta: number): void {
  const count = get().view.sides[PLAYER].rigs.length;
  selectRig((get().selected + delta + count) % count);
}

/** Picks the selected turntable's move of this level; picking it again cancels. */
export function pickLevel(level: Level): void {
  const state = get();
  if (isLocked(state)) return;
  if (state.pick?.level === level) {
    cancel();
    return;
  }
  const options = scratchesOf(playerActions(state.view), state.selected, level);
  const need = needOf(options, { level, target: null });
  if (!need) return;
  if (need.kind === 'ready') play(need.action);
  else set({ pick: { level, target: null }, swapOpen: false, preview: null });
}

export function pickTarget(target: number): void {
  const state = get();
  const need = currentNeed(state);
  if (isLocked(state) || !state.pick || need?.kind !== 'target' || !need.rigs.includes(target)) return;
  const pick: Pick = { ...state.pick, target };
  const after = needOf(scratchesOf(playerActions(state.view), state.selected, pick.level), pick);
  if (after?.kind === 'ready') play(after.action);
  else if (after?.kind === 'ally') set({ pick });
}

export function pickAlly(ally: number): void {
  const state = get();
  const need = currentNeed(state);
  if (isLocked(state) || !state.pick || need?.kind !== 'ally' || !need.rigs.includes(ally)) return;
  const action = withAlly(scratchesOf(playerActions(state.view), state.selected, state.pick.level), state.pick, ally);
  if (action) play(action);
}

export function cancel(): void {
  set({ pick: null, swapOpen: false, preview: null });
}

export function toggleSwap(): void {
  const state = get();
  if (isLocked(state)) return;
  if (state.swapOpen) cancel();
  else if (swapsOf(playerActions(state.view), state.selected).length > 0) set({ swapOpen: true, pick: null, preview: null });
}

/** Shows a bag vinyl's moves in the moves area, without swapping it in yet. */
export function previewVinyl(vinyl: string): void {
  const state = get();
  if (isLocked(state) || !state.swapOpen) return;
  if (swapsOf(playerActions(state.view), state.selected).some((a) => a.vinyl === vinyl)) set({ preview: vinyl });
}

/** A tap on a bag vinyl: the first shows its moves, a second one (or Enter) swaps it in. */
export function chooseVinyl(vinyl: string): void {
  const state = get();
  if (state.preview !== vinyl) {
    previewVinyl(vinyl);
    return;
  }
  const action = swapsOf(playerActions(state.view), state.selected).find((a) => a.vinyl === vinyl);
  if (action) play(action);
}

export function endTurn(): void {
  if (canEnd(playerActions(get().view))) play({ kind: 'end' });
}
