// カギの自動チェック（標準）。問題があれば理由の文字列、なければ null を返す

export function checkClue({ word, clue, maxLength, locale, otherClues = [] }) {
  if (typeof clue !== 'string' || !clue.trim()) return 'カギが空';
  if ([...clue].length > maxLength) return `${maxLength}文字を超えている（${[...clue].length}文字）`;
  const leak = locale.leaksAnswer(clue, word);
  if (leak) return leak;
  if (otherClues.includes(clue)) return '別の単語と同じカギになっている';
  return null;
}
