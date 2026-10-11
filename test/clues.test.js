import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ja from '../generator/locales/ja.js';
import { addClues } from '../generator/clues/index.js';
import { buildClueRequest } from '../generator/clues/request.js';
import { checkClue } from '../generator/clues/checks.js';
import { loadThemeFile } from '../generator/lib/words.js';

const word = { answer: 'キタチヨウセン', display: '北朝鮮' };

test('カギのチェック: 答えの漏れ・長さ・空', () => {
  const check = (clue) => checkClue({ word, clue, maxLength: 40, locale: ja });
  assert.equal(check('首都はピョンヤン。日本と国交のない東アジアの地域'), null);
  assert.match(check('北朝鮮の首都はピョンヤン'), /表記/);
  assert.match(check('きたちょうせんと読む'), /答え/); // ひらがな・小さい文字でも見つける
  assert.match(check('あ'.repeat(41)), /超えている/);
  assert.match(check(''), /空/);
});

test('依頼にはテーマの作り方と単語が入る', async () => {
  const themeFile = await loadThemeFile('ja', 'countries');
  const r = buildClueRequest({ themeFile, locale: ja, words: [{ ...word, note: '朝鮮半島北部' }] });
  assert.ok(r.system.includes(themeFile.clue.style));
  assert.ok(r.prompt.includes('北朝鮮（キタチヨウセン、7文字） メモ: 朝鮮半島北部'));
});

test('チェックに落ちたカギは理由を添えて書き直させる', async () => {
  const themeFile = await loadThemeFile('ja', 'countries');
  const puzzle = { locale: 'ja', words: [{ ...word, theme: 'countries', clue: null }] };
  const prompts = [];
  const writer = {
    name: 'fake',
    async write({ prompt, words }) {
      prompts.push(prompt);
      const clue = prompts.length === 1 ? '北朝鮮のこと' : '首都はピョンヤン';
      return words.map((w) => ({ answer: w.answer, display: w.display, clue }));
    },
  };
  const result = await addClues({ puzzle, themeFiles: [themeFile], locale: ja, writer });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /前回のカギには次の問題/);
  assert.equal(result.puzzle.words[0].clue, '首都はピョンヤン');
  assert.deepEqual(result.problems, []);
});

test('サンプルのパズルはすべてのカギがチェックを通る', async () => {
  const { readFile } = await import('node:fs/promises');
  const puzzle = JSON.parse(await readFile(new URL('../puzzles/2026-10-12-ja.json', import.meta.url), 'utf8'));
  for (const w of puzzle.words) {
    assert.equal(checkClue({ word: w, clue: w.clue, maxLength: 40, locale: ja }), null, w.display);
  }
});

test('Claude API の writer: 依頼の形と応答の読み取り', async () => {
  const { createAnthropicWriter } = await import('../generator/clues/writers/anthropic.js');
  let sent;
  const client = {
    beta: {
      messages: {
        async create(params) {
          sent = params;
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"clues":[{"answer":"ドア","display":"ドア","clue":"出入り口の戸"}]}' }] };
        },
      },
    },
  };
  const writer = createAnthropicWriter({ client });
  const clues = await writer.write({ system: 's', prompt: 'p', schema: { type: 'object' } });
  assert.deepEqual(clues, [{ answer: 'ドア', display: 'ドア', clue: '出入り口の戸' }]);
  assert.equal(sent.model, 'claude-opus-5-5');
  assert.equal(sent.output_config.format.type, 'json_schema');
  assert.equal(sent.fallbacks, 'default');

  client.beta.messages.create = async () => ({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [] });
  await assert.rejects(writer.write({ system: 's', prompt: 'p', schema: {} }), /断られた/);
});
