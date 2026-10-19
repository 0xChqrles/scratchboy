// Read-only facts about a battle that several rules share: rigs, decks, moves, readiness, mixes,
// partner bonuses, defenders and what a move needs from its action.
import { mixOf, type Genre, type Mix } from '../genres.ts';
import type { BattleState, Deck, FighterState, Level, Move, RigState, SideIndex } from './types.ts';

export const LEVELS: readonly Level[] = [1, 2, 3];

/** A rig of one side. */
export interface RigRef {
  side: SideIndex;
  rig: number;
}

export function otherSide(side: SideIndex): SideIndex {
  return side === 0 ? 1 : 0;
}

export function rigOf(state: BattleState, side: SideIndex, index: number): RigState {
  const rig = state.sides[side].rigs[index];
  if (rig === undefined) throw new Error(`side ${side} has no rig ${index}`);
  return rig;
}

export function deckOf(decks: Record<string, Deck>, rig: RigState): Deck {
  const deck = decks[rig.deck];
  if (deck === undefined) throw new Error(`unknown deck '${rig.deck}'`);
  return deck;
}

export function moveOf(deck: Deck, level: Level): Move {
  const move = deck.moves[level - 1];
  if (move === undefined) throw new Error(`deck '${deck.id}' has no level ${level} move`);
  return move;
}

/** A rig works until its HP reaches 0; then it is broken for the rest of the fight. */
export function isWorking(rig: RigState): boolean {
  return rig.hp > 0;
}

export function workingCount(fighter: FighterState): number {
  return fighter.rigs.filter(isWorking).length;
}

/** Ready: working, not cooling, and not yet touched in its owner's current turn. */
export function isReady(state: BattleState, side: SideIndex, index: number): boolean {
  const rig = state.sides[side].rigs[index];
  if (rig === undefined || !isWorking(rig) || rig.cooldown !== 0) return false;
  return !(state.turn.side === side && state.turn.used.includes(index));
}

/** The genres on the fighter's working rigs other than rig `index`. */
function otherGenres(decks: Record<string, Deck>, fighter: FighterState, index: number): Genre[] {
  const genres: Genre[] = [];
  fighter.rigs.forEach((rig, i) => {
    if (i !== index && isWorking(rig)) genres.push(deckOf(decks, rig).genre);
  });
  return genres;
}

/** The mix rule: how rig `index`'s deck mixes with the decks on the fighter's other working rigs. */
export function mixAt(decks: Record<string, Deck>, fighter: FighterState, index: number): Mix {
  const rig = fighter.rigs[index];
  if (rig === undefined) throw new Error(`no rig ${index}`);
  return mixOf(deckOf(decks, rig).genre, otherGenres(decks, fighter, index));
}

/** A partner bonus applies while a deck of its genre or artist sits on another working rig of the owner. */
export function partnerMet(
  decks: Record<string, Deck>,
  fighter: FighterState,
  index: number,
  move: Move,
): boolean {
  const partner = move.partner;
  if (partner === undefined) return false;
  const want = partner.with;
  return fighter.rigs.some((rig, i) => {
    if (i === index || !isWorking(rig)) return false;
    const deck = deckOf(decks, rig);
    return 'genre' in want ? deck.genre === want.genre : deck.artist === want.artist;
  });
}

/** Extra base damage the move's partner bonus adds to each of its damage effects right now. */
export function partnerDamage(
  decks: Record<string, Deck>,
  fighter: FighterState,
  index: number,
  move: Move,
): number {
  const bonus = move.partner?.bonus;
  if (bonus === undefined || bonus.kind !== 'damage') return 0;
  return partnerMet(decks, fighter, index, move) ? bonus.amount : 0;
}

/** Whether the move's cooldown partner bonus applies right now. */
export function partnerCooldown(
  decks: Record<string, Deck>,
  fighter: FighterState,
  index: number,
  move: Move,
): boolean {
  return move.partner?.bonus.kind === 'cooldown' && partnerMet(decks, fighter, index, move);
}

/** The defender rule: the rigs of `fighter` an 'enemy' effect may aim at — its working defenders
 *  while it has any, otherwise every working rig. */
export function enemyTargets(decks: Record<string, Deck>, fighter: FighterState): number[] {
  const working: number[] = [];
  const defenders: number[] = [];
  fighter.rigs.forEach((rig, i) => {
    if (!isWorking(rig)) return;
    working.push(i);
    if (deckOf(decks, rig).defender) defenders.push(i);
  });
  return defenders.length > 0 ? defenders : working;
}

/** The move needs the action's `target` iff it has an 'enemy' effect. */
export function needsTarget(move: Move): boolean {
  return move.effects.some((e) => (e.kind === 'damage' || e.kind === 'stun') && e.to === 'enemy');
}

/** The move needs the action's `ally` iff it has an 'ally' shield or a trap. */
export function needsAlly(move: Move): boolean {
  return move.effects.some((e) => (e.kind === 'shield' && e.to === 'ally') || e.kind === 'trap');
}

export function setsTrap(move: Move): boolean {
  return move.effects.some((e) => e.kind === 'trap');
}
