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

// ヒント生成の標準設定（テーマファイルの clue で上書きできる）
export const clueDefaults = {
  maxLength: 40,
  instructions: [
    'クロスワードパズルのカギ（ヒント）を日本語で書く。',
    '1つのカギは短い1〜2文で書く。です・ます調にしない（「〜の国」「〜するもの」のような体言止めか常体）。',
    '答えの言葉そのもの、答えの漢字、答えの一部をカギに含めない。',
    'カギだけを読んで、答えが1つに絞れるようにする。',
    '事実として確かなことだけを書く。自信がないことは書かない。',
  ],
};

// カギに答えが漏れていないかを調べる
export function leaksAnswer(clue, word) {
  const text = normalize(clue);
  if (text.includes(word.answer)) return `カギに答え「${word.answer}」が含まれている`;
  if (word.display && clue.includes(word.display)) return `カギに表記「${word.display}」が含まれている`;
  return null;
}
