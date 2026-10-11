// ページを作るのに使うテンプレートと、ページに埋め込むプログラム（言語設定・文字種のルール）を読む。
// リポジトリ（手元）でも Lambda（同じファイルを固めて上げる）でも、ROOT からの相対パスで読む。

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './words.js';
import { SCRIPTS } from '../scripts/index.js';

export async function loadSiteSources(locale = 'ja') {
  const read = (file) => readFile(path.join(ROOT, file), 'utf8');
  const localeSource = await read(`generator/locales/${locale}.js`);
  // ページに埋め込む言語設定と文字種のルール（文字種ごと）
  const pageSources = new Map();
  for (const name of Object.keys(SCRIPTS)) pageSources.set(name, `${localeSource}\n${await read(`generator/scripts/${name}.js`)}`);
  return {
    templates: {
      puzzle: await read('template/puzzle.html'),
      archive: await read('template/archive.html'),
      words: await read('template/words.html'),
      wordsIndex: await read('template/words-index.html'),
      privacy: await read('template/privacy.html'),
    },
    parts: {
      baseCss: await read('template/base.css'),
      header: await read('template/header.html'),
      footer: await read('template/footer.html'),
    },
    consentGate: await read('template/consent-gate.js'),
    consent: await read('template/consent.js'),
    pageSource: (scriptName = 'kana') => {
      if (!pageSources.has(scriptName)) throw new Error(`未知の文字種: ${scriptName}`);
      return pageSources.get(scriptName);
    },
  };
}
