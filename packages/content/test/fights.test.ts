// Every fight fixture must start a real battle in core's engine, and every intro must belong to a
// fight whose fighters say its lines.
import { createBattle } from '@scratchboy/core';
import { expect, it } from 'vitest';
import { FIGHT_INTROS, FIGHTS } from '../src/index.ts';

for (const [slug, fight] of Object.entries(FIGHTS)) {
  it(`fight fixture '${slug}' passes createBattle`, () => {
    for (const seed of [1, 2, 3]) expect(() => createBattle(fight(seed))).not.toThrow();
  });
}

for (const [slug, lines] of Object.entries(FIGHT_INTROS)) {
  it(`intro '${slug}' belongs to a fight fixture and is said by its fighters`, () => {
    const fight = FIGHTS[slug];
    expect(fight, slug).toBeDefined();
    const fighters = fight ? fight(1).sides.map((side) => side.id) : [];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(fighters, line.text).toContain(line.speaker);
  });
}
