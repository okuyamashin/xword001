// 単語リスト（テーマファイル）を点検する。
// 使い方: node generator/cli/check-theme.js --theme sangetsuki [--strict]
//         node generator/cli/check-theme.js --all [--strict]
//   --strict  すべての語にカギと解説がそろっているか（公開してよい状態か）まで確かめる

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { checkTheme } from '../lib/theme-check.js';
import { ROOT } from '../lib/words.js';

const { values } = parseArgs({
  options: {
    theme: { type: 'string' },
    all: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    locale: { type: 'string', default: 'ja' },
  },
});
const dir = path.join(ROOT, 'data/words', values.locale);
const files = values.all ? (await readdir(dir)).filter((f) => f.endsWith('.json')) : [`${values.theme}.json`];
if (!values.all && !values.theme) throw new Error('--theme か --all を指定してください');

const locale = await import(`../locales/${values.locale}.js`);
const site = JSON.parse(await readFile(path.join(ROOT, 'data/site', `${values.locale}.json`), 'utf8'));
const imageFiles = await readdir(path.join(ROOT, 'data/images'));
let failed = false;
for (const fileName of files) {
  let doc;
  try {
    doc = JSON.parse(await readFile(path.join(dir, fileName), 'utf8'));
  } catch (e) {
    console.error(`✗ ${fileName}: JSON として読めない（${e.message}）`);
    failed = true;
    continue;
  }
  const { errors, warnings } = checkTheme(doc, { locale, site, imageFiles, fileName, strict: values.strict });
  console.error(`${errors.length ? '✗' : '✓'} ${fileName}（${doc.words?.length ?? 0}語）エラー ${errors.length}・注意 ${warnings.length}`);
  for (const e of errors) console.error(`  エラー: ${e}`);
  for (const w of warnings) console.error(`  注意: ${w}`);
  if (errors.length) failed = true;
}
if (failed) process.exitCode = 1;
