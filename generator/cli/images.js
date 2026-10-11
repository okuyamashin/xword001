// data/images/ にある PNG・JPEG を、表示の大きさに合わせた WebP に変える。
//   <名前>.webp        表紙用。800px 四方（盤面の最大幅 520px に対し、高精細画面でもほぼ足りる大きさ。表示は 1.2 秒ほどなので軽さを優先）
//   <名前>.thumb.webp  一覧ページの小さな絵用。88px の 2 倍 = 176px 四方
// 変換が終わったら元の PNG・JPEG は消す（リポジトリを重くしないため）。
// 使い方: node generator/cli/images.js [--keep]

import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { ROOT } from '../lib/words.js';

export const COVER_SIZE = 800;
export const THUMB_SIZE = 176;

const { values } = parseArgs({ options: { keep: { type: 'boolean', default: false } } });
const dir = path.join(ROOT, 'data/images');
const sources = (await readdir(dir)).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (!sources.length) console.error('変換する PNG・JPEG はありません。');

const kb = async (file) => `${Math.round((await stat(file)).size / 1024)}KB`;
for (const file of sources) {
  const src = path.join(dir, file);
  const name = file.replace(/\.[^.]+$/, '');
  const cover = path.join(dir, `${name}.webp`);
  const thumb = path.join(dir, `${name}.thumb.webp`);
  const image = sharp(src).rotate();
  await image.clone().resize(COVER_SIZE, COVER_SIZE, { fit: 'cover' }).webp({ quality: 72 }).toFile(cover);
  await image.clone().resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' }).webp({ quality: 72 }).toFile(thumb);
  console.error(`${file}（${await kb(src)}）→ ${name}.webp（${await kb(cover)}）, ${name}.thumb.webp（${await kb(thumb)}）`);
  if (!values.keep) await rm(src);
}
