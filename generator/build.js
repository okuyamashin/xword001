// テーマファイルからクロスワード（clue は null）を作る。ファイル操作はしない。

import { generate } from './layout/freeplace.js';
import { validatePuzzle } from './lib/validate.js';

export function buildPuzzle({ date, locale, themeFiles, generalFile, layout = {} }) {
  const themeWords = themeFiles.flatMap((f) => f.words);
  const result = generate({
    themeWords,
    generalWords: generalFile?.words ?? [],
    seed: `${date}-${locale}-${themeFiles.map((f) => f.theme).join('+')}`,
    ...layout,
  });
  if (!result) throw new Error('盤面を組めなかった');
  const rows = result.grid.length;
  const cols = result.grid[0].length;
  const puzzle = {
    id: `${date}-${locale}`,
    date,
    locale,
    theme: themeFiles.map((f) => f.theme).join('+'),
    title: themeFiles.map((f) => f.title).join('・'),
    subtitle: themeFiles.map((f) => f.subtitle).filter(Boolean).join(' & '),
    description: themeFiles.map((f) => f.description).filter(Boolean).join(' '),
    image: themeFiles.find((f) => f.image)?.image ?? null,
    design: Object.assign({}, ...themeFiles.map((f) => f.design ?? {})),
    rules: themeFiles.flatMap((f) => f.rules ?? []),
    size: { rows, cols },
    grid: result.grid,
    words: result.words,
  };
  const errors = validatePuzzle(puzzle);
  if (errors.length) throw new Error(`検証エラー:\n${errors.join('\n')}`);
  return { puzzle, stats: result.stats };
}
