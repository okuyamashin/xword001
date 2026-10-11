// puzzles/*.json から site/ に HTML を作る。
//   site/<日付>.html    パズルのページ
//   site/index.html     いちばん新しいパズル
//   site/archive.html   バックナンバー（一覧）
// 使い方: node generator/cli/build-site.js [--locale ja] [--puzzles <dir>] [--out <dir>]

import { readFile, readdir, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { renderPuzzleHtml, renderArchiveHtml, pageName, DEFAULT_IMAGE } from '../site.js';
import { ROOT } from '../lib/words.js';

const { values } = parseArgs({
  options: {
    locale: { type: 'string', default: 'ja' },
    puzzles: { type: 'string', default: path.join(ROOT, 'puzzles') },
    out: { type: 'string', default: path.join(ROOT, 'site') },
  },
});
const read = (file) => readFile(path.join(ROOT, file), 'utf8');
const template = await read('template/puzzle.html');
const archiveTemplate = await read('template/archive.html');
const parts = { baseCss: await read('template/base.css'), header: await read('template/header.html'), footer: await read('template/footer.html') };
const localeSource = await read(`generator/locales/${values.locale}.js`);
const site = JSON.parse(await read(`data/site/${values.locale}.json`));
const outDir = values.out;
await mkdir(outDir, { recursive: true });
await cp(path.join(ROOT, 'data/images'), path.join(outDir, 'images'), { recursive: true, filter: (src) => !/\.(png|jpe?g)$/i.test(src) });
const allImages = await readdir(path.join(ROOT, 'data/images'));
// 表紙に使える絵（一覧用の小さい絵 *.thumb.webp は除く）。PNG・JPEG は npm run images で WebP にしてから使う
const imageFiles = allImages.filter((f) => /\.(webp|svg)$/i.test(f) && !f.includes('.thumb.'));
const unconverted = allImages.filter((f) => /\.(png|jpe?g)$/i.test(f));
if (unconverted.length) console.error(`WebP に変換していない絵があります（npm run images）: ${unconverted.join(', ')}`);
// 一覧ページ用の小さい絵があればそれを使う
const thumbFor = (image) => {
  const thumb = image.replace(/\.webp$/, '.thumb.webp');
  return thumb !== image && allImages.includes(thumb) ? thumb : image;
};

const puzzles = [];
for (const file of (await readdir(values.puzzles)).filter((f) => f.endsWith(`-${values.locale}.json`))) {
  puzzles.push(JSON.parse(await readFile(path.join(values.puzzles, file), 'utf8')));
}
puzzles.sort((a, b) => a.date.localeCompare(b.date));

// パズル専用の絵（data/images/<id>.png など）→ テーマの絵 → 方眼紙
const imageFor = (puzzle) =>
  imageFiles.find((f) => f.replace(/\.[^.]+$/, '') === puzzle.id) ??
  (puzzle.image && imageFiles.includes(puzzle.image) ? puzzle.image : DEFAULT_IMAGE);

const latest = puzzles.at(-1);
for (const puzzle of puzzles) {
  const missing = puzzle.words.filter((w) => !w.clue).length;
  if (missing) console.error(`${puzzle.id}: カギのない単語が ${missing} 語あります`);
  const related = puzzles
    .filter((p) => p.theme === puzzle.theme && p.id !== puzzle.id)
    .sort((a, b) => (a.round ?? 1) - (b.round ?? 1));
  const args = { template, parts, puzzle, localeSource, site, image: imageFor(puzzle), related };
  await writeFile(path.join(outDir, pageName(puzzle)), renderPuzzleHtml(args));
  console.error(`→ ${pageName(puzzle)}`);
  if (puzzle === latest) {
    await writeFile(path.join(outDir, 'index.html'), renderPuzzleHtml({ ...args, isLatest: true }));
    console.error('→ index.html');
  }
}
const entries = puzzles.map((puzzle) => ({ puzzle, image: thumbFor(imageFor(puzzle)) }));
await writeFile(path.join(outDir, 'archive.html'), renderArchiveHtml({ template: archiveTemplate, parts, site, entries }));
console.error('→ archive.html');
