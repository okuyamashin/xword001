// 単語リストの読み込み（ファイル操作はここと CLI だけ）

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function loadThemeFile(locale, theme) {
  const file = path.join(ROOT, 'data/words', locale, `${theme}.json`);
  const data = JSON.parse(await readFile(file, 'utf8'));
  return { ...data, words: data.words.map((w) => ({ ...w, theme: data.theme })) };
}

export function themeFilePath(locale, theme) {
  return path.join(ROOT, 'data/words', locale, `${theme}.json`);
}

// テーマファイルを書き出す。見出し部分は整形し、単語は 1 語 1 行にする（差分を読みやすくするため）
export function formatThemeFile(doc) {
  const { words, ...head } = doc;
  const top = JSON.stringify(head, null, 2).slice(0, -2);
  const lines = words.map((w) => {
    const { theme, ...rest } = w; // 読み込み時に足した theme は書き出さない
    // 既存のファイルと同じく、{"key": value, ...} の形（コロンとカンマのあとに空白）
    return `    {${Object.entries(rest).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')}}`;
  });
  return `${top},\n  "words": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

export async function saveThemeFile(locale, doc) {
  const text = formatThemeFile(doc);
  JSON.parse(text);
  await writeFile(themeFilePath(locale, doc.theme), text);
}
