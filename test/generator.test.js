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
  const { readdir } = await import('node:fs/promises');
  const themes = (await readdir(new URL('../data/words/ja/', import.meta.url))).map((f) => f.replace(/\.json$/, ''));
  assert.ok(themes.length >= 3);
  for (const theme of themes) {
    const file = await loadThemeFile('ja', theme);
    for (const w of file.words) {
      assert.ok(isValidAnswer(w.answer), `${theme}: ${w.answer}`);
      assert.equal(normalize(w.answer), w.answer, `${theme}: ${w.answer}`);
    }
  }
});

test('同じ番号からは同じパズルができ、IDは命名ルールどおりで、検証を通る', async () => {
  const themeFiles = [await loadThemeFile('ja', 'countries')];
  const generalFile = await loadThemeFile('ja', 'general');
  const layout = { attempts: 30 };
  const a = buildPuzzle({ serial: 1, round: 1, date: '2026-10-12', locale: 'ja', themeFiles, generalFile, layout });
  const b = buildPuzzle({ serial: 1, round: 1, date: '2026-10-12', locale: 'ja', themeFiles, generalFile, layout });
  assert.deepEqual(a.puzzle, b.puzzle);
  assert.equal(a.puzzle.id, '00001-countries-001');
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

test('パズルを作るとき、単語リストのカギと解説を書き写す（AI を使わない）', async () => {
  const themeFiles = [await loadThemeFile('ja', 'sangetsuki')];
  const generalFile = await loadThemeFile('ja', 'general');
  const { puzzle } = buildPuzzle({ serial: 9, round: 1, date: '2026-10-15', locale: 'ja', themeFiles, generalFile, layout: { attempts: 30 } });
  for (const w of puzzle.words.filter((x) => x.theme === 'sangetsuki')) {
    assert.ok(w.clue, `${w.display} のカギ`);
    assert.ok(w.explanation, `${w.display} の解説`);
  }
  assert.equal(puzzle.description, themeFiles[0].description);
});

test('すべての単語リストが点検を通る（山月記はカギと解説までそろっている）', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const { checkTheme } = await import('../generator/lib/theme-check.js');
  const ja = await import('../generator/locales/ja.js');
  const dir = new URL('../data/words/ja/', import.meta.url);
  const site = JSON.parse(await readFile(new URL('../data/site/ja.json', import.meta.url), 'utf8'));
  const imageFiles = await readdir(new URL('../data/images/', import.meta.url));
  for (const fileName of await readdir(dir)) {
    const doc = JSON.parse(await readFile(new URL(fileName, dir), 'utf8'));
    const strict = doc.theme === 'sangetsuki';
    const { errors } = checkTheme(doc, { locale: ja, site, imageFiles, fileName, strict });
    assert.deepEqual(errors, [], fileName);
  }
});
