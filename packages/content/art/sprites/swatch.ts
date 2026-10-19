// The palette as a sheet: one row per ramp (palette order), one 8x8 square per colour, dark to light.
import { canvas, rect, RAMPS, type SpriteDef } from '../canvas.ts';

const CELL = 8;
const ramps = Object.values(RAMPS);
const columns = Math.max(...ramps.map((r) => r.length));

const sheet = canvas(columns * CELL, ramps.length * CELL);
ramps.forEach((ramp, row) => {
  ramp.forEach((color, col) => rect(sheet, col * CELL, row * CELL, CELL, CELL, color));
});

const swatch: SpriteDef = {
  name: 'swatch',
  frameWidth: sheet.width,
  frameHeight: sheet.height,
  frames: [sheet],
  tags: [],
  source: 'drawn by code from src/palette.ts: one 8x8 square per colour, one row per ramp',
};

export default swatch;
