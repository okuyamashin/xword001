// 使い方: node generator/cli/make-puzzle.js --theme countries [--locale ja] [--date 2026-10-12] [--stdout]
// puzzles/<通し番号5桁>-<ジャンル>-<ジャンル内連番3桁>.json を作る（例: puzzles/00004-countries-002.json）。
// --date は作った日として記録するだけ（省略時は今日）。

import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildPuzzle, nextNumbers, genreOf } from '../build.js';
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
// 通し番号とジャンル内の連番（puzzles/ にある既存のクロスワードから決める）
const dir = path.join(ROOT, 'puzzles');
await mkdir(dir, { recursive: true });
const existing = await Promise.all(
  (await readdir(dir)).filter((f) => f.endsWith('.json')).map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8'))),
);
const { serial, round } = nextNumbers(existing, { locale: values.locale, genre: genreOf(themeFiles) });
const { puzzle, stats } = buildPuzzle({ serial, round, date: values.date, locale: values.locale, themeFiles, generalFile });

console.error(puzzle.grid.map((row) => row.replaceAll('#', '・')).join('\n'));
console.error(stats);
const json = `${JSON.stringify(puzzle, null, 2)}\n`;
if (values.stdout) {
  process.stdout.write(json);
} else {
  const file = path.join(dir, `${puzzle.id}.json`);
  await writeFile(file, json);
  console.error(`→ ${path.relative(ROOT, file)}`);
}
