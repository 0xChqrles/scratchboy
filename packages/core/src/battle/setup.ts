// Starting a fight: check the setup, build the first state, pick who starts, start the first turn.
import { nextInt, seedRng } from '../rng.ts';
import { BAG_MAX, MAX_RIGS, MIN_RIGS, MOVE_LEVELS } from './constants.ts';
import { cloneJson, emit, type Draft } from './draft.ts';
import { beginTurn, canInteract, endTurn } from './turn.ts';
import type { BattleSetup, BattleState, Deck, FighterSetup, FighterState, SideIndex, StepResult } from './types.ts';

export function createBattle(setup: BattleSetup): StepResult {
  if (!Array.isArray(setup.sides) || setup.sides.length !== 2) throw new Error('a fight has exactly 2 sides');
  setup.sides.forEach((fighter) => checkFighter(setup.decks, fighter));
  const [a, b] = setup.sides;

  let rng = seedRng(setup.seed);
  let first: SideIndex;
  if (a.initiative !== b.initiative) {
    first = a.initiative > b.initiative ? 0 : 1;
  } else {
    const flip = nextInt(rng, 0, 1);
    rng = flip.rng;
    first = flip.value === 0 ? 0 : 1;
  }

  const state: BattleState = {
    rng,
    decks: cloneJson(setup.decks),
    sides: [fighterState(a), fighterState(b)],
    turn: { number: 1, side: first, used: [], slowed: false, hasted: false },
    winner: null,
  };
  const draft: Draft = { state, events: [], fixedSpread: null };
  emit(draft, { type: 'battle-started', first });
  beginTurn(draft, first, 1);
  if (!canInteract(state)) endTurn(draft);
  return { state, events: draft.events ?? [] };
}

function checkFighter(decks: Record<string, Deck>, fighter: FighterSetup): void {
  const who = `fighter '${fighter.id}'`;
  if (!Number.isInteger(fighter.arms) || fighter.arms < 1) throw new Error(`${who}: arms must be a whole number >= 1`);
  if (!Number.isFinite(fighter.initiative)) throw new Error(`${who}: initiative must be a number`);
  if (fighter.rigs.length < MIN_RIGS || fighter.rigs.length > MAX_RIGS) {
    throw new Error(`${who}: needs ${MIN_RIGS} to ${MAX_RIGS} rigs, has ${fighter.rigs.length}`);
  }
  for (const rig of fighter.rigs) {
    if (!Number.isInteger(rig.hp) || rig.hp < 1) throw new Error(`${who}: rig '${rig.id}' needs a whole HP >= 1`);
    checkDeck(decks, rig.deck, who);
  }
  for (const vinyl of fighter.bag) checkDeck(decks, vinyl, who);
  // Loaded vinyls count toward the bag. A fighter with an empty bag (an opponent) carries at most
  // MAX_RIGS decks, so this only ever limits a fighter that carries vinyls.
  if (fighter.rigs.length + fighter.bag.length > BAG_MAX) {
    throw new Error(`${who}: carries ${fighter.rigs.length + fighter.bag.length} vinyls, more than ${BAG_MAX}`);
  }
}

function checkDeck(decks: Record<string, Deck>, id: string, who: string): void {
  const deck = Object.hasOwn(decks, id) ? decks[id] : undefined;
  if (deck === undefined) throw new Error(`${who}: unknown deck '${id}'`);
  if (!Array.isArray(deck.moves) || deck.moves.length !== MOVE_LEVELS) {
    throw new Error(`deck '${id}' needs exactly ${MOVE_LEVELS} moves, one per level`);
  }
  if (deck.moves.some((move) => !Array.isArray(move?.effects))) throw new Error(`deck '${id}' has a move without effects`);
}

function fighterState(setup: FighterSetup): FighterState {
  return {
    id: setup.id,
    arms: setup.arms,
    initiative: setup.initiative,
    rigs: setup.rigs.map((rig) => ({
      id: rig.id,
      deck: rig.deck,
      hp: rig.hp,
      maxHp: rig.hp,
      cooldown: 0,
      shield: 0,
      trap: null,
    })),
    bag: [...setup.bag],
    slowTurns: 0,
    hasteTurns: 0,
    hiddenTraps: 0,
  };
}
