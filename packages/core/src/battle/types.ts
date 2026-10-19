// Battle data shapes. Everything here is plain JSON (root contract 3).
import type { Genre } from '../genres.ts';

export type SideIndex = 0 | 1;
export type Level = 1 | 2 | 3;

// --- Decks: what gives a rig its 3 moves (a vinyl, or an opponent's instrument) ---

/** 'enemy' = the chosen rig of the other side; 'enemies' = every rig of the other side. */
export type EnemyTarget = 'enemy' | 'enemies';
/** 'ally' = the chosen rig of the acting side; 'allies' = every rig of the acting side. */
export type AllyTarget = 'ally' | 'allies';

export type Effect =
  | { kind: 'damage'; amount: number; to: EnemyTarget }
  | { kind: 'stun'; turns: number; to: EnemyTarget }
  /** Slows the other fighter. */
  | { kind: 'slow'; turns: number }
  /** Hastes the acting fighter. */
  | { kind: 'haste'; turns: number }
  | { kind: 'shield'; amount: number; to: AllyTarget }
  /** Sets a hidden trap on the chosen rig of the acting side (the action's `ally`). */
  | { kind: 'trap'; payload: TrapEffect[] };

/** What a trap does when it fires: it hits the rig that set it off, or that rig's fighter (slow). */
export type TrapEffect =
  | { kind: 'damage'; amount: number }
  | { kind: 'stun'; turns: number }
  | { kind: 'slow'; turns: number };

export interface PartnerBonus {
  /** Applies while a vinyl of this genre or artist sits on another of the owner's working rigs. */
  with: { genre: Genre } | { artist: string };
  /** Extra base damage on the move's damage effects, or PARTNER_COOLDOWN on its cooldown. */
  bonus: { kind: 'damage'; amount: number } | { kind: 'cooldown' };
}

export interface Move {
  /** Stable id, e.g. 'move/boom-bap-2'. Its display name lives in the locale files. */
  id: string;
  effects: Effect[];
  partner?: PartnerBonus;
}

export interface Deck {
  /** 'vinyl/<slug>' for a vinyl, 'rig/<slug>' for an opponent's instrument. */
  id: string;
  genre: Genre;
  /** 'artist/<slug>'. Vinyls only. */
  artist?: string;
  defender: boolean;
  /** Levels 1, 2 and 3, in that order. */
  moves: [Move, Move, Move];
}

// --- Setup: what a fight starts from ---

export interface RigSetup {
  /** Stable id of the rig itself, e.g. 'turntable/1' or 'rig/riff-amp'. */
  id: string;
  hp: number;
  /** Deck id loaded on this rig at the start. */
  deck: string;
}

export interface FighterSetup {
  /** 'fighter/scratch-boy', 'opponent/riff'… */
  id: string;
  arms: number;
  initiative: number;
  /** 1 to MAX_RIGS. For Scratch Boy: one per turntable, each with its starting vinyl. */
  rigs: RigSetup[];
  /** Vinyl ids carried in the bag and not loaded. Empty for opponents, who never swap. */
  bag: string[];
}

export interface BattleSetup {
  seed: number;
  /** Every deck this fight can use: loaded decks and the bag's vinyls. */
  decks: Record<string, Deck>;
  sides: [FighterSetup, FighterSetup];
}

// --- State ---

export interface Trap {
  payload: TrapEffect[];
}

export interface RigState {
  id: string;
  deck: string;
  hp: number;
  maxHp: number;
  /** Own turns this rig still sits out. 0 = ready (if not broken). */
  cooldown: number;
  shield: number;
  /** null when there is no trap, and always null for the other side's rigs in a view. */
  trap: Trap | null;
}

export interface FighterState {
  id: string;
  arms: number;
  initiative: number;
  rigs: RigState[];
  bag: string[];
  /** Own turns still to be slowed, counted from this fighter's next turn start. */
  slowTurns: number;
  hasteTurns: number;
  /** In a view of the other side: how many traps that side has set. Always 0 in the full state. */
  hiddenTraps: number;
}

export interface TurnState {
  /** 1 = the fight's first turn. Counts both sides' turns. */
  number: number;
  side: SideIndex;
  /** Rig indexes already touched this turn. */
  used: number[];
  /** Fixed at the start of the turn from slowTurns / hasteTurns. */
  slowed: boolean;
  hasted: boolean;
}

export interface BattleState {
  rng: number;
  decks: Record<string, Deck>;
  sides: [FighterState, FighterState];
  turn: TurnState;
  winner: SideIndex | null;
}

// --- Actions and events ---

export type Action =
  /** `target`: the other side's rig index, when a move has an 'enemy' effect.
   *  `ally`: the acting side's rig index, when a move has an 'ally' shield or a trap. */
  | { kind: 'scratch'; rig: number; level: Level; target?: number; ally?: number }
  | { kind: 'swap'; rig: number; vinyl: string }
  | { kind: 'end' };

export type Effectiveness = 'strong' | 'weak' | 'normal';

/** The only things the screen animates or plays a sound for (root contract 4). */
export type BattleEvent =
  | { type: 'battle-started'; first: SideIndex }
  | { type: 'turn-started'; side: SideIndex; turn: number }
  | { type: 'scratched'; side: SideIndex; rig: number; level: Level; move: string }
  | { type: 'swapped'; side: SideIndex; rig: number; out: string; in: string }
  /** `side`/`rig`: the rig that took the hit. `hp`: its HP after the hit. */
  | { type: 'hit'; side: SideIndex; rig: number; amount: number; hp: number; effectiveness: Effectiveness }
  /** A shield soaked `amount`; `shield` is what is left of it. */
  | { type: 'blocked'; side: SideIndex; rig: number; amount: number; shield: number }
  | { type: 'shield-raised'; side: SideIndex; rig: number; amount: number; shield: number }
  | { type: 'shield-faded'; side: SideIndex; rig: number }
  /** `rig` is null in the other side's events. */
  | { type: 'trap-set'; side: SideIndex; rig: number | null }
  /** `side`/`rig`: the trapped rig. `by`: the rig that set it off. */
  | { type: 'trap-fired'; side: SideIndex; rig: number; by: { side: SideIndex; rig: number } }
  | { type: 'stunned'; side: SideIndex; rig: number; turns: number; cooldown: number }
  | { type: 'slowed'; side: SideIndex; turns: number }
  | { type: 'hasted'; side: SideIndex; turns: number }
  | { type: 'cooldown-started'; side: SideIndex; rig: number; turns: number }
  | { type: 'cooldown-ticked'; side: SideIndex; rig: number; cooldown: number }
  | { type: 'rig-broken'; side: SideIndex; rig: number }
  | { type: 'turn-ended'; side: SideIndex }
  | { type: 'battle-won'; side: SideIndex };

export interface StepResult {
  state: BattleState;
  events: BattleEvent[];
}
