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

// 解説生成の標準設定（テーマファイルの explanation で上書きできる）
// 解説は、完成したとき・全部の答えを見たときに表示する
export const explanationDefaults = {
  maxLength: 120,
  instructions: [
    'クロスワードパズルを解き終えた人が読む、答えの言葉の短い解説を日本語で書く。',
    '2〜3文で、です・ます調で書く。',
    '「へえ」と思える豆知識を1つ入れる。カギと同じ内容をくり返さない。',
    '事実として確かなことだけを書く。自信がないことは書かない。',
  ],
};

// パズルの紹介文（テーマの説明）と、表紙の絵の題材の標準設定
export const introDefaults = {
  maxLength: 160,
  instructions: [
    'クロスワードパズルのページの冒頭に載せる、このパズルの紹介文を日本語で書く。',
    '2〜3文、です・ます調。テーマの面白さが伝わり、解いてみたくなる文にする。',
    'このパズルに入っている言葉を見て、その顔ぶれに合わせた内容にする。',
    'ただし答えの言葉そのもの（表記・読み）は書かない。',
    '事実として確かなことだけを書く。',
    'あわせて、ページの表紙にする正方形の絵の題材を英語で1〜2文書く（imageSubject）。',
    '題材は、テーマとこのパズルの言葉から思い浮かぶ情景や物にする。文字・地図上の国名・ラベルは描かせない。画風の指定は書かない（あとで付ける）。',
  ],
};

// 解説の欄で、テーマ外の「つなぎの言葉」につける印
export const fillerLabel = 'つなぎの言葉';

// カギに答えが漏れていないかを調べる
export function leaksAnswer(clue, word) {
  const text = normalize(clue);
  if (text.includes(word.answer)) return `答え「${word.answer}」が含まれている`;
  if (word.display && clue.includes(word.display)) return `答えの表記「${word.display}」が含まれている`;
  return null;
}
