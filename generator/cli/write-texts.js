// クロスワードに、カギ（clue）・解説（explanation）・紹介文と画像プロンプト（intro）をつける。
// まだ空のものだけを埋める。
// 使い方:
//   node generator/cli/write-texts.js --puzzle puzzles/00001-countries-001.json                       # カギ → 解説 → 紹介文の順に OpenAI で書く
//   node generator/cli/write-texts.js --puzzle puzzles/00001-countries-001.json --only intro          # 紹介文と画像プロンプトだけ
//   node generator/cli/write-texts.js --puzzle puzzles/00001-countries-001.json --only explanation    # 解説だけ
//   node generator/cli/write-texts.js --puzzle puzzles/00001-countries-001.json --drafts texts.json   # 用意した文章を使う
// どれも同じ自動チェックを通し、通ったものを同じファイルに書き込む。

import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { addTexts } from '../clues/index.js';
import { addIntro } from '../clues/intro.js';
import { FIELDS } from '../clues/request.js';
import { loadThemeFile, ROOT } from '../lib/words.js';
import path from 'node:path';

const { values } = parseArgs({
  options: {
    puzzle: { type: 'string' },
    only: { type: 'string' },
    drafts: { type: 'string' },
    model: { type: 'string' },
  },
});
if (!values.puzzle) throw new Error('--puzzle を指定してください');
const STEPS = [...Object.keys(FIELDS), 'intro'];
const steps = values.only ? [values.only] : STEPS;
for (const f of steps) if (!STEPS.includes(f)) throw new Error(`--only は ${STEPS.join(' / ')} のどれか`);
const fields = steps.filter((f) => FIELDS[f]);

let puzzle = JSON.parse(await readFile(values.puzzle, 'utf8'));
const locale = await import(`../locales/${puzzle.locale}.js`);
const themes = [...new Set(puzzle.words.map((w) => w.theme))];
const themeFiles = await Promise.all(themes.map((t) => loadThemeFile(puzzle.locale, t)));
const site = JSON.parse(await readFile(path.join(ROOT, 'data/site', `${puzzle.locale}.json`), 'utf8'));

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
if (steps.includes('intro')) {
  const result = await addIntro({ puzzle, themeFiles, locale, site, writer });
  puzzle = result.puzzle;
  await writeFile(values.puzzle, `${JSON.stringify(puzzle, null, 2)}\n`);
  console.error(`紹介文: ${puzzle.intro?.description ?? '（なし）'}`);
  console.error(`画像プロンプト: ${puzzle.intro?.imagePrompt ?? '（なし）'}`);
  for (const w of result.warnings) console.error(`注意（紹介文）: ${w}`);
  for (const p of result.problems) problems.push({ ...p, field: 'intro', display: '紹介文', answer: '-', text: p.description });
}
for (const w of puzzle.words) {
  console.error(`${w.number}${w.direction === 'across' ? 'ヨコ' : 'タテ'} ${w.display}（${w.answer}）`);
  for (const f of fields) console.error(`  ${FIELDS[f].name}: ${w[f] ?? '（なし）'}`);
}
if (problems.length) {
  console.error('\nつけられなかったもの:');
  for (const p of problems) console.error(`- ${FIELDS[p.field]?.name ?? '紹介文'} ${p.display}（${p.answer}）: ${p.problem}「${p.text}」`);
  process.exitCode = 1;
}
