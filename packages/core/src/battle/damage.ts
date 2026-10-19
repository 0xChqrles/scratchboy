// The damage rule, and what one hit does to a rig: shield first, then HP, then breaking and winning.
import { genrePct, type Genre, type Mix } from '../genres.ts';
import { nextInt } from '../rng.ts';
import {
  DAMAGE_SPREAD_PCT,
  GENRE_STRONG_PCT,
  GENRE_WEAK_PCT,
  MIN_DAMAGE,
  MIX_CLASH_DAMAGE_PCT,
  MIX_GOOD_DAMAGE_PCT,
} from './constants.ts';
import { emit, type Draft } from './draft.ts';
import { deckOf, isWorking, mixAt, otherSide, rigOf, type RigRef } from './facts.ts';
import type { Effectiveness } from './types.ts';

export function mixDamagePct(mix: Mix): number {
  if (mix === 'good') return MIX_GOOD_DAMAGE_PCT;
  if (mix === 'clash') return MIX_CLASH_DAMAGE_PCT;
  return 100;
}

/** base × genre multiplier × mix multiplier × spread, rounded down once, at least MIN_DAMAGE. */
export function damageAmount(base: number, attacker: Genre, target: Genre, mix: Mix, spreadPct: number): number {
  const amount = Math.floor((base * genrePct(attacker, target) * mixDamagePct(mix) * spreadPct) / 1_000_000);
  return Math.max(MIN_DAMAGE, amount);
}

export function effectivenessOf(attacker: Genre, target: Genre): Effectiveness {
  const pct = genrePct(attacker, target);
  if (pct === GENRE_STRONG_PCT) return 'strong';
  if (pct === GENRE_WEAK_PCT) return 'weak';
  return 'normal';
}

/** One hit of `base` damage from rig `from` on rig `to`. A broken target takes nothing. Draws one
 *  spread from the generator (unless the draft fixes it). */
export function hitRig(draft: Draft, from: RigRef, to: RigRef, base: number): void {
  const state = draft.state;
  const target = rigOf(state, to.side, to.rig);
  if (!isWorking(target)) return;
  const attacker = rigOf(state, from.side, from.rig);
  const attackerGenre = deckOf(state.decks, attacker).genre;
  const targetGenre = deckOf(state.decks, target).genre;

  let spread = draft.fixedSpread;
  if (spread === null) {
    const draw = nextInt(state.rng, 100 - DAMAGE_SPREAD_PCT, 100 + DAMAGE_SPREAD_PCT);
    spread = draw.value;
    state.rng = draw.rng;
  }
  const mix = mixAt(state.decks, state.sides[from.side], from.rig);
  const amount = damageAmount(base, attackerGenre, targetGenre, mix, spread);

  const soaked = Math.min(target.shield, amount);
  if (soaked > 0) {
    target.shield -= soaked;
    emit(draft, { type: 'blocked', side: to.side, rig: to.rig, amount: soaked, shield: target.shield });
  }
  const rest = amount - soaked;
  if (rest > 0) {
    target.hp = Math.max(0, target.hp - rest);
    const effectiveness = effectivenessOf(attackerGenre, targetGenre);
    emit(draft, { type: 'hit', side: to.side, rig: to.rig, amount: rest, hp: target.hp, effectiveness });
  }
  if (target.hp === 0) breakRig(draft, to);
}

/** A rig at 0 HP is broken: it loses its cooldown and shield. Its trap stays: nothing can target a
 *  broken rig, so it never goes off, and removing it would drop the other side's count of hidden
 *  traps and show where it was (the opponent sees that a trap was set, not where). A fighter with
 *  no working rig loses at once. */
function breakRig(draft: Draft, ref: RigRef): void {
  const state = draft.state;
  const rig = rigOf(state, ref.side, ref.rig);
  rig.cooldown = 0;
  rig.shield = 0;
  emit(draft, { type: 'rig-broken', side: ref.side, rig: ref.rig });
  if (!state.sides[ref.side].rigs.some(isWorking)) {
    const winner = otherSide(ref.side);
    state.winner = winner;
    emit(draft, { type: 'battle-won', side: winner });
  }
}
