// 単語リストの読み込み（ファイル操作はここと CLI だけ）

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function loadThemeFile(locale, theme) {
  const file = path.join(ROOT, 'data/words', locale, `${theme}.json`);
  const data = JSON.parse(await readFile(file, 'utf8'));
  return { ...data, words: data.words.map((w) => ({ ...w, theme: data.theme })) };
}
