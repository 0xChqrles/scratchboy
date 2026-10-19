// All player-facing text comes from content's locale files, never from code.
import { LOCALES, type Locale } from '@scratchboy/content';

/** The requested locale, else the device's first French or English language, else French. */
export function pickLocale(requested: string | null): Locale {
  if (requested === 'fr' || requested === 'en') return requested;
  for (const language of navigator.languages) {
    if (language.startsWith('fr')) return 'fr';
    if (language.startsWith('en')) return 'en';
  }
  return 'fr';
}

export type Translate = (key: string) => string;

export function translator(locale: Locale): Translate {
  const table = LOCALES[locale];
  return (key) => {
    const text = table[key];
    if (text !== undefined) return text;
    if (import.meta.env.DEV) throw new Error(`No '${key}' text in ${locale}`);
    return '';
  };
}

/** Fills a text's {name} slots: fill('Au tour de {name}', { name: 'Riff' }). */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (slot, name: string) => String(values[name] ?? slot));
}
