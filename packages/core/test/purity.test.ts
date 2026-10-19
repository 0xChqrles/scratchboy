// Root contract 2: core is deterministic. No clock, no global randomness, no I/O, no Node APIs.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: 'Math.random', pattern: /Math\.random/ },
  { name: 'Date.now', pattern: /Date\.now/ },
  { name: 'new Date(', pattern: /new\s+Date\s*\(/ },
  { name: 'performance.now', pattern: /performance\.now/ },
  { name: 'setTimeout', pattern: /setTimeout/ },
  { name: 'setInterval', pattern: /setInterval/ },
  { name: 'fetch(', pattern: /\bfetch\s*\(/ },
  { name: "'node:' import", pattern: /['"`]node:/ },
  { name: 'process.', pattern: /\bprocess\./ },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('core source is pure', () => {
  const files = sourceFiles(SRC);

  it('has source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN)('never uses $name', ({ pattern }) => {
    const offenders = files.filter((file) => pattern.test(readFileSync(file, 'utf8')));
    expect(offenders.map((file) => relative(SRC, file))).toEqual([]);
  });
});
