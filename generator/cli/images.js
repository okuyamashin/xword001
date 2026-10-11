// data/images/ に置いた PNG・JPEG を WebP に変える（手で用意した絵を使うとき）。
// 変換が終わったら元の PNG・JPEG は消す。
// 使い方: node generator/cli/images.js [--keep]

import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { convertImage } from '../images/convert.js';
import { ROOT } from '../lib/words.js';

const { values } = parseArgs({ options: { keep: { type: 'boolean', default: false } } });
const dir = path.join(ROOT, 'data/images');
const sources = (await readdir(dir)).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (!sources.length) console.error('変換する PNG・JPEG はありません。');

const kb = async (file) => `${Math.round((await stat(file)).size / 1024)}KB`;
for (const file of sources) {
  const src = path.join(dir, file);
  const name = file.replace(/\.[^.]+$/, '');
  const { cover, thumb } = await convertImage(src, path.join(dir, name));
  console.error(`${file}（${await kb(src)}）→ ${path.basename(cover)}（${await kb(cover)}）, ${path.basename(thumb)}（${await kb(thumb)}）`);
  if (!values.keep) await rm(src);
}
