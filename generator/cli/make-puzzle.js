// 使い方: node generator/cli/make-puzzle.js --date 2026-10-12 --theme countries [--locale ja] [--stdout]

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildPuzzle } from '../build.js';
import { loadThemeFile, ROOT } from '../lib/words.js';

const { values } = parseArgs({
  options: {
    date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
    theme: { type: 'string', default: 'countries' },
    locale: { type: 'string', default: 'ja' },
    stdout: { type: 'boolean', default: false },
  },
});

const themeFiles = await Promise.all(values.theme.split('+').map((t) => loadThemeFile(values.locale, t)));
const generalFile = await loadThemeFile(values.locale, 'general');
const { puzzle, stats } = buildPuzzle({ date: values.date, locale: values.locale, themeFiles, generalFile });

console.error(puzzle.grid.map((row) => row.replaceAll('#', '・')).join('\n'));
console.error(stats);
const json = `${JSON.stringify(puzzle, null, 2)}\n`;
if (values.stdout) {
  process.stdout.write(json);
} else {
  const dir = path.join(ROOT, 'puzzles');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${puzzle.id}.json`);
  await writeFile(file, json);
  console.error(`→ ${path.relative(ROOT, file)}`);
}
