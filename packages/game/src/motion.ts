// The player's reduced-motion setting, read live: the scene and the battle flow both ask it.
const query = window.matchMedia('(prefers-reduced-motion: reduce)');

export function reducedMotion(): boolean {
  return query.matches;
}
