// テーマ（ジャンル）の絵を OpenAI の画像生成 API で作り、WebP に変えて、テーマファイルの image に名前を書き込む。
// 絵はジャンルにつき 1 枚。プロンプトはテーマファイルの imagePrompt。PNG はリポジトリに入れない。
// 使い方: node generator/cli/theme-image.js --theme sangetsuki [--locale ja] [--force] [--quality medium]
//   --force  すでに絵があっても作り直す
// 認証は OPENAI_API_KEY（クラウド環境ではネットワークシークレットでも可）。モデルは OPENAI_IMAGE_MODEL（省略時 gpt-image-2）

import { readFile, writeFile, access, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import OpenAI from 'openai';
import { convertImage } from '../images/convert.js';
import { ROOT } from '../lib/words.js';

const { values } = parseArgs({
  options: {
    theme: { type: 'string' },
    locale: { type: 'string', default: 'ja' },
    force: { type: 'boolean', default: false },
    quality: { type: 'string', default: 'medium' },
  },
});
if (!values.theme) throw new Error('--theme を指定してください');

const themePath = path.join(ROOT, 'data/words', values.locale, `${values.theme}.json`);
const source = await readFile(themePath, 'utf8');
const theme = JSON.parse(source);
if (!theme.imagePrompt) throw new Error(`${values.theme}.json に imagePrompt がない`);

const imageName = `${theme.theme}.webp`;
const outBase = path.join(ROOT, 'data/images', theme.theme);
const exists = await access(`${outBase}.webp`).then(() => true, () => false);
if (exists && !values.force) {
  console.error(`${imageName} はすでにあります（作り直すときは --force）`);
} else {
  const model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2';
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'injected-by-proxy' });
  console.error(`画像を生成中（${model}, ${values.quality}）…`);
  // ストリーミングで受け取る（途中経過の画像が届くので、時間がかかっても通信が途切れにくい。
  // まとめて待つ方式では、プロキシ経由で 502 になった）
  const stream = await client.images.generate({
    model,
    prompt: theme.imagePrompt,
    size: '1024x1024',
    quality: values.quality,
    output_format: 'png',
    stream: true,
    partial_images: 2,
  });
  let b64 = null;
  for await (const event of stream) {
    if (event.type === 'image_generation.partial_image') console.error(`  途中経過 ${event.partial_image_index + 1}`);
    if (event.type === 'image_generation.completed') b64 = event.b64_json;
  }
  if (!b64) throw new Error('画像が返ってこなかった');
  const png = Buffer.from(b64, 'base64');
  const { cover, thumb } = await convertImage(png, outBase);
  const kb = async (f) => `${Math.round((await stat(f)).size / 1024)}KB`;
  console.error(`PNG ${Math.round(png.length / 1024)}KB → ${path.basename(cover)}（${await kb(cover)}）, ${path.basename(thumb)}（${await kb(thumb)}）`);
}

// テーマファイルの image を更新する（行の並びはそのまま）
if (theme.image !== imageName) {
  const updated = /^ {2}"image": .*,$/m.test(source)
    ? source.replace(/^ {2}"image": .*,$/m, `  "image": ${JSON.stringify(imageName)},`)
    : source.replace(/^( {2}"description": .*,)$/m, `$1\n  "image": ${JSON.stringify(imageName)},`);
  JSON.parse(updated);
  await writeFile(themePath, updated);
  console.error(`${path.relative(ROOT, themePath)} の image を ${imageName} にしました`);
}
