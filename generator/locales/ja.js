// 日本語の文字ルール（全体のルール）

const SMALL = Object.fromEntries(
  [...'ァィゥェォッャュョヮヵヶ'].map((c, i) => [c, 'アイウエオツヤユヨワカケ'[i]]),
);
const VU = [['ヴァ', 'バ'], ['ヴィ', 'ビ'], ['ヴェ', 'ベ'], ['ヴォ', 'ボ'], ['ヴ', 'ブ']];

export const locale = 'ja';

export const labels = { across: 'ヨコ', down: 'タテ' };

export const rules = [
  '答えはカタカナで、1マスに1文字入ります（ひらがなで入力してもかまいません）',
  '小さい文字は大きい文字で入れます（例: シャツ → シヤツ）',
  '濁点・半濁点のついた文字は1文字です（例: ガ は1マス）',
  '「ヴ」は使わず、バ行で表します（例: ヴァイオリン → バイオリン）',
  '長音「ー」は1文字です',
];

// 入力やリストの文字列を、マスに入る形にそろえる
export function normalize(text) {
  let s = [...text.normalize('NFKC')]
    .map((c) => (c >= 'ぁ' && c <= 'ゖ' ? String.fromCodePoint(c.codePointAt(0) + 0x60) : c))
    .join('');
  for (const [from, to] of VU) s = s.replaceAll(from, to);
  s = [...s].map((c) => SMALL[c] ?? c).join('');
  return s.replace(/[・\s]/g, '');
}

export function isValidAnswer(answer) {
  return /^[ア-ンー]+$/.test(answer) && !/[ァィゥェォッャュョヮヵヶヴ]/.test(answer);
}
