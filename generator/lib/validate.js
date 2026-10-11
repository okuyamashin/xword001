// クロスワードの検証。問題があればメッセージの配列を返す（空なら OK）

export function validatePuzzle(puzzle) {
  const errors = [];
  const { grid, words } = puzzle;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cells = grid.map((row) => [...row]);
  if (cells.some((row) => row.length !== cols)) errors.push('grid の行の長さがそろっていない');

  // words の各語が grid と一致するか
  const key = (d, r, c) => `${d},${r},${c}`;
  const wordAt = new Map();
  for (const w of words) {
    const [dr, dc] = w.direction === 'across' ? [0, 1] : [1, 0];
    const got = [...w.answer].map((_, i) => cells[w.row + dr * i]?.[w.col + dc * i]).join('');
    if (got !== w.answer) errors.push(`${w.number}${w.direction}: grid は ${got}、answer は ${w.answer}`);
    wordAt.set(key(w.direction, w.row, w.col), w);
  }

  // grid にある2文字以上の並びが、すべて words にあるか
  const runs = [];
  for (const [dir, dr, dc] of [['across', 0, 1], ['down', 1, 0]]) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const filled = (rr, cc) => cells[rr]?.[cc] && cells[rr][cc] !== '#';
        if (!filled(r, c) || filled(r - dr, c - dc)) continue;
        let len = 0;
        while (filled(r + dr * len, c + dc * len)) len++;
        if (len >= 2) runs.push({ dir, r, c, len });
      }
    }
  }
  for (const run of runs) {
    const w = wordAt.get(key(run.dir, run.r, run.c));
    if (!w || w.answer.length !== run.len) errors.push(`(${run.r},${run.c}) ${run.dir} の並びが単語になっていない`);
  }
  if (runs.length !== words.length) errors.push(`並びの数 ${runs.length} と単語の数 ${words.length} が違う`);

  // すべての文字がつながっているか
  const start = cells.flatMap((row, r) => row.map((ch, c) => (ch !== '#' ? [r, c] : null))).find(Boolean);
  if (start) {
    const seen = new Set([start.join()]);
    const stack = [start];
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
        if (cells[nr]?.[nc] && cells[nr][nc] !== '#' && !seen.has(`${nr},${nc}`)) {
          seen.add(`${nr},${nc}`);
          stack.push([nr, nc]);
        }
      }
    }
    const total = cells.flat().filter((ch) => ch !== '#').length;
    if (seen.size !== total) errors.push('盤面が分断されている');
  }

  // 同じ答えが2回出ていないか
  const answers = words.map((w) => w.answer);
  if (new Set(answers).size !== answers.length) errors.push('同じ答えが重複している');
  return errors;
}
