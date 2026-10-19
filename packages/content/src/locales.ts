// Player-facing text, by locale. French is the first language.
// Key = the entity's id with '/' turned into '.' ('vinyl/boom-bap' -> 'vinyl.boom-bap'); genres use 'genre.<id>'.
import en from './locales/en.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };

export type Locale = 'fr' | 'en';

export const LOCALES: Readonly<Record<Locale, Readonly<Record<string, string>>>> = { fr, en };

/** The text key of an entity id: 'vinyl/boom-bap' -> 'vinyl.boom-bap'. */
export function textKey(id: string): string {
  return id.replace('/', '.');
}
