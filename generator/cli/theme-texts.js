// 単語リスト（テーマファイル）の各語に、カギと解説を 1 つずつ作り置きする。まだ空のものだけを埋める。
// パズルを作るときはここから書き写すだけなので、AI を使わない。
// 使い方: node generator/cli/theme-texts.js --theme sangetsuki [--locale ja] [--only clue|explanation] [--batch 25]

import { parseArgs } from 'node:util';
import { addTexts } from '../clues/index.js';
import { FIELDS } from '../clues/request.js';
import { loadThemeFile, saveThemeFile } from '../lib/words.js';
import { createOpenAIWriter, DEFAULT_MODEL } from '../clues/writers/openai.js';
import { langFor } from '../scripts/index.js';

const { values } = parseArgs({
  options: {
    theme: { type: 'string' },
    locale: { type: 'string', default: 'ja' },
    only: { type: 'string' },
    batch: { type: 'string', default: '25' },
    model: { type: 'string' },
  },
});
if (!values.theme) throw new Error('--theme を指定してください');
const fields = values.only ? [values.only] : Object.keys(FIELDS);
for (const f of fields) if (!FIELDS[f]) throw new Error(`--only は ${Object.keys(FIELDS).join(' / ')} のどれか`);

const themeFile = await loadThemeFile(values.locale, values.theme);
const locale = langFor(await import(`../locales/${values.locale}.js`), themeFile.script);
const writer = createOpenAIWriter({ model: values.model ?? DEFAULT_MODEL });
console.error(`writer: ${writer.name}  テーマ: ${themeFile.title}（${themeFile.words.length}語）`);

let words = themeFile.words;
const problems = [];
for (const field of fields) {
  const todo = words.filter((w) => !w[field]).length;
  console.error(`${FIELDS[field].name}: ${todo}語`);
  const result = await addTexts({
    field,
    puzzle: { words },
    themeFiles: [themeFile],
    locale,
    writer,
    batchSize: Number(values.batch),
    // 1 回ぶん終わるたびに保存する（途中で止まっても、次は続きから）
    onBatch: async ({ index, total, words: done }) => {
      await saveThemeFile(values.locale, { ...themeFile, words: done });
      console.error(`  ${index + 1}/${total} 保存しました`);
    },
  });
  words = result.puzzle.words;
  problems.push(...result.problems);
  await saveThemeFile(values.locale, { ...themeFile, words });
}
const missing = words.filter((w) => fields.some((f) => !w[f]));
console.error(`完了。カギ ${words.filter((w) => w.clue).length}/${words.length}、解説 ${words.filter((w) => w.explanation).length}/${words.length}`);
if (problems.length) {
  console.error('つけられなかったもの:');
  for (const p of problems) console.error(`- ${FIELDS[p.field].name} ${p.display}（${p.answer}）: ${p.problem}「${p.text}」`);
}
if (missing.length) process.exitCode = 1;
