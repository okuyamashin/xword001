// 自由配置型（スケルトン）の盤面生成
//
// テーマの単語を優先して交差させながら置いていき、置けないときだけ
// 汎用リストから最大 maxGeneral 語を補う。何度か試して最も良い盤面を返す。
// ファイル操作はしない（Lambda などからそのまま呼べるようにするため）。

import { createRng, shuffle } from '../lib/rng.js';

const DIRS = {
  across: { dr: 0, dc: 1, bit: 1 },
  down: { dr: 1, dc: 0, bit: 2 },
};

/**
 * @param {object} options
 * @param {{answer:string, display:string, level?:number, weight?:number, theme:string}[]} options.themeWords
 * @param {{answer:string, display:string, level?:number, weight?:number, theme:string}[]} [options.generalWords]
 * @param {number} [options.rows]
 * @param {number} [options.cols]
 * @param {number} [options.maxWords]    置く語数の上限
 * @param {number} [options.maxGeneral]  汎用リストから使う語数の上限
 * @param {number} [options.maxLevel]    使う単語の難易度の上限
 * @param {number} [options.attempts]    試行回数
 * @param {string|number} [options.seed]
 * @returns {{grid:string[], words:object[], stats:object} | null}
 */
export function generate({
  themeWords,
  generalWords = [],
  rows = 9,
  cols = 9,
  maxWords = 20,
  maxGeneral = 2,
  maxLevel = 3,
  attempts = 300,
  seed = 0,
}) {
  const rng = createRng(seed);
  const maxLen = Math.max(rows, cols);
  const usable = (w) => w.answer.length >= 2 && w.answer.length <= maxLen && (w.level ?? 1) <= maxLevel;
  const theme = themeWords.filter(usable);
  const general = generalWords.filter(usable);

  let best = null;
  for (let i = 0; i < attempts; i++) {
    const result = attempt({ theme, general, rows, cols, maxWords, maxGeneral, rng });
    if (result && (!best || result.score > best.score)) best = result;
  }
  if (!best) return null;
  return finalize(best, rows, cols);
}

function attempt({ theme, general, rows, cols, maxWords, maxGeneral, rng }) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  // マスごとに、通っている単語の向き（across=1, down=2 のビット）
  const mask = Array.from({ length: rows }, () => Array(cols).fill(0));
  const placed = [];
  const usedAnswers = new Set();
  let generalCount = 0;

  // 1語目: テーマから長めの語を選び、中央付近に置く
  const firstPool = shuffle(theme, rng).filter((w) => w.answer.length >= 4);
  const first = firstPool.find((w) => rng() < (w.weight ?? 1));
  if (!first) return null;
  const dir = rng() < 0.5 ? 'across' : 'down';
  const len = first.answer.length;
  const r0 = dir === 'across' ? Math.floor(rows / 2) : Math.floor((rows - len) / 2);
  const c0 = dir === 'across' ? Math.floor((cols - len) / 2) : Math.floor(cols / 2);
  if (!canPlace(grid, mask, first.answer, r0, c0, dir, true)) return null;
  put(grid, mask, placed, usedAnswers, first, r0, c0, dir);

  while (placed.length < maxWords) {
    let choice = pickPlacement(grid, mask, theme, usedAnswers, rng);
    let fromGeneral = false;
    if (!choice && generalCount < maxGeneral) {
      choice = pickPlacement(grid, mask, general, usedAnswers, rng);
      fromGeneral = true;
    }
    if (!choice) break;
    put(grid, mask, placed, usedAnswers, choice.word, choice.r, choice.c, choice.dir);
    if (fromGeneral) generalCount++;
  }

  const filled = grid.flat().filter(Boolean).length;
  const crossings = countCrossings(grid, placed);
  const themeCount = placed.length - generalCount;
  const score = themeCount * 10 + crossings * 3 + filled * 0.5 - generalCount * 5;
  return { grid, placed, score, stats: { words: placed.length, themeCount, generalCount, crossings, filled } };
}

// 盤面にある文字と交差できる置き方を探し、良いものを1つ選ぶ
function pickPlacement(grid, mask, pool, usedAnswers, rng) {
  const rows = grid.length;
  const cols = grid[0].length;
  const byLetter = new Map();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      if (!ch) continue;
      if (!byLetter.has(ch)) byLetter.set(ch, []);
      byLetter.get(ch).push([r, c]);
    }
  }

  let best = null;
  for (const word of pool) {
    if (usedAnswers.has(word.answer)) continue;
    const weight = word.weight ?? 1;
    const seen = new Set();
    [...word.answer].forEach((ch, i) => {
      for (const [r, c] of byLetter.get(ch) ?? []) {
        for (const dir of ['across', 'down']) {
          const { dr, dc } = DIRS[dir];
          const sr = r - dr * i;
          const sc = c - dc * i;
          const key = `${sr},${sc},${dir}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const crossings = canPlace(grid, mask, word.answer, sr, sc, dir, false);
          if (!crossings) continue;
          const score = (crossings * 2 + word.answer.length * 0.3) * weight * (0.5 + rng());
          if (!best || score > best.score) best = { word, r: sr, c: sc, dir, score };
        }
      }
    });
  }
  return best;
}

// 置けるなら交差数（1語目は 1）を、置けないなら 0 を返す
function canPlace(grid, mask, answer, r, c, dir, isFirst) {
  const rows = grid.length;
  const cols = grid[0].length;
  const { dr, dc } = DIRS[dir];
  const len = answer.length;
  const endR = r + dr * (len - 1);
  const endC = c + dc * (len - 1);
  if (r < 0 || c < 0 || endR >= rows || endC >= cols) return 0;

  // 単語の前後は空いていること（別の単語とつながらないように）
  const at = (rr, cc) => (rr >= 0 && cc >= 0 && rr < rows && cc < cols ? grid[rr][cc] : null);
  if (at(r - dr, c - dc) || at(endR + dr, endC + dc)) return 0;

  let crossings = 0;
  for (let i = 0; i < len; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const cell = grid[rr][cc];
    if (cell) {
      if (cell !== answer[i]) return 0;
      if (mask[rr][cc] & DIRS[dir].bit) return 0; // 同じ向きの単語とは重ねない
      crossings++;
    } else {
      // 新しく置くマスの両脇が埋まっていると、意図しない並びができる
      if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) return 0;
    }
  }
  if (crossings === len) return 0; // すべて既存の文字の上（新しいマスがない）
  if (isFirst) return 1;
  return crossings;
}

function put(grid, mask, placed, usedAnswers, word, r, c, dir) {
  const { dr, dc, bit } = DIRS[dir];
  [...word.answer].forEach((ch, i) => {
    grid[r + dr * i][c + dc * i] = ch;
    mask[r + dr * i][c + dc * i] |= bit;
  });
  placed.push({ word, r, c, dir });
  usedAnswers.add(word.answer);
}

function countCrossings(grid, placed) {
  const count = new Map();
  for (const { word, r, c, dir } of placed) {
    const { dr, dc } = DIRS[dir];
    for (let i = 0; i < word.answer.length; i++) {
      const key = `${r + dr * i},${c + dc * i}`;
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  return [...count.values()].filter((n) => n > 1).length;
}

// カギ番号を振り、出力の形にする
function finalize({ grid, placed, stats }, rows, cols) {
  const starts = new Map();
  for (const p of placed) starts.set(`${p.r},${p.c}`, true);
  const numbers = new Map();
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (starts.has(`${r},${c}`)) numbers.set(`${r},${c}`, ++n);
    }
  }
  const words = placed
    .map(({ word, r, c, dir }) => ({
      number: numbers.get(`${r},${c}`),
      direction: dir,
      row: r,
      col: c,
      answer: word.answer,
      display: word.display,
      theme: word.theme,
      clue: word.clue ?? null,
      explanation: word.explanation ?? null,
    }))
    .sort((a, b) => (a.direction === b.direction ? a.number - b.number : a.direction === 'across' ? -1 : 1));
  return {
    grid: grid.map((row) => row.map((ch) => ch ?? '#').join('')),
    words,
    stats,
  };
}
