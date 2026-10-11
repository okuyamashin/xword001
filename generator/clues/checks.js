// 自動チェック（標準）。問題があれば理由の文字列、なければ null を返す

function checkCommon(text, maxLength) {
  if (typeof text !== 'string' || !text.trim()) return '空になっている';
  if ([...text].length > maxLength) return `${maxLength}文字を超えている（${[...text].length}文字）`;
  return null;
}

export function checkClue({ word, text, maxLength, locale, others = [] }) {
  return (
    checkCommon(text, maxLength) ??
    locale.leaksAnswer(text, word) ??
    (others.includes(text) ? '別の単語と同じカギになっている' : null)
  );
}

// 解説は答えを見たあとに読むので、答えを含んでよい
export function checkExplanation({ text, maxLength }) {
  return checkCommon(text, maxLength);
}

export const CHECKS = { clue: checkClue, explanation: checkExplanation };
