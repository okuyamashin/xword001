// 文字種: かな（カタカナ）。答えのマスに入る文字のルール
// このファイルはブラウザでもそのまま動かす（パズルのページに埋め込む）。import を使わないこと。

const SMALL = Object.fromEntries(
  [...'ァィゥェォッャュョヮヵヶ'].map((c, i) => [c, 'アイウエオツヤユヨワカケ'[i]]),
);
const VU = [['ヴァ', 'バ'], ['ヴィ', 'ビ'], ['ヴェ', 'ベ'], ['ヴォ', 'ボ'], ['ヴ', 'ブ']];

export const script = 'kana';

// AI への依頼などで、answer を何と呼ぶか
export const answerLabel = '読み';

// つなぎの言葉に使う汎用リスト
export const fillerTheme = 'general';

export const inputPlaceholder = '答えを入力（ひらがな・カタカナ）';
export const inputHint = 'ひらがなかカタカナで入力してください。';

// 答えの書き方（ページの「答えの書き方」に出す）
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

// カギに答えが漏れていないかを調べる（ひらがな・小さい文字で書いてあっても見つける）
export function leaksAnswer(clue, word) {
  const text = normalize(clue);
  if (text.includes(word.answer)) return `答え「${word.answer}」が含まれている`;
  if (word.display && clue.includes(word.display)) return `答えの表記「${word.display}」が含まれている`;
  return null;
}

// 単語帳の見出し（五十音の行）
const GYOU = [
  ['ア', 'アイウエオ'], ['カ', 'カキクケコガギグゲゴ'], ['サ', 'サシスセソザジズゼゾ'], ['タ', 'タチツテトダヂヅデド'],
  ['ナ', 'ナニヌネノ'], ['ハ', 'ハヒフヘホバビブベボパピプペポ'], ['マ', 'マミムメモ'], ['ヤ', 'ヤユヨ'],
  ['ラ', 'ラリルレロ'], ['ワ', 'ワヲン'],
];
export const groups = GYOU.map(([g]) => g);
export function groupOf(answer) {
  return GYOU.find(([, chars]) => chars.includes(answer[0]))?.[0] ?? 'ワ';
}
export function groupTitle(group) {
  return `${group}行`;
}
