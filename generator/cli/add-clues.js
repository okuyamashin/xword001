// 使い方:
//   node generator/cli/add-clues.js --puzzle puzzles/2026-10-12-ja.json                     # Claude API で書く
//   node generator/cli/add-clues.js --puzzle puzzles/2026-10-12-ja.json --drafts clues.json # 用意したカギを使う
// どちらも同じ自動チェックを通し、通ったカギを同じファイルに書き込む。

import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { addClues } from '../clues/index.js';
import { loadThemeFile } from '../lib/words.js';

const { values } = parseArgs({
  options: {
    puzzle: { type: 'string' },
    drafts: { type: 'string' },
    model: { type: 'string', default: 'claude-opus-5-5' },
  },
});
if (!values.puzzle) throw new Error('--puzzle を指定してください');

const puzzle = JSON.parse(await readFile(values.puzzle, 'utf8'));
const locale = await import(`../locales/${puzzle.locale}.js`);
const themes = [...new Set(puzzle.words.map((w) => w.theme))];
const themeFiles = await Promise.all(themes.map((t) => loadThemeFile(puzzle.locale, t)));

let writer;
if (values.drafts) {
  const { createFileWriter } = await import('../clues/writers/file.js');
  writer = createFileWriter(JSON.parse(await readFile(values.drafts, 'utf8')));
} else {
  const { createAnthropicWriter } = await import('../clues/writers/anthropic.js');
  writer = createAnthropicWriter({ model: values.model });
}

const result = await addClues({ puzzle, themeFiles, locale, writer });
await writeFile(values.puzzle, `${JSON.stringify(result.puzzle, null, 2)}\n`);
for (const w of result.puzzle.words) {
  console.error(`${w.number}${w.direction === 'across' ? 'ヨコ' : 'タテ'} ${w.display}（${w.answer}）: ${w.clue ?? '（なし）'}`);
}
if (result.problems.length) {
  console.error('\nカギをつけられなかった単語:');
  for (const p of result.problems) console.error(`- ${p.display}（${p.answer}）: ${p.problem}「${p.clue}」`);
  process.exitCode = 1;
}
