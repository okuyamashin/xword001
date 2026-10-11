// 文字種（script）。テーマファイルの "script" で選ぶ（省略時は kana）
import * as kana from './kana.js';
import * as latin from './latin.js';

export const SCRIPTS = { kana, latin };

export function scriptOf(name = 'kana') {
  const s = SCRIPTS[name];
  if (!s) throw new Error(`未知の文字種: ${name}（${Object.keys(SCRIPTS).join(' / ')}）`);
  return s;
}

// 言語（画面の文言・カギと解説の標準の指示）と文字種（答えの文字のルール）を合わせたもの
export function langFor(locale, scriptName = 'kana') {
  return { ...locale, ...scriptOf(scriptName) };
}
