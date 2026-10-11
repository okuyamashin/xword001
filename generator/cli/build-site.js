// puzzles/*.json と単語リストから site/ にページを作る（作るページは generator/site-build.js）。
// 本番では Lambda が同じ関数でページを作り直す。これは手元で確かめる用と、npm run deploy 用。
// 使い方: node generator/cli/build-site.js [--locale ja] [--puzzles <dir>] [--out <dir>]

import { readFile, readdir, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildSitePages } from '../site-build.js';
import { loadSiteSources } from '../lib/site-sources.js';
import { ROOT } from '../lib/words.js';

const { values } = parseArgs({
  options: {
    locale: { type: 'string', default: 'ja' },
    puzzles: { type: 'string', default: path.join(ROOT, 'puzzles') },
    out: { type: 'string', default: path.join(ROOT, 'site') },
  },
});
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const site = await readJson(path.join(ROOT, `data/site/${values.locale}.json`));
const locale = await import(`../locales/${values.locale}.js`);

const puzzles = [];
for (const file of (await readdir(values.puzzles)).filter((f) => f.endsWith('.json'))) {
  const puzzle = await readJson(path.join(values.puzzles, file));
  if (puzzle.locale === values.locale) puzzles.push(puzzle);
}
const wordsDir = path.join(ROOT, 'data/words', values.locale);
const themes = [];
for (const f of (await readdir(wordsDir)).filter((f) => f.endsWith('.json'))) themes.push(await readJson(path.join(wordsDir, f)));

const images = await readdir(path.join(ROOT, 'data/images'));
const unconverted = images.filter((f) => /\.(png|jpe?g)$/i.test(f));
if (unconverted.length) console.error(`WebP に変換していない絵があります（npm run images）: ${unconverted.join(', ')}`);

const { files, warnings } = buildSitePages({ locale, site, sources: await loadSiteSources(values.locale), puzzles, themes, images });
for (const w of warnings) console.error(w);

const outDir = values.out;
await mkdir(outDir, { recursive: true });
// 前回作ったページを消してから作り直す（名前を変えたときに古いページが残らないように）
for (const f of await readdir(outDir)) if (/\.(html|json|xml|txt|js)$/.test(f)) await rm(path.join(outDir, f));
await rm(path.join(outDir, 'images'), { recursive: true, force: true });
await cp(path.join(ROOT, 'data/images'), path.join(outDir, 'images'), { recursive: true, filter: (src) => !/\.(png|jpe?g)$/i.test(src) });
for (const { name, body } of files) await writeFile(path.join(outDir, name), body);
console.error(`→ ${path.relative(process.cwd(), outDir) || '.'}/ に ${files.length} ファイル（パズル ${puzzles.length} 問・単語帳 ${themes.length} 冊）と絵`);
