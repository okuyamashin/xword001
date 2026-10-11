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

test('今回の単語と同じ手本は依頼に入れない', async () => {
  const themeFile = await loadThemeFile('ja', 'countries');
  const kenya = { answer: 'ケニア', display: 'ケニア' };
  const r = buildClueRequest({ themeFile, locale: ja, words: [kenya] });
  assert.ok(!r.system.includes('ナイロビ'));
  assert.ok(r.system.includes('マチュピチュ'));
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

test('OpenAI の writer: 依頼の形と応答の読み取り', async () => {
  const { createOpenAIWriter } = await import('../generator/clues/writers/openai.js');
  let sent;
  const client = {
    responses: {
      async create(params) {
        sent = params;
        return { status: 'completed', output: [], output_text: '{"clues":[{"answer":"ドア","display":"ドア","clue":"出入り口の戸"}]}' };
      },
    },
  };
  const writer = createOpenAIWriter({ client, model: 'test-model' });
  const clues = await writer.write({ system: 's', prompt: 'p', schema: { type: 'object' } });
  assert.deepEqual(clues, [{ answer: 'ドア', display: 'ドア', clue: '出入り口の戸' }]);
  assert.equal(sent.model, 'test-model');
  assert.equal(sent.instructions, 's');
  assert.equal(sent.text.format.type, 'json_schema');
  assert.equal(sent.text.format.strict, true);

  client.responses.create = async () => ({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }],
    output_text: '',
  });
  await assert.rejects(writer.write({ system: 's', prompt: 'p', schema: {} }), /断られた/);
  client.responses.create = async () => ({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] });
  await assert.rejects(writer.write({ system: 's', prompt: 'p', schema: {} }), /途中で終わった/);
});
