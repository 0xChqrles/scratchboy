// Scratch Boy's one palette: every sprite pixel and every UI colour comes from here.
// Ramps go dark (-0) to light; each ramp's -0 is that material's outline colour.
// Keep it plain data: the art build and the game UI both import it.
export const PALETTE = {
  // ink: night neutrals, blue-violet black to cool white. Outlines, vinyl, black plastic/denim/leather, chrome, asphalt, amp grille, glints. UI: panel 1, border 4, dim text 5, text 7.
  'ink-0': '#090713',
  'ink-1': '#191727',
  'ink-2': '#2a2b3c',
  'ink-3': '#3d4052',
  'ink-4': '#555a6b',
  'ink-5': '#7e8795',
  'ink-6': '#a6afb9',
  'ink-7': '#e7eef3',
  // dusk: muted violet to mauve. Sky, far buildings, backdrop shade, purple cloth.
  'dusk-0': '#2c1e41',
  'dusk-1': '#4f325a',
  'dusk-2': '#7a4c6f',
  'dusk-3': '#a16a7f',
  // brick: night maroon to lit brick. Brick walls, mahogany, red-brown leather.
  'brick-0': '#270f1b',
  'brick-1': '#421d2b',
  'brick-2': '#602d3c',
  'brick-3': '#814349',
  // skin: deep brown to pale peach, also brown hair. Each skin tone is a 4-colour window of it (style guide); skin-5 is the warm white.
  'skin-0': '#361713',
  'skin-1': '#5e3224',
  'skin-2': '#8c523c',
  'skin-3': '#b97e59',
  'skin-4': '#deb08c',
  'skin-5': '#f6dec6',
  // amber: dark wood to orange to gold. Wood, gold chains, brass, streetlight halo. UI: cooldown 3.
  'amber-0': '#4c240a',
  'amber-1': '#894c0a',
  'amber-2': '#cb7b1b',
  'amber-3': '#f0bb43',
  // red: dark crimson to coral. Hero red, metal accents, sparks. UI: danger 2 (fills), 3 (text).
  'red-0': '#480c1e',
  'red-1': '#8e132b',
  'red-2': '#d23337',
  'red-3': '#f6825f',
  // green: dark teal to lime. Graffiti, plants, neon. UI: HP 2 (shade 1).
  'green-0': '#06372a',
  'green-1': '#218041',
  'green-2': '#86c744',
  // blue: navy to ice. Denim, neon signs, cold light. UI: shield 2, stun 3.
  'blue-0': '#17224f',
  'blue-1': '#1b509b',
  'blue-2': '#20b0d0',
  'blue-3': '#a6ecf4',
  // pink: plum to hot pink. Graffiti neon, stage light. UI: the 'you can tap this' accent 2.
  'pink-0': '#48133a',
  'pink-1': '#b93584',
  'pink-2': '#fb89be',
} as const;

export type PaletteColor = keyof typeof PALETTE;
