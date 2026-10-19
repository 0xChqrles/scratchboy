// Sprite build: node --experimental-strip-types art/build.ts [name ...] [--preview <dir>]
// Imports each art/sprites/<name>.ts (default export: SpriteDef), checks every pixel against the
// palette, packs the frames left to right, and writes to assets/sprites/:
//   <name>.png          the sheet
//   <name>.json         Aseprite "array" JSON, for Phaser's load.aseprite + anims.createFromAseprite
//   <name>.source.json  where the asset comes from and its license
// --preview <dir> also writes <dir>/<name>@4x.png on a grey checker so transparency shows.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PALETTE } from '../src/palette.ts';
import type { Canvas, SpriteDef } from './canvas.ts';
import { encodePng, upscale } from './png.ts';

const ROOT = resolve(import.meta.dirname, '..');
const SPRITES_DIR = join(ROOT, 'art', 'sprites');
const OUT_DIR = join(ROOT, 'assets', 'sprites');
const DEFAULT_DURATION = 150;
const PREVIEW_SCALE = 4;

type Rgb = readonly [number, number, number];

function parseHex(hex: string): Rgb {
  if (!/^#[0-9a-f]{6}$/.test(hex)) throw new Error(`palette: '${hex}' is not a lowercase #rrggbb colour`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Palette name -> RGB, after checking names and that no two names share a colour. */
function loadPalette(): Map<string, Rgb> {
  const byName = new Map<string, Rgb>();
  const seen = new Map<string, string>();
  for (const [name, hex] of Object.entries(PALETTE)) {
    if (!/^[a-z]+(?:-[a-z]+)*-\d+$/.test(name)) throw new Error(`palette: bad name '${name}' (want ramp-N)`);
    const other = seen.get(hex);
    if (other) throw new Error(`palette: '${name}' and '${other}' are both ${hex}`);
    seen.set(hex, name);
    byName.set(name, parseHex(hex));
  }
  return byName;
}

function fail(sprite: string, msg: string): never {
  throw new Error(`sprite '${sprite}': ${msg}`);
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

/** Checks the SpriteDef's shape; pixels are checked while rendering. */
function checkDef(def: unknown, file: string): SpriteDef {
  const expected = basename(file, '.ts');
  if (typeof def !== 'object' || def === null) fail(expected, 'the module has no default export object');
  const d = def as SpriteDef;
  if (d.name !== expected) fail(expected, `name is '${String(d.name)}', expected '${expected}' (the file name)`);
  if (!isPositiveInt(d.frameWidth) || !isPositiveInt(d.frameHeight)) fail(d.name, 'frameWidth/frameHeight must be positive integers');
  if (!Array.isArray(d.frames) || d.frames.length === 0) fail(d.name, 'needs at least one frame');
  d.frames.forEach((f: Canvas, i) => {
    if (f.width !== d.frameWidth || f.height !== d.frameHeight) {
      fail(d.name, `frame ${i} is ${f.width}x${f.height}, expected ${d.frameWidth}x${d.frameHeight}`);
    }
    if (!Array.isArray(f.pixels) || f.pixels.length !== f.width * f.height) fail(d.name, `frame ${i} has ${f.pixels?.length} pixels, expected ${f.width * f.height}`);
  });
  if (d.durations !== undefined) {
    if (!Array.isArray(d.durations) || d.durations.length !== d.frames.length || !d.durations.every(isPositiveInt)) {
      fail(d.name, `durations must be ${d.frames.length} positive integers (ms), one per frame`);
    }
  }
  if (!Array.isArray(d.tags)) fail(d.name, 'tags must be an array (it may be empty)');
  const names = new Set<string>();
  for (const t of d.tags) {
    if (typeof t.name !== 'string' || t.name === '') fail(d.name, 'a tag has no name');
    if (names.has(t.name)) fail(d.name, `tag '${t.name}' appears twice`);
    names.add(t.name);
    if (!Number.isInteger(t.from) || !Number.isInteger(t.to) || t.from < 0 || t.to < t.from || t.to >= d.frames.length) {
      fail(d.name, `tag '${t.name}' has from=${t.from} to=${t.to}; frames are 0..${d.frames.length - 1}`);
    }
  }
  if (typeof d.source !== 'string' || d.source.trim() === '' || /[\r\n]/.test(d.source)) fail(d.name, 'source must be one non-empty line');
  return d;
}

/** Packs frames left to right into RGBA, throwing on any pixel that is not a palette colour. */
function renderSheet(def: SpriteDef, palette: Map<string, Rgb>): { width: number; height: number; rgba: Uint8Array } {
  const width = def.frameWidth * def.frames.length;
  const height = def.frameHeight;
  const rgba = new Uint8Array(width * height * 4);
  def.frames.forEach((frame, f) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < def.frameWidth; x++) {
        const px: unknown = frame.pixels[y * def.frameWidth + x];
        if (px === null) continue; // alpha 0
        const rgb = typeof px === 'string' ? palette.get(px) : undefined;
        if (!rgb) fail(def.name, `frame ${f}, x ${x}, y ${y}: ${JSON.stringify(px)} is not a palette colour (or null for transparent)`);
        const o = (y * width + f * def.frameWidth + x) * 4;
        rgba[o] = rgb[0];
        rgba[o + 1] = rgb[1];
        rgba[o + 2] = rgb[2];
        rgba[o + 3] = 255;
      }
    }
  });
  return { width, height, rgba };
}

/** Aseprite "array" export, the shape Phaser 4's aseprite loader and createFromAseprite read. */
function asepriteJson(def: SpriteDef, sheetW: number, sheetH: number): object {
  const w = def.frameWidth;
  const h = def.frameHeight;
  return {
    frames: def.frames.map((_, i) => ({
      // createFromAseprite looks frames up by their index as a string, so the name is the index.
      filename: String(i),
      frame: { x: i * w, y: 0, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
      duration: def.durations?.[i] ?? DEFAULT_DURATION,
    })),
    meta: {
      app: 'scratchboy art/build.ts',
      version: '1',
      image: `${def.name}.png`,
      format: 'RGBA8888',
      size: { w: sheetW, h: sheetH },
      scale: '1',
      frameTags: def.tags.map((t) => ({ name: t.name, from: t.from, to: t.to, direction: 'forward' })),
      layers: [],
      slices: [],
    },
  };
}

/** Tag names already used by other built sprites (Phaser animation keys are global). */
function tagOwners(): Map<string, string> {
  const owners = new Map<string, string>();
  if (!existsSync(OUT_DIR)) return owners;
  for (const file of readdirSync(OUT_DIR)) {
    if (!file.endsWith('.json') || file.endsWith('.source.json')) continue;
    const json = JSON.parse(readFileSync(join(OUT_DIR, file), 'utf8')) as { meta?: { frameTags?: { name: string }[] } };
    for (const t of json.meta?.frameTags ?? []) owners.set(t.name, basename(file, '.json'));
  }
  return owners;
}

function writePreview(dir: string, name: string, def: SpriteDef, sheet: { width: number; height: number; rgba: Uint8Array }): string {
  const big = upscale(sheet.width, sheet.height, sheet.rgba, PREVIEW_SCALE);
  const cell = PREVIEW_SCALE * 2;
  for (let y = 0; y < big.height; y++) {
    for (let x = 0; x < big.width; x++) {
      const o = (y * big.width + x) * 4;
      if (big.rgba[o + 3] === 255) continue;
      // Grey checker; odd frames a shade darker so frame edges show.
      const odd = Math.floor(x / (def.frameWidth * PREVIEW_SCALE)) % 2 === 1;
      const light = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const v = (light ? 0x8c : 0x7a) - (odd ? 0x14 : 0);
      big.rgba[o] = v;
      big.rgba[o + 1] = v;
      big.rgba[o + 2] = v;
      big.rgba[o + 3] = 255;
    }
  }
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${name}@${PREVIEW_SCALE}x.png`);
  writeFileSync(out, encodePng(big.width, big.height, big.rgba));
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let previewDir: string | null = null;
  const names: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? '';
    if (a === '--preview') {
      const dir = args[++i];
      if (!dir) throw new Error('--preview needs a directory');
      previewDir = resolve(dir);
    } else if (a.startsWith('--')) {
      throw new Error(`unknown option ${a}`);
    } else {
      names.push(a);
    }
  }

  const all = readdirSync(SPRITES_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map((f) => basename(f, '.ts'))
    .sort();
  for (const n of names) if (!all.includes(n)) throw new Error(`no sprite module art/sprites/${n}.ts`);
  const todo = names.length > 0 ? names : all;

  const palette = loadPalette();
  const owners = tagOwners();
  mkdirSync(OUT_DIR, { recursive: true });

  for (const name of todo) {
    const file = join(SPRITES_DIR, `${name}.ts`);
    const mod = (await import(pathToFileURL(file).href)) as { default?: unknown };
    const def = checkDef(mod.default, file);
    for (const t of def.tags) {
      const owner = owners.get(t.name);
      if (owner !== undefined && owner !== name) {
        fail(name, `tag '${t.name}' is already used by sprite '${owner}'; Phaser animation keys are global, so name tags '${name}-<anim>'`);
      }
      owners.set(t.name, name);
    }
    const sheet = renderSheet(def, palette);
    writeFileSync(join(OUT_DIR, `${name}.png`), encodePng(sheet.width, sheet.height, sheet.rgba));
    writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(asepriteJson(def, sheet.width, sheet.height), null, 2) + '\n');
    const source = {
      file: `${name}.png`,
      source: `art/sprites/${name}.ts — ${def.source}`,
      license: 'Original art made for Scratch Boy, owned by the project',
      author: 'Scratch Boy project',
    };
    writeFileSync(join(OUT_DIR, `${name}.source.json`), JSON.stringify(source, null, 2) + '\n');
    let line = `${name}: ${def.frames.length} frame(s) ${def.frameWidth}x${def.frameHeight} -> assets/sprites/${name}.png`;
    if (previewDir !== null) line += `, preview ${writePreview(previewDir, name, def, sheet)}`;
    console.log(line);
  }
}

await main();
