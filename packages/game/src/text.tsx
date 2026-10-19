// The translator, handed to every React component that shows text.
import { createContext, useContext } from 'react';
import type { Translate } from './i18n.ts';

export const TextContext = createContext<Translate | null>(null);

export function useText(): Translate {
  const t = useContext(TextContext);
  if (!t) throw new Error('useText() outside <TextContext>');
  return t;
}
