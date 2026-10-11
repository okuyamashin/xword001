import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, isValidAnswer } from '../generator/locales/ja.js';
import { buildPuzzle } from '../generator/build.js';
import { validatePuzzle } from '../generator/lib/validate.js';
import { loadThemeFile } from '../generator/lib/words.js';

test('日本語の正規化', () => {
  assert.equal(normalize('しゃつ'), 'シヤツ');
  assert.equal(normalize('ヴァイオリン'), 'バイオリン');
  assert.equal(normalize('ヴェトナム'), 'ベトナム');
  assert.equal(normalize('サントメ・プリンシペ'), 'サントメプリンシペ');
  assert.equal(normalize('ｶﾞｲｱﾅ'), 'ガイアナ');
});

test('単語リストの answer はすべて正規化済み', async () => {
  for (const theme of ['countries', 'general']) {
    const file = await loadThemeFile('ja', theme);
    for (const w of file.words) {
      assert.ok(isValidAnswer(w.answer), `${theme}: ${w.answer}`);
      assert.equal(normalize(w.answer), w.answer, `${theme}: ${w.answer}`);
    }
  }
});

test('同じ日付からは同じパズルができ、検証を通る', async () => {
  const themeFiles = [await loadThemeFile('ja', 'countries')];
  const generalFile = await loadThemeFile('ja', 'general');
  const layout = { attempts: 30 };
  const a = buildPuzzle({ date: '2026-10-12', locale: 'ja', themeFiles, generalFile, layout });
  const b = buildPuzzle({ date: '2026-10-12', locale: 'ja', themeFiles, generalFile, layout });
  assert.deepEqual(a.puzzle, b.puzzle);
  assert.deepEqual(validatePuzzle(a.puzzle), []);
  assert.ok(a.stats.generalCount <= 2);
});

test('検証は意図しない並びを見つける', () => {
  const puzzle = {
    grid: ['アイ#', 'ウ##', '###'],
    words: [{ number: 1, direction: 'across', row: 0, col: 0, answer: 'アイ' }],
  };
  assert.ok(validatePuzzle(puzzle).length > 0);
});
