// テーマファイルからクロスワード（clue は null）を作る。ファイル操作はしない。

import { generate } from './layout/freeplace.js';
import { validatePuzzle } from './lib/validate.js';

// 命名ルール: <全体の通し番号 5桁>-<ジャンルの英名>-<ジャンル内の連番 3桁>（例: 00001-countries-001）
// ジャンルの英名はテーマ ID（小文字・数字、区切りはアンダースコア）。複数テーマを合わせたときは _ でつなぐ。
export const GENRE_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/;

export function genreOf(themeFiles) {
  const genre = themeFiles.map((f) => f.theme).join('_');
  if (!GENRE_PATTERN.test(genre)) throw new Error(`ジャンルの英名が命名ルールに合わない: ${genre}`);
  return genre;
}

export function puzzleId({ serial, genre, round }) {
  return `${String(serial).padStart(5, '0')}-${genre}-${String(round).padStart(3, '0')}`;
}

// 次の通し番号と、そのジャンルの次の連番。existing は既存のクロスワード（{ locale, genre, serial, round }）
export function nextNumbers(existing, { locale, genre }) {
  const same = existing.filter((p) => p.locale === locale);
  const serial = Math.max(0, ...same.map((p) => p.serial ?? 0)) + 1;
  const round = Math.max(0, ...same.filter((p) => p.genre === genre).map((p) => p.round ?? 0)) + 1;
  return { serial, round };
}

// date は作った日（記録用）。並び順や名前には使わない
export function buildPuzzle({ serial, round, date, locale, themeFiles, generalFile, layout = {}, seed }) {
  const genre = genreOf(themeFiles);
  const id = puzzleId({ serial, genre, round });
  const themeWords = themeFiles.flatMap((f) => f.words);
  const result = generate({
    themeWords,
    generalWords: generalFile?.words ?? [],
    seed: seed ?? `${id}-${locale}`,
    ...layout,
  });
  if (!result) throw new Error('盤面を組めなかった');
  const rows = result.grid.length;
  const cols = result.grid[0].length;
  const puzzle = {
    id,
    serial,
    genre,
    round,
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
