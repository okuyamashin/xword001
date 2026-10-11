// puzzles/*.json から site/ に HTML を作る。
//   site/<ID>.html      パズルのページ（例: 00001-countries-001.html）
//   site/index.html     いちばん新しいパズル（通し番号が最大のもの）
//   site/archive.html   バックナンバー（一覧）
//   site/words.html      単語帳の一覧
//   site/words-<ジャンル>.html / .json  ジャンルの単語帳（言葉・読み・カギ・解説）と、そのダウンロード用 JSON
//   site/sitemap.xml・robots.txt・llms.txt  検索エンジンと AI 向けの案内（本番のアドレスは data/site/<locale>.json の baseUrl）
// 使い方: node generator/cli/build-site.js [--locale ja] [--puzzles <dir>] [--out <dir>]

import { readFile, readdir, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { renderPuzzleHtml, renderArchiveHtml, renderWordsHtml, renderWordsIndexHtml, publicWordList, pageName, wordsPageName, puzzleHeading, DEFAULT_IMAGE } from '../site.js';
import { renderSitemap, renderRobots, renderLlmsTxt } from '../seo.js';
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
const wordsTemplate = await read('template/words.html');
const wordsIndexTemplate = await read('template/words-index.html');
const parts = { baseCss: await read('template/base.css'), header: await read('template/header.html'), footer: await read('template/footer.html') };
const localeSource = await read(`generator/locales/${values.locale}.js`);
// ページに埋め込む言語設定と文字種のルール（文字種ごと）
const scriptSources = new Map();
const sourceFor = async (scriptName = 'kana') => {
  if (!scriptSources.has(scriptName)) scriptSources.set(scriptName, `${localeSource}\n${await read(`generator/scripts/${scriptName}.js`)}`);
  return scriptSources.get(scriptName);
};
const site = JSON.parse(await read(`data/site/${values.locale}.json`));
const outDir = values.out;
await mkdir(outDir, { recursive: true });
// 前回作ったページを消してから作り直す（名前を変えたときに古いページが残らないように）
for (const f of await readdir(outDir)) if (/\.(html|json|xml|txt)$/.test(f)) await rm(path.join(outDir, f));
await rm(path.join(outDir, 'images'), { recursive: true, force: true });
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
for (const file of (await readdir(values.puzzles)).filter((f) => f.endsWith('.json'))) {
  const puzzle = JSON.parse(await readFile(path.join(values.puzzles, file), 'utf8'));
  if (puzzle.locale === values.locale) puzzles.push(puzzle);
}
puzzles.sort((a, b) => a.serial - b.serial);

// 絵はジャンル（テーマ）ごとに 1 枚。テーマファイルの image を使い、なければ方眼紙
const themeImages = new Map();
const themes = [];
for (const f of (await readdir(path.join(ROOT, 'data/words', values.locale))).filter((f) => f.endsWith('.json'))) {
  const t = JSON.parse(await read(`data/words/${values.locale}/${f}`));
  themes.push(t);
  if (t.image) themeImages.set(t.theme, t.image);
}
const imageFor = (puzzle) => {
  const image = themeImages.get(puzzle.theme.split('+')[0]);
  if (image && imageFiles.includes(image)) return image;
  if (image) console.error(`${puzzle.id}: テーマの絵 ${image} がまだありません（npm run theme-image）`);
  return DEFAULT_IMAGE;
};

const latest = puzzles.at(-1);
for (const puzzle of puzzles) {
  const missing = puzzle.words.filter((w) => !w.clue).length;
  if (missing) console.error(`${puzzle.id}: カギのない単語が ${missing} 語あります`);
  const related = puzzles
    .filter((p) => p.theme === puzzle.theme && p.id !== puzzle.id)
    .sort((a, b) => (a.round ?? 1) - (b.round ?? 1));
  const args = { template, parts, puzzle, localeSource: await sourceFor(puzzle.script), site, image: imageFor(puzzle), related };
  await writeFile(path.join(outDir, pageName(puzzle)), renderPuzzleHtml(args));
  console.error(`→ ${pageName(puzzle)}`);
  if (puzzle === latest) {
    // トップページ: 最新の問題と、その前の最近の 3 問
    const recent = puzzles.filter((p) => p !== puzzle).slice(-3).reverse();
    await writeFile(path.join(outDir, 'index.html'), renderPuzzleHtml({ ...args, recent, isLatest: true }));
    console.error('→ index.html');
  }
}
const entries = puzzles.map((puzzle) => ({ puzzle, image: thumbFor(imageFor(puzzle)) }));
await writeFile(path.join(outDir, 'archive.html'), renderArchiveHtml({ template: archiveTemplate, parts, site, entries, themeFiles: new Map(themes.map((t) => [t.theme, t])) }));
console.error('→ archive.html');

// 単語帳
const locale = await import(`../locales/${values.locale}.js`);
const { langFor } = await import('../scripts/index.js');
const books = [];
for (const theme of themes) {
  const genrePuzzles = puzzles.filter((p) => p.theme.split('+')[0] === theme.theme).sort((a, b) => (a.round ?? 1) - (b.round ?? 1));
  const hasImage = theme.image && imageFiles.includes(theme.image);
  const image = hasImage ? thumbFor(theme.image) : null;
  const jsonName = `words-${theme.theme}.json`;
  await writeFile(path.join(outDir, jsonName), `${JSON.stringify(publicWordList(theme), null, 2)}\n`);
  const html = renderWordsHtml({
    template: wordsTemplate, parts, site, theme, puzzles: genrePuzzles, image, shareImage: hasImage ? theme.image : null, jsonName,
    lang: langFor(locale, theme.script),
  });
  await writeFile(path.join(outDir, wordsPageName(theme.theme)), html);
  books.push({ theme, image, puzzleCount: genrePuzzles.length, lastmod: genrePuzzles.map((p) => p.date).sort().at(-1) });
}
await writeFile(path.join(outDir, 'words.html'), renderWordsIndexHtml({ template: wordsIndexTemplate, parts, site, books }));
console.error(`→ words.html と単語帳 ${books.length} 冊`);

// 検索エンジンと AI 向けの案内
if (site.baseUrl) {
  const newest = latest?.date;
  const pages = [
    { path: 'index.html', lastmod: newest },
    { path: 'archive.html', lastmod: newest },
    { path: 'words.html', lastmod: newest },
    ...[...puzzles].reverse().map((p) => ({ path: pageName(p), lastmod: p.date })),
    ...books.map(({ theme, lastmod }) => ({ path: wordsPageName(theme.theme), lastmod })),
  ];
  await writeFile(path.join(outDir, 'sitemap.xml'), renderSitemap(site, pages));
  await writeFile(path.join(outDir, 'robots.txt'), renderRobots(site));
  await writeFile(path.join(outDir, 'llms.txt'), renderLlmsTxt({ site, puzzles, themes, pageName, wordsPageName, puzzleHeading }));
  console.error(`→ sitemap.xml（${pages.length} ページ）・robots.txt・llms.txt`);
} else {
  console.error(`data/site/${values.locale}.json に baseUrl がないので、sitemap.xml・robots.txt・llms.txt は作りません`);
}
