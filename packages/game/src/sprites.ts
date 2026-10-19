// The sprite sheets (Aseprite PNG + JSON from content), shared by the Phaser scene and the DOM
// icons. Tag names come from the JSON at build time; code asks for a tag and copes when an art tag
// is not drawn yet (vinyl-label-<slug> / vinyl-icon-<slug> for some vinyls).
import ampJson from '@scratchboy/content/assets/sprites/amp.json';
import ampPng from '@scratchboy/content/assets/sprites/amp.png?url';
import backdropPng from '@scratchboy/content/assets/sprites/backdrop-hiphop.png?url';
import djTableJson from '@scratchboy/content/assets/sprites/dj-table.json';
import djTablePng from '@scratchboy/content/assets/sprites/dj-table.png?url';
import fxJson from '@scratchboy/content/assets/sprites/fx.json';
import fxPng from '@scratchboy/content/assets/sprites/fx.png?url';
import riffJson from '@scratchboy/content/assets/sprites/riff.json';
import riffPng from '@scratchboy/content/assets/sprites/riff.png?url';
import scratchBoyJson from '@scratchboy/content/assets/sprites/scratch-boy.json';
import scratchBoyPng from '@scratchboy/content/assets/sprites/scratch-boy.png?url';
import turntableJson from '@scratchboy/content/assets/sprites/turntable.json';
import turntablePng from '@scratchboy/content/assets/sprites/turntable.png?url';
import vinylIconJson from '@scratchboy/content/assets/sprites/vinyl-icon.json';
import vinylIconPng from '@scratchboy/content/assets/sprites/vinyl-icon.png?url';
import vinylLabelJson from '@scratchboy/content/assets/sprites/vinyl-label.json';
import vinylLabelPng from '@scratchboy/content/assets/sprites/vinyl-label.png?url';
import vinylJson from '@scratchboy/content/assets/sprites/vinyl.json';
import vinylPng from '@scratchboy/content/assets/sprites/vinyl.png?url';

/** The parts of Aseprite's "array" JSON the game reads. */
export interface AsepriteSheet {
  frames: { filename: string; frame: { x: number; y: number; w: number; h: number } }[];
  meta: { size: { w: number; h: number }; frameTags: { name: string; from: number; to: number }[] };
}

export interface Sheet {
  png: string;
  json: AsepriteSheet;
}

export const SHEETS = {
  amp: { png: ampPng, json: ampJson },
  'dj-table': { png: djTablePng, json: djTableJson },
  fx: { png: fxPng, json: fxJson },
  riff: { png: riffPng, json: riffJson },
  'scratch-boy': { png: scratchBoyPng, json: scratchBoyJson },
  turntable: { png: turntablePng, json: turntableJson },
  vinyl: { png: vinylPng, json: vinylJson },
  'vinyl-icon': { png: vinylIconPng, json: vinylIconJson },
  'vinyl-label': { png: vinylLabelPng, json: vinylLabelJson },
} satisfies Record<string, Sheet>;

export type SheetName = keyof typeof SHEETS;

/** The backdrop is one static frame: loaded as a plain image. */
export const BACKDROP = { key: 'backdrop-hiphop', png: backdropPng, width: 480, height: 208 } as const;

/** The first frame of a tag, or null when the art for that tag is not drawn yet. */
export function tagFrame(sheet: SheetName, tag: string): AsepriteSheet['frames'][number] | null {
  const json: AsepriteSheet = SHEETS[sheet].json;
  const found = json.meta.frameTags.find((t) => t.name === tag);
  return found ? (json.frames[found.from] ?? null) : null;
}

/** 'vinyl/boom-bap' -> 'boom-bap': the art names its tags after the id's slug. */
export function slugOf(id: string): string {
  return id.slice(id.indexOf('/') + 1);
}
