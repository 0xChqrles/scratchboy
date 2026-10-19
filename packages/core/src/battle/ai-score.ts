// How the computer opponent judges the state its turn would end in. Higher is better for `me`.
//
// Each rig of the other side broken this turn outweighs everything else, so a kill is always taken
// when one is there; among plans that break as many rigs, the rest decides. The rest is counted in
// HP-sized points:
// - the other side's rigs cost their HP, plus what breaking them is worth (more for rigs that hit
//   hard, and more per HP as a rig gets close to breaking);
// - the damage the other side is likely to deal next turn costs points (so shields, stuns and kills
//   of ready rigs are worth the damage they prevent);
// - each own rig earns its per-turn value for the turns it will be ready (so a big cooldown costs
//   the turns it takes away), and stuns earn the other side's turns they take away;
// - slows, hastes and traps earn the turns or damage they are likely to cost or save.
import { cooldownFor } from './cooldown.ts';
import { damageAmount, mixDamagePct } from './damage.ts';
import { deckOf, enemyTargets, isWorking, LEVELS, mixAt, moveOf, otherSide, partnerDamage, workingCount } from './facts.ts';
import type { BattleState, Deck, FighterState, RigState, SideIndex } from './types.ts';

const WIN = 1e9;
/** One rig of the other side broken this turn: more than any HP-sized score can add up to. */
const KILL = 1e6;
/** Own turns ahead that future value is counted for. */
const HORIZON = 3;
/** A turn of future value is worth less than damage done now. */
const FUTURE = 0.8;
/** Weight of the damage the other side is likely to deal in its next turn. */
const INCOMING = 0.9;
/** Breaking a rig is worth this share of its max HP, plus its per-turn value times KILL_RATE_TURNS. */
const KILL_HP = 0.5;
const KILL_RATE_TURNS = 6;
/** Extra cost of a rig's HP, as a share of its max HP, that grows faster as the rig nears 0. */
const LOW_HP = 0.25;
/** A shield point counts as this much of a damage point in a rig's per-turn value. */
const SHIELD_RATE = 0.5;
/** Haste only shortens cooldowns above MIN_COOLDOWN, so it counts for part of a turn. */
const HASTE_SHARE = 0.5;
/** Chance a trap fires: on a defender (that 'enemy' moves must target), on another rig while
 *  defenders stand, and with no defenders it is spread over the other side's arms. */
const TRAP_SURE = 0.9;
const TRAP_STRAY = 0.3;

export type Scorer = (state: BattleState) => number;

/** Builds the scorer for one decision. `root` is `me`'s view at the start of the decision. */
export function makeScorer(root: BattleState, me: SideIndex): Scorer {
  const foe = otherSide(me);
  const decks = root.decks;
  const rootFoe = root.sides[foe];
  const standing = workingCount(rootFoe);
  // Per-turn values come from the start of the decision, so a plan never looks worse because a
  // kill left an own rig with weaker targets.
  const foeRates = rootFoe.rigs.map((_, i) => rigRate(decks, rootFoe, i, root.sides[me]));
  // Within one decision only own decks (swaps) and which enemy rigs still work (kills) change,
  // so what depends on them alone is computed once per combination.
  const rateCache = new Map<string, number[]>();
  const tableCache = new Map<string, (LevelHits[] | null)[]>();
  const ownRates = (mine: FighterState, key: string): number[] => {
    let rates = rateCache.get(key);
    if (rates === undefined) {
      rates = mine.rigs.map((_, i) => rigRate(decks, mine, i, rootFoe));
      rateCache.set(key, rates);
    }
    return rates;
  };
  const foeTables = (enemy: FighterState, mine: FighterState, key: string): (LevelHits[] | null)[] => {
    let tables = tableCache.get(key);
    if (tables === undefined) {
      tables = hitTables(decks, enemy, mine);
      tableCache.set(key, tables);
    }
    return tables;
  };

  return (state) => {
    if (state.winner === me) return WIN;
    if (state.winner === foe) return -WIN;
    const mine = state.sides[me];
    const enemy = state.sides[foe];
    const mineKey = mine.rigs.map((rig) => `${rig.deck}:${isWorking(rig) ? 1 : 0}`).join('|');
    const enemyKey = enemy.rigs.map((rig) => (isWorking(rig) ? 1 : 0)).join('');
    const myRates = ownRates(mine, mineKey);
    const myShare = armsShare(mine);
    const foeShare = armsShare(enemy);
    const foeTop = topSum(enemy.rigs.map((rig, i) => (isWorking(rig) ? (foeRates[i] ?? 0) : 0)), enemy.arms);
    const myTop = topSum(mine.rigs.map((rig, i) => (isWorking(rig) ? (myRates[i] ?? 0) : 0)), mine.arms);

    let score = KILL * (standing - workingCount(enemy));
    enemy.rigs.forEach((rig, i) => {
      score -= rigCost(rig.hp, rig.maxHp, foeRates[i] ?? 0);
      if (isWorking(rig)) {
        score += FUTURE * foeShare * (foeRates[i] ?? 0) * Math.min(HORIZON, Math.max(0, rig.cooldown - 1));
      }
    });
    mine.rigs.forEach((rig, i) => {
      if (isWorking(rig)) score += FUTURE * myShare * (myRates[i] ?? 0) * (HORIZON - Math.min(HORIZON, rig.cooldown));
    });
    score -= INCOMING * incoming(decks, enemy, mine, foeTables(enemy, mine, `${enemyKey}#${mineKey}`), myRates);
    score += FUTURE * foeShare * foeTop * Math.min(HORIZON, enemy.slowTurns);
    score += HASTE_SHARE * FUTURE * myShare * myTop * Math.min(HORIZON, mine.hasteTurns);
    score += trapsValue(decks, mine, enemy, foeRates, foeShare, foeTop);
    return score;
  };
}

/** What a rig still costs its enemy: its HP, plus what breaking it is worth. 0 once broken. */
function rigCost(hp: number, maxHp: number, rate: number): number {
  if (hp <= 0) return 0;
  return hp + KILL_HP * maxHp + KILL_RATE_TURNS * rate + LOW_HP * maxHp * Math.sqrt(hp / maxHp);
}

/** How much `damage` (before the rig's shield) lowers the rig's cost. */
function costDrop(rig: RigState, damage: number, rate: number): number {
  if (damage <= 0 || !isWorking(rig)) return 0;
  const through = Math.max(0, damage - rig.shield);
  if (through === 0) return 0;
  return rigCost(rig.hp, rig.maxHp, rate) - rigCost(Math.max(0, rig.hp - through), rig.maxHp, rate);
}

/** When a fighter has more working rigs than arms, a rig sitting out costs less. */
function armsShare(fighter: FighterState): number {
  return Math.min(1, fighter.arms / Math.max(1, workingCount(fighter)));
}

function topSum(values: number[], count: number): number {
  return [...values]
    .sort((a, b) => b - a)
    .slice(0, count)
    .reduce((sum, value) => sum + value, 0);
}

/** A rig's per-turn value: its best move's damage on `targets` (plus part of its shields), divided
 *  by the turns that move's cycle takes (the turn it acts plus its cooldown). */
function rigRate(decks: Record<string, Deck>, fighter: FighterState, index: number, targets: FighterState): number {
  const rig = fighter.rigs[index];
  if (rig === undefined || !isWorking(rig)) return 0;
  const deck = deckOf(decks, rig);
  const mix = mixAt(decks, fighter, index);
  const aims = enemyTargets(decks, targets);
  const own = workingCount(fighter);
  let best = 0;
  for (const level of LEVELS) {
    const move = moveOf(deck, level);
    const bonus = partnerDamage(decks, fighter, index, move);
    const single = targets.rigs.map(() => 0);
    let spread = 0;
    let shield = 0;
    for (const effect of move.effects) {
      if (effect.kind === 'damage') {
        targets.rigs.forEach((target, j) => {
          if (!isWorking(target)) return;
          const damage = damageAmount(effect.amount + bonus, deck.genre, deckOf(decks, target).genre, mix, 100);
          if (effect.to === 'enemy') single[j] = (single[j] ?? 0) + damage;
          else spread += damage;
        });
      } else if (effect.kind === 'shield') {
        shield += effect.amount * (effect.to === 'allies' ? own : 1);
      }
    }
    const aimed = aims.reduce((most, j) => Math.max(most, single[j] ?? 0), 0);
    const turns = cooldownFor(decks, fighter, index, level, false, false) + 1;
    best = Math.max(best, (aimed + spread + SHIELD_RATE * shield) / turns);
  }
  return best;
}

/** What one level of a rig's moves would hit, before shields: per victim rig, the damage of its
 *  'enemy' effects (if aimed there) and of its 'enemies' effects. */
interface LevelHits {
  aimed: boolean;
  single: number[];
  spread: number[];
}

/** The hits of every rig of `attacker` on `victim`, by rig then level (null for a broken rig). */
function hitTables(decks: Record<string, Deck>, attacker: FighterState, victim: FighterState): (LevelHits[] | null)[] {
  return attacker.rigs.map((rig, index) => {
    if (!isWorking(rig)) return null;
    const deck = deckOf(decks, rig);
    const mix = mixAt(decks, attacker, index);
    return LEVELS.map((level) => {
      const move = moveOf(deck, level);
      const bonus = partnerDamage(decks, attacker, index, move);
      const hits: LevelHits = { aimed: false, single: victim.rigs.map(() => 0), spread: victim.rigs.map(() => 0) };
      for (const effect of move.effects) {
        if (effect.kind !== 'damage') continue;
        if (effect.to === 'enemy') hits.aimed = true;
        const into = effect.to === 'enemy' ? hits.single : hits.spread;
        victim.rigs.forEach((target, j) => {
          if (!isWorking(target)) return;
          into[j] = (into[j] ?? 0) + damageAmount(effect.amount + bonus, deck.genre, deckOf(decks, target).genre, mix, 100);
        });
      }
      return hits;
    });
  });
}

/** The damage `attacker` is likely to deal to `victim` in its next turn: the best hit of each rig
 *  that will be ready, counted on the victim's rig costs, for as many rigs as it has arms. */
function incoming(
  decks: Record<string, Deck>,
  attacker: FighterState,
  victim: FighterState,
  tables: (LevelHits[] | null)[],
  victimRates: number[],
): number {
  const aims = enemyTargets(decks, victim);
  if (aims.length === 0) return 0;
  const hits: number[] = [];
  attacker.rigs.forEach((rig, i) => {
    const levels = tables[i];
    if (levels == null || !isWorking(rig) || rig.cooldown !== 0) return;
    let best = 0;
    for (const level of levels) {
      for (const aim of level.aimed ? aims : [-1]) {
        let value = 0;
        victim.rigs.forEach((target, j) => {
          const damage = (level.spread[j] ?? 0) + (j === aim ? (level.single[j] ?? 0) : 0);
          value += costDrop(target, damage, victimRates[j] ?? 0);
        });
        best = Math.max(best, value);
      }
    }
    hits.push(best);
  });
  return topSum(hits, attacker.arms);
}

/** Own traps: the damage or turns their payload is likely to cost the other side. */
function trapsValue(
  decks: Record<string, Deck>,
  mine: FighterState,
  enemy: FighterState,
  foeRates: number[],
  foeShare: number,
  foeTop: number,
): number {
  const working = workingCount(mine);
  const defenders = mine.rigs.some((rig) => isWorking(rig) && deckOf(decks, rig).defender);
  const foeWorking = enemy.rigs.flatMap((rig, i) => (isWorking(rig) ? [foeRates[i] ?? 0] : []));
  const foeAverage = foeWorking.length === 0 ? 0 : foeWorking.reduce((a, b) => a + b, 0) / foeWorking.length;
  let total = 0;
  mine.rigs.forEach((rig, i) => {
    if (!isWorking(rig) || rig.trap === null) return;
    const chance = defenders
      ? deckOf(decks, rig).defender
        ? TRAP_SURE
        : TRAP_STRAY
      : TRAP_SURE * Math.min(1, enemy.arms / Math.max(1, working));
    let value = 0;
    for (const payload of rig.trap.payload) {
      if (payload.kind === 'damage') value += (FUTURE * payload.amount * mixDamagePct(mixAt(decks, mine, i))) / 100;
      else if (payload.kind === 'stun') value += FUTURE * foeShare * foeAverage * payload.turns;
      else value += FUTURE * foeShare * foeTop * Math.min(HORIZON, payload.turns);
    }
    total += chance * value;
  });
  return total;
}
