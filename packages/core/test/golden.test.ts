// Golden replays (root AGENTS.md, Testing). Each file in test/golden/ holds a fight's setup
// ({ seed, decks, sides }, built from core's test decks), the action each side played, and the exact
// events and final state those must produce. `server` is to replay the same files, so the two
// can't drift apart. Every event in these files was checked by hand against the combat rules.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Action, BattleEvent, BattleSetup, BattleState, SideIndex } from '../src/index.ts';
import { createBattle, step } from '../src/index.ts';

interface GoldenReplay extends BattleSetup {
  name: string;
  /** What createBattle emits. */
  startEvents: BattleEvent[];
  /** In order: who acted, what they did, and what step must emit. */
  actions: { side: SideIndex; action: Action; events: BattleEvent[] }[];
  /** The state after the last action, without `decks`: those never change, so they are checked
   *  against the setup's. */
  finalState: Omit<BattleState, 'decks'>;
}

const dir = new URL('./golden/', import.meta.url);
const replays = readdirSync(dir)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => ({ file, replay: JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as GoldenReplay }));

describe('golden replays', () => {
  it('finds the replay files', () => {
    expect(replays.map((r) => r.file)).toEqual(['ordinary-fight.json', 'traps-defenders-swaps.json']);
  });

  it.each(replays)('$file gives the exact event log and final state', ({ replay }) => {
    const { seed, decks, sides } = replay;
    const started = createBattle({ seed, decks, sides });
    expect(started.events).toStrictEqual(replay.startEvents);

    const log: BattleEvent[] = [...started.events];
    let state = started.state;
    replay.actions.forEach(({ side, action, events }, i) => {
      const result = step(state, side, action);
      expect(result.events, `events of action ${i + 1}`).toStrictEqual(events);
      log.push(...result.events);
      state = result.state;
    });

    const { decks: finalDecks, ...finalState } = state;
    expect(finalDecks).toStrictEqual(decks);
    expect(finalState).toStrictEqual(replay.finalState);

    // Byte-identical, key order included (root contract 2).
    const expectedLog = [...replay.startEvents, ...replay.actions.flatMap((a) => a.events)];
    expect(JSON.stringify(log)).toBe(JSON.stringify(expectedLog));
    expect(JSON.stringify(finalState)).toBe(JSON.stringify(replay.finalState));
  });
});
