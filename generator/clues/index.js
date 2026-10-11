// クロスワードの単語に、カギ（clue）や解説（explanation）をつける（標準の流れ）
//
//   まだ空の単語だけを選ぶ → テーマごとに分ける → 依頼を作る → writer に書かせる
//   → 自動チェック → だめなものだけ理由を添えて書き直させる（最大 maxRounds 回）
//
// writer は { name, write({ field, system, prompt, schema, words }) → [{answer, display, text}] }。
// OpenAI API（writers/openai.js）や、用意した文章（writers/file.js）を差し替えて使う。
// ファイル操作はしない。

import { buildRequest } from './request.js';
import { CHECKS } from './checks.js';

export async function addTexts({ field, puzzle, themeFiles, locale, writer, maxRounds = 3 }) {
  const check = CHECKS[field];
  if (!check) throw new Error(`未知の項目: ${field}`);
  const themeById = new Map(themeFiles.map((f) => [f.theme, f]));
  const words = puzzle.words.map((w) => ({ ...w }));
  const problems = [];

  for (const [theme, group] of groupBy(words.filter((w) => !w[field]), (w) => w.theme)) {
    const themeFile = themeById.get(theme);
    if (!themeFile) throw new Error(`テーマファイル ${theme} がない`);
    const notes = new Map(themeFile.words.map((w) => [`${w.answer}|${w.display}`, w.note]));
    let pending = group;
    let retry = [];
    for (let round = 1; round <= maxRounds && pending.length; round++) {
      const targets = pending.map((w) => ({
        answer: w.answer,
        display: w.display,
        note: notes.get(`${w.answer}|${w.display}`),
        clue: w.clue,
      }));
      const request = buildRequest({ field, themeFile, locale, words: targets, retry });
      const results = await writer.write({ ...request, field, words: targets });
      const byKey = new Map(results.map((r) => [`${r.answer}|${r.display}`, r.text]));
      retry = [];
      const next = [];
      for (const w of pending) {
        const text = byKey.get(`${w.answer}|${w.display}`);
        const others = words.filter((o) => o !== w && o[field]).map((o) => o[field]);
        const problem = check({ word: w, text, maxLength: request.maxLength, locale, others });
        if (problem) {
          retry.push({ answer: w.answer, display: w.display, text: text ?? '', problem });
          next.push(w);
        } else {
          w[field] = text.trim();
        }
      }
      pending = next;
    }
    problems.push(...retry.map((r) => ({ ...r, field })));
  }
  return { puzzle: { ...puzzle, words }, problems };
}

export const addClues = (args) => addTexts({ ...args, field: 'clue' });
export const addExplanations = (args) => addTexts({ ...args, field: 'explanation' });

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
