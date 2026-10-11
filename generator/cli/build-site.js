// puzzles/*.json から site/ に HTML を作る。いちばん新しい日付のものを index.html にもする。
// 使い方: node generator/cli/build-site.js [--locale ja]

import { readFile, readdir, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { renderPuzzleHtml, DEFAULT_IMAGE } from '../site.js';
import { ROOT } from '../lib/words.js';

const { values } = parseArgs({ options: { locale: { type: 'string', default: 'ja' } } });
const template = await readFile(path.join(ROOT, 'template/puzzle.html'), 'utf8');
const localeSource = await readFile(path.join(ROOT, 'generator/locales', `${values.locale}.js`), 'utf8');
const site = JSON.parse(await readFile(path.join(ROOT, 'data/site', `${values.locale}.json`), 'utf8'));
const outDir = path.join(ROOT, 'site');
await mkdir(outDir, { recursive: true });
await cp(path.join(ROOT, 'data/images'), path.join(outDir, 'images'), { recursive: true });
const imageFiles = (await readdir(path.join(ROOT, 'data/images'))).filter((f) => /\.(webp|png|jpe?g|svg)$/i.test(f));

const files = (await readdir(path.join(ROOT, 'puzzles')))
  .filter((f) => f.endsWith(`-${values.locale}.json`))
  .sort();
let latest = null;
for (const file of files) {
  const puzzle = JSON.parse(await readFile(path.join(ROOT, 'puzzles', file), 'utf8'));
  const missing = puzzle.words.filter((w) => !w.clue).length;
  if (missing) console.error(`${file}: カギのない単語が ${missing} 語あります`);
  // パズル専用の絵（data/images/<id>.png など）→ テーマの絵 → 方眼紙
  const own = imageFiles.find((f) => f.replace(/\.[^.]+$/, '') === puzzle.id);
  const image = own ?? (puzzle.image && imageFiles.includes(puzzle.image) ? puzzle.image : DEFAULT_IMAGE);
  const html = renderPuzzleHtml({ template, puzzle, localeSource, site, image });
  await writeFile(path.join(outDir, `${puzzle.date}.html`), html);
  console.error(`→ site/${puzzle.date}.html`);
  latest = html;
}
if (latest) {
  await writeFile(path.join(outDir, 'index.html'), latest);
  console.error('→ site/index.html');
}
