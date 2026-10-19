// What the fighters say before a fight starts.

/** One line of dialogue: who says it (a fighter id) and what (a locale key). */
export interface Line {
  speaker: string;
  text: string;
}

const RIFF = 'opponent/riff';
const BOY = 'fighter/scratch-boy';

/** Speakers in order; line n's text is `<prefix>-<n>`, counting from 1. */
function lines(prefix: string, speakers: readonly string[]): Line[] {
  return speakers.map((speaker, i) => ({ speaker, text: `${prefix}-${i + 1}` }));
}

/** Fight fixture slug (a key of `FIGHTS`) -> the lines said, in order, before that fight starts. */
export const FIGHT_INTROS: Readonly<Record<string, readonly Line[]>> = {
  // Long on purpose, as a joke (the owner's call): see AGENTS.md, Game text.
  riff: lines('talk.riff', [
    RIFF, BOY, RIFF, BOY, RIFF, BOY, RIFF, BOY, RIFF, BOY,
    RIFF, RIFF, BOY, RIFF, BOY, RIFF, BOY, RIFF, BOY, RIFF,
  ]),
};
