// Root contract 12: every asset has its source and license written beside it, in <name>.source.json.
// A license text ships as <name>.license.txt and is covered by the same record.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const ASSETS = fileURLToPath(new URL('../assets/', import.meta.url));
const RECORD = '.source.json';

/** Every file under `dir`, recursively. Dotfiles (.DS_Store, .gitkeep) are not assets. */
function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .flatMap((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)]));
}

it('every asset has a <name>.source.json with a source and a license', () => {
  const records = new Set(
    listFiles(ASSETS)
      .filter((file) => !file.endsWith(RECORD))
      .map((file) => file.replace(/\.license\.txt$|\.[^./]+$/, '') + RECORD),
  );
  const problems: string[] = [];
  for (const record of records) {
    const name = relative(ASSETS, record);
    if (!existsSync(record)) {
      problems.push(`${name}: missing`);
      continue;
    }
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(record, 'utf8'));
    } catch {
      problems.push(`${name}: not valid JSON`);
      continue;
    }
    for (const field of ['source', 'license']) {
      const value = typeof data === 'object' && data !== null ? (data as Record<string, unknown>)[field] : undefined;
      if (typeof value !== 'string' || value.trim() === '') problems.push(`${name}: no '${field}'`);
    }
  }
  expect(problems).toEqual([]);
});
