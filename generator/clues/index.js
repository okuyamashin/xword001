// クロスワードにカギをつける（標準の流れ）
//
//   テーマごとに単語を分ける → 依頼を作る → writer に書かせる → 自動チェック
//   → だめなものだけ理由を添えて書き直させる（最大 maxRounds 回）
//
// writer は { name, write({ system, prompt, schema, words }) → [{answer, display, clue}] }。
// Claude API（writers/anthropic.js）や、用意したカギ（writers/file.js）を差し替えて使う。
// ファイル操作はしない。

import { buildClueRequest } from './request.js';
import { checkClue } from './checks.js';

export async function addClues({ puzzle, themeFiles, locale, writer, maxRounds = 3 }) {
  const themeById = new Map(themeFiles.map((f) => [f.theme, f]));
  const words = puzzle.words.map((w) => ({ ...w }));
  const problems = [];

  for (const [theme, group] of groupBy(words, (w) => w.theme)) {
    const themeFile = themeById.get(theme);
    if (!themeFile) throw new Error(`テーマファイル ${theme} がない`);
    const notes = new Map(themeFile.words.map((w) => [`${w.answer}|${w.display}`, w.note]));
    let pending = group;
    let retry = [];
    for (let round = 1; round <= maxRounds && pending.length; round++) {
      const targets = pending.map((w) => ({ answer: w.answer, display: w.display, note: notes.get(`${w.answer}|${w.display}`) }));
      const request = buildClueRequest({ themeFile, locale, words: targets, retry });
      const results = await writer.write({ ...request, words: targets });
      const byKey = new Map(results.map((r) => [`${r.answer}|${r.display}`, r.clue]));
      retry = [];
      const next = [];
      for (const w of pending) {
        const clue = byKey.get(`${w.answer}|${w.display}`);
        const otherClues = words.filter((o) => o !== w && o.clue).map((o) => o.clue);
        const problem = checkClue({ word: w, clue, maxLength: request.maxLength, locale, otherClues });
        if (problem) {
          retry.push({ answer: w.answer, display: w.display, clue: clue ?? '', problem });
          next.push(w);
        } else {
          w.clue = clue.trim();
        }
      }
      pending = next;
    }
    problems.push(...retry);
  }
  return { puzzle: { ...puzzle, words }, problems };
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
