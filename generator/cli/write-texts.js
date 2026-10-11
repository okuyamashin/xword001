// クロスワードの単語に、カギ（clue）と解説（explanation）をつける。まだ空のものだけを埋める。
// 使い方:
//   node generator/cli/write-texts.js --puzzle puzzles/2026-10-12-ja.json                       # カギ → 解説の順に OpenAI で書く
//   node generator/cli/write-texts.js --puzzle puzzles/2026-10-12-ja.json --only explanation    # 解説だけ
//   node generator/cli/write-texts.js --puzzle puzzles/2026-10-12-ja.json --drafts texts.json   # 用意した文章を使う
// どれも同じ自動チェックを通し、通ったものを同じファイルに書き込む。

import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { addTexts } from '../clues/index.js';
import { FIELDS } from '../clues/request.js';
import { loadThemeFile } from '../lib/words.js';

const { values } = parseArgs({
  options: {
    puzzle: { type: 'string' },
    only: { type: 'string' },
    drafts: { type: 'string' },
    model: { type: 'string' },
  },
});
if (!values.puzzle) throw new Error('--puzzle を指定してください');
const fields = values.only ? [values.only] : ['clue', 'explanation'];
for (const f of fields) if (!FIELDS[f]) throw new Error(`--only は ${Object.keys(FIELDS).join(' / ')} のどれか`);

let puzzle = JSON.parse(await readFile(values.puzzle, 'utf8'));
const locale = await import(`../locales/${puzzle.locale}.js`);
const themes = [...new Set(puzzle.words.map((w) => w.theme))];
const themeFiles = await Promise.all(themes.map((t) => loadThemeFile(puzzle.locale, t)));

let writer;
if (values.drafts) {
  const { createFileWriter } = await import('../clues/writers/file.js');
  writer = createFileWriter(JSON.parse(await readFile(values.drafts, 'utf8')));
} else {
  const { createOpenAIWriter, DEFAULT_MODEL } = await import('../clues/writers/openai.js');
  writer = createOpenAIWriter({ model: values.model ?? DEFAULT_MODEL });
}
console.error(`writer: ${writer.name}`);

const problems = [];
for (const field of fields) {
  const result = await addTexts({ field, puzzle, themeFiles, locale, writer });
  puzzle = result.puzzle;
  problems.push(...result.problems);
  await writeFile(values.puzzle, `${JSON.stringify(puzzle, null, 2)}\n`);
}
for (const w of puzzle.words) {
  console.error(`${w.number}${w.direction === 'across' ? 'ヨコ' : 'タテ'} ${w.display}（${w.answer}）`);
  for (const f of fields) console.error(`  ${FIELDS[f].name}: ${w[f] ?? '（なし）'}`);
}
if (problems.length) {
  console.error('\nつけられなかったもの:');
  for (const p of problems) console.error(`- ${FIELDS[p.field].name} ${p.display}（${p.answer}）: ${p.problem}「${p.text}」`);
  process.exitCode = 1;
}
