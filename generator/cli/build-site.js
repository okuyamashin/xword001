// puzzles/*.json から site/ に HTML を作る。いちばん新しい日付のものを index.html にもする。
// 使い方: node generator/cli/build-site.js [--locale ja]

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { renderPuzzleHtml } from '../site.js';
import { ROOT } from '../lib/words.js';

const { values } = parseArgs({ options: { locale: { type: 'string', default: 'ja' } } });
const template = await readFile(path.join(ROOT, 'template/puzzle.html'), 'utf8');
const localeSource = await readFile(path.join(ROOT, 'generator/locales', `${values.locale}.js`), 'utf8');
const outDir = path.join(ROOT, 'site');
await mkdir(outDir, { recursive: true });

const files = (await readdir(path.join(ROOT, 'puzzles')))
  .filter((f) => f.endsWith(`-${values.locale}.json`))
  .sort();
let latest = null;
for (const file of files) {
  const puzzle = JSON.parse(await readFile(path.join(ROOT, 'puzzles', file), 'utf8'));
  const missing = puzzle.words.filter((w) => !w.clue).length;
  if (missing) console.error(`${file}: カギのない単語が ${missing} 語あります`);
  const html = renderPuzzleHtml({ template, puzzle, localeSource });
  await writeFile(path.join(outDir, `${puzzle.date}.html`), html);
  console.error(`→ site/${puzzle.date}.html`);
  latest = html;
}
if (latest) {
  await writeFile(path.join(outDir, 'index.html'), latest);
  console.error('→ site/index.html');
}
