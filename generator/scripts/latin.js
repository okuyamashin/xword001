// 文字種: アルファベット（英字の大文字 A〜Z）。答えのマスに入る文字のルール
// このファイルはブラウザでもそのまま動かす（パズルのページに埋め込む）。import を使わないこと。

export const script = 'latin';

// AI への依頼などで、answer を何と呼ぶか
export const answerLabel = 'つづり';

// つなぎの言葉に使う汎用リスト（なければ、つなぎの言葉は使わない）
export const fillerTheme = 'general_latin';

export const inputPlaceholder = '答えを入力（英字）';
export const inputHint = 'アルファベットで入力してください。';

// 答えの書き方（ページの「答えの書き方」に出す）
export const rules = [
  '答えはアルファベットの大文字で、1マスに1文字入ります（小文字で入力してもかまいません）',
  '記号・数字・空白は入りません（例: ice cream → ICECREAM）',
];

// 入力やリストの文字列を、マスに入る形にそろえる（全角は半角に、小文字は大文字に、英字以外は取り除く）
export function normalize(text) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // é → e のようにアクセント記号を外す
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export function isValidAnswer(answer) {
  return /^[A-Z]+$/.test(answer);
}

// カギに答えが漏れていないかを調べる。英文の一部（GO と GOOGLE など）を誤検知しないよう、単語ごとに比べる
export function leaksAnswer(clue, word) {
  const tokens = clue.normalize('NFKC').toUpperCase().split(/[^A-Z]+/);
  if (tokens.includes(word.answer)) return `答え「${word.answer}」が含まれている`;
  // 記号を含む表記（C#、C++、PL/SQL など）は、そのままの形で探す
  if (word.display && /[^A-Za-z]/.test(word.display) && clue.toUpperCase().includes(word.display.toUpperCase())) {
    return `答えの表記「${word.display}」が含まれている`;
  }
  return null;
}

// 単語帳の見出し（頭文字）
export const groups = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
export function groupOf(answer) {
  return answer[0];
}
export function groupTitle(group) {
  return group;
}
