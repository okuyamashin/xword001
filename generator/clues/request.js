// AI への依頼内容を作る（標準形式）
//
// 単語ごとに文章を書かせる工程は「カギ（clue）」と「解説（explanation）」の2つ。
// どちらも依頼は次の3つでできている。
//   1. 言語ごとの標準の指示（locales/<locale>.js の clueDefaults / explanationDefaults）
//   2. テーマごとの指示（テーマファイルの clue / explanation の style と examples）
//   3. 単語の一覧
// テーマごとの違いはテーマファイルに書き、ここは変えない。

export const FIELDS = {
  clue: { name: 'カギ', defaults: 'clueDefaults' },
  explanation: { name: '解説', defaults: 'explanationDefaults' },
};

export const textSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          text: { type: 'string' },
        },
        required: ['id', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

// テーマファイルの設定と言語の標準設定を合わせる
export function resolveSettings(field, themeFile, locale) {
  const defaults = locale[FIELDS[field].defaults];
  const own = themeFile[field] ?? {};
  return {
    maxLength: own.maxLength ?? defaults.maxLength,
    instructions: defaults.instructions,
    style: own.style ?? '',
    examples: own.examples ?? [],
  };
}

/**
 * @param {object} args
 * @param {'clue'|'explanation'} args.field
 * @param {object} args.themeFile   テーマファイル
 * @param {object} args.locale      locales/<locale>.js
 * @param {{answer:string, display:string, note?:string, clue?:string}[]} args.words
 * @param {{answer:string, display:string, text:string, problem:string}[]} [args.retry] 前回だめだったもの
 */
export function buildRequest({ field, themeFile, locale, words, retry = [] }) {
  const { name } = FIELDS[field];
  const s = resolveSettings(field, themeFile, locale);
  // 今回の単語が手本に入っていると、手本をそのまま写されるので外す
  const asked = new Set(words.map((w) => `${w.answer}|${w.display}`));
  const examples = s.examples.filter((e) => !asked.has(`${e.answer}|${e.display}`));
  const system = [
    ...s.instructions,
    `1つの${name}は${s.maxLength}文字以内にする。`,
    `今回のテーマは「${themeFile.title}」。`,
    s.style && `このテーマの${name}の書き方: ${s.style}`,
    examples.length && `例:\n${examples.map((e) => `- ${e.display}（${e.answer}）→ ${e[field] ?? e.text}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');

  // 単語には番号を振り、番号と文章だけを返させる（表記と読みを返させると、取り違えることがあった）
  const lines = words.map((w, i) => {
    const note = w.note ? ` メモ: ${w.note}` : '';
    const clue = field === 'explanation' && w.clue ? ` カギ: ${w.clue}` : '';
    return `${i + 1}. ${w.display}（読み: ${w.answer}、${[...w.answer].length}文字）${note}${clue}`;
  });
  let prompt = `次の単語それぞれに${name}を1つずつ書いてください。id には単語の番号、text には${name}を入れて、全部の単語について返してください。\n${lines.join('\n')}`;
  if (retry.length) {
    prompt += `\n\n前回の${name}には次の問題がありました。直してください。\n${retry
      .map((r) => `- ${r.display}（${r.answer}）: 「${r.text}」→ ${r.problem}`)
      .join('\n')}`;
  }
  return { system, prompt, schema: textSchema, maxLength: s.maxLength };
}
