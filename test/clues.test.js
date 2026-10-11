import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ja from '../generator/locales/ja.js';
import { addClues, addExplanations } from '../generator/clues/index.js';
import { buildRequest } from '../generator/clues/request.js';
import { checkClue, checkExplanation } from '../generator/clues/checks.js';
import { loadThemeFile } from '../generator/lib/words.js';

const word = { answer: 'キタチヨウセン', display: '北朝鮮' };

test('カギのチェック: 答えの漏れ・長さ・空', () => {
  const check = (text) => checkClue({ word, text, maxLength: 40, locale: ja });
  assert.equal(check('首都はピョンヤン。日本と国交のない東アジアの地域'), null);
  assert.match(check('北朝鮮の首都はピョンヤン'), /表記/);
  assert.match(check('きたちょうせんと読む'), /答え/); // ひらがな・小さい文字でも見つける
  assert.match(check('あ'.repeat(41)), /超えている/);
  assert.match(check(''), /空/);
});

test('依頼にはテーマの作り方と単語が入る', async () => {
  const themeFile = await loadThemeFile('ja', 'countries');
  const r = buildRequest({ field: 'clue', themeFile, locale: ja, words: [{ ...word, note: '朝鮮半島北部' }] });
  assert.ok(r.system.includes(themeFile.clue.style));
  assert.ok(r.prompt.includes('1. 北朝鮮（読み: キタチヨウセン、7文字） メモ: 朝鮮半島北部'));
});

test('今回の単語と同じ手本は依頼に入れない', async () => {
  const themeFile = await loadThemeFile('ja', 'countries');
  const kenya = { answer: 'ケニア', display: 'ケニア' };
  const r = buildRequest({ field: 'clue', themeFile, locale: ja, words: [kenya] });
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
      const text = prompts.length === 1 ? '北朝鮮のこと' : '首都はピョンヤン';
      return words.map((w) => ({ answer: w.answer, display: w.display, text }));
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
  const puzzle = JSON.parse(await readFile(new URL('../puzzles/00001-countries-001.json', import.meta.url), 'utf8'));
  for (const w of puzzle.words) {
    assert.equal(checkClue({ word: w, text: w.clue, maxLength: 40, locale: ja }), null, w.display);
  }
});

test('OpenAI の writer: 依頼の形と応答の読み取り', async () => {
  const { createOpenAIWriter } = await import('../generator/clues/writers/openai.js');
  let sent;
  let reply = { status: 'completed', output: [], output_text: '{"items":[{"answer":"ドア","display":"ドア","text":"出入り口の戸"}]}' };
  const client = {
    responses: {
      stream(params) {
        sent = params;
        return { finalResponse: async () => reply };
      },
    },
  };
  const writer = createOpenAIWriter({ client, model: 'test-model' });
  const clues = await writer.write({ system: 's', prompt: 'p', schema: { type: 'object' } });
  assert.deepEqual(clues, [{ answer: 'ドア', display: 'ドア', text: '出入り口の戸' }]);
  assert.equal(sent.model, 'test-model');
  assert.equal(sent.instructions, 's');
  assert.equal(sent.text.format.type, 'json_schema');
  assert.equal(sent.text.format.strict, true);

  reply = {
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }],
    output_text: '',
  };
  await assert.rejects(writer.write({ system: 's', prompt: 'p', schema: {} }), /断られた/);
  reply = { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] };
  await assert.rejects(writer.write({ system: 's', prompt: 'p', schema: {} }), /途中で終わった/);
});

test('解説: 空のものだけを埋め、カギを依頼に添え、答えを含んでよい', async () => {
  const countries = await loadThemeFile('ja', 'countries');
  const general = await loadThemeFile('ja', 'general');
  const puzzle = {
    locale: 'ja',
    words: [
      { answer: 'ケニア', display: 'ケニア', theme: 'countries', clue: 'ナイロビが首都', explanation: null },
      { answer: 'ドア', display: 'ドア', theme: 'general', clue: '出入り口の戸', explanation: 'もう書いてある' },
    ],
  };
  const requests = [];
  const writer = {
    name: 'fake',
    async write(req) {
      requests.push(req);
      return req.words.map((w) => ({ answer: w.answer, display: w.display, text: 'ケニアはマラソンで有名です。' }));
    },
  };
  const result = await addExplanations({ puzzle, themeFiles: [countries, general], locale: ja, writer });
  assert.equal(requests.length, 1); // ドアは解説ずみなので呼ばない
  assert.equal(requests[0].field, 'explanation');
  assert.ok(requests[0].prompt.includes('カギ: ナイロビが首都'));
  assert.deepEqual(requests[0].schema.properties.items.items.required, ['id', 'text']);
  assert.ok(requests[0].system.includes(countries.explanation.style));
  assert.equal(result.puzzle.words[0].explanation, 'ケニアはマラソンで有名です。');
  assert.equal(result.puzzle.words[1].explanation, 'もう書いてある');
  assert.equal(checkExplanation({ text: 'あ'.repeat(121), maxLength: 120 }) !== null, true);
});

test('紹介文: 答えを見て書かせ、答えの漏れは注意として返す', async () => {
  const { addIntro } = await import('../generator/clues/intro.js');
  const countries = await loadThemeFile('ja', 'countries');
  const puzzle = {
    title: '世界の国と地域', theme: 'countries', locale: 'ja',
    words: [{ answer: 'ケニア', display: 'ケニア', theme: 'countries' }, { answer: 'ドア', display: 'ドア', theme: 'general' }],
  };
  let request;
  const writer = { name: 'fake', async generate(req) { request = req; return { description: 'ケニアなど世界の国を集めました。' }; } };
  const result = await addIntro({ puzzle, themeFiles: [countries], locale: ja, writer });
  assert.ok(request.prompt.includes('ケニア（ケニア）'));
  assert.ok(request.prompt.includes('ドア（ドア）［テーマ外のつなぎの言葉］'));
  assert.equal(result.puzzle.intro.theme, '世界の国と地域');
  assert.deepEqual(Object.keys(result.puzzle.intro), ['theme', 'description']);
  assert.equal(result.warnings.length, 1);
  // すでにあるときは呼ばない
  const again = await addIntro({ puzzle: result.puzzle, themeFiles: [countries], locale: ja, writer: { generate() { throw new Error('呼ばれた'); } } });
  assert.equal(again.puzzle.intro.description, 'ケニアなど世界の国を集めました。');
});

test('命名ルール: 通し番号5桁-ジャンル-ジャンル内連番3桁', async () => {
  const { nextNumbers, puzzleId, genreOf } = await import('../generator/build.js');
  const existing = [
    { locale: 'ja', serial: 1, genre: 'countries', round: 1 },
    { locale: 'ja', serial: 2, genre: 'animals', round: 1 },
    { locale: 'ja', serial: 3, genre: 'countries', round: 2 },
  ];
  assert.deepEqual(nextNumbers(existing, { locale: 'ja', genre: 'countries' }), { serial: 4, round: 3 });
  assert.deepEqual(nextNumbers(existing, { locale: 'ja', genre: 'japanese_history' }), { serial: 4, round: 1 });
  assert.deepEqual(nextNumbers([], { locale: 'ja', genre: 'animals' }), { serial: 1, round: 1 });
  assert.equal(puzzleId({ serial: 4, genre: 'japanese_history', round: 1 }), '00004-japanese_history-001');
  assert.equal(genreOf([{ theme: 'kamakura' }, { theme: 'japanese_history' }]), 'kamakura_japanese_history');
  assert.throws(() => genreOf([{ theme: 'Japanese-History' }]), /命名ルール/);
});

test('番号で返された文章を、正しい単語に割り当てる', async () => {
  const themeFile = await loadThemeFile('ja', 'sangetsuki');
  const puzzle = {
    locale: 'ja',
    words: [
      { answer: 'カリ', display: '下吏', theme: 'sangetsuki', clue: null },
      { answer: 'ツキ', display: '月', theme: 'sangetsuki', clue: null },
    ],
  };
  // 順番を入れ替え、表記の欄に余計なものがついていても、番号で照合する
  const writer = { name: 'fake', async write() { return [{ id: 2, text: '最後に虎が仰いだもの' }, { id: 1, text: '下級の役人' }]; } };
  const result = await addClues({ puzzle, themeFiles: [themeFile], locale: ja, writer });
  assert.equal(result.puzzle.words[0].clue, '下級の役人');
  assert.equal(result.puzzle.words[1].clue, '最後に虎が仰いだもの');
});
