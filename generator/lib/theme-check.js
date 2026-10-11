// 単語リスト（テーマファイル）の点検。docs/genre-guide.md のルールを機械的に確かめる。
// ファイル操作はしない。errors（直さないといけないもの）と warnings（確認したほうがよいもの）を返す。

import { GENRE_PATTERN } from '../build.js';
import { checkClue, checkExplanation } from '../clues/checks.js';
import { resolveSettings } from '../clues/request.js';

const MIN_LEN = 2;
const MAX_LEN = 9; // 盤面 9×9 に入る長さ

/**
 * @param {object} doc         テーマファイルの中身
 * @param {object} options
 * @param {object} options.locale      locales/<locale>.js
 * @param {object} [options.site]      data/site/<locale>.json（imageStyle を確かめる）
 * @param {string[]} [options.imageFiles] data/images/ にあるファイル名
 * @param {string} [options.fileName]  テーマファイルの名前（例: sangetsuki.json）
 * @param {boolean} [options.strict]   すべての語にカギと解説が必要（公開してよい状態か）
 */
export function checkTheme(doc, { locale, site, imageFiles, fileName, strict = false }) {
  const errors = [];
  const warnings = [];
  const filler = doc.filler === true;

  // テーマ全体
  if (doc.locale !== locale.locale) errors.push(`locale が ${locale.locale} ではない`);
  if (!GENRE_PATTERN.test(doc.theme ?? '')) errors.push(`theme（ジャンルの英名）が命名ルールに合わない: ${doc.theme}`);
  if (fileName && fileName !== `${doc.theme}.json`) errors.push(`ファイル名が ${doc.theme}.json ではない: ${fileName}`);
  for (const key of ['title', 'subtitle', 'description']) if (!doc[key]) errors.push(`${key} がない`);
  if (!doc.clue?.style) errors.push('clue.style（カギの書き方）がない');
  if (!doc.explanation?.style) errors.push('explanation.style（解説の書き方）がない');
  if (!Array.isArray(doc.rules)) errors.push('rules（但し書き）がない（なければ空の配列）');
  if (!filler) {
    if (!doc.image) errors.push('image（ジャンルの絵の名前）がない');
    else if (imageFiles && !imageFiles.includes(doc.image)) warnings.push(`絵 ${doc.image} がまだない（npm run theme-image）`);
    if (!doc.imagePrompt) errors.push('imagePrompt（絵のプロンプト）がない');
    else if (site?.imageStyle && !doc.imagePrompt.endsWith(site.imageStyle)) warnings.push('imagePrompt の最後がサイト共通の画風（imageStyle）になっていない');
  }
  if (!Array.isArray(doc.words) || !doc.words.length) {
    errors.push('words がない');
    return { errors, warnings };
  }

  // 単語
  const seen = new Set();
  const clueSettings = resolveSettings('clue', doc, locale);
  const explanationSettings = resolveSettings('explanation', doc, locale);
  const clues = doc.words.map((w) => w.clue).filter(Boolean);
  let usable = 0;
  for (const w of doc.words) {
    const name = `${w.display ?? '?'}（${w.answer ?? '?'}）`;
    if (!w.answer || !w.display) {
      errors.push(`${name}: answer と display が必要`);
      continue;
    }
    if (!locale.isValidAnswer(w.answer) || locale.normalize(w.answer) !== w.answer) {
      errors.push(`${name}: answer が文字のルールに合わない（正しくは ${locale.normalize(w.answer)}）`);
    }
    const len = [...w.answer].length;
    if (len < MIN_LEN) errors.push(`${name}: ${MIN_LEN}文字未満`);
    if (len > MAX_LEN) warnings.push(`${name}: ${len}文字。9×9 の盤面には入らない`);
    else usable++;
    const key = `${w.answer}|${w.display}`;
    if (seen.has(key)) errors.push(`${name}: 同じ answer と display の語が重複している`);
    seen.add(key);
    if (w.level != null && ![1, 2, 3].includes(w.level)) errors.push(`${name}: level は 1〜3`);
    if (w.weight != null && !(w.weight > 0 && w.weight <= 1)) errors.push(`${name}: weight は 0 より大きく 1 以下`);

    if (w.clue) {
      const others = clues.filter((c) => c !== w.clue).concat(clues.filter((c) => c === w.clue).slice(1));
      const problem = checkClue({ word: w, text: w.clue, maxLength: clueSettings.maxLength, locale, others });
      if (problem) errors.push(`${name}: カギ「${w.clue}」→ ${problem}`);
    }
    if (w.explanation) {
      const problem = checkExplanation({ text: w.explanation, maxLength: explanationSettings.maxLength });
      if (problem) errors.push(`${name}: 解説 → ${problem}`);
    }
  }
  const noClue = doc.words.filter((w) => !w.clue).length;
  const noExplanation = doc.words.filter((w) => !w.explanation).length;
  if (noClue || noExplanation) {
    const message = `カギのない語 ${noClue}、解説のない語 ${noExplanation}（npm run theme-texts、または直接書く）`;
    (strict ? errors : warnings).push(message);
  }
  if (!filler && usable < 60) warnings.push(`盤面に使える語が ${usable} 語。60 語以上あると組みやすい`);
  return { errors, warnings };
}
