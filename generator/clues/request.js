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
          answer: { type: 'string' },
          display: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['answer', 'display', 'text'],
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

  const lines = words.map((w) => {
    const note = w.note ? ` メモ: ${w.note}` : '';
    const clue = field === 'explanation' && w.clue ? ` カギ: ${w.clue}` : '';
    return `- ${w.display}（${w.answer}、${[...w.answer].length}文字）${note}${clue}`;
  });
  let prompt = `次の単語それぞれに${name}を1つずつ書いて、text に入れてください。answer と display は一覧のとおりに返してください。\n${lines.join('\n')}`;
  if (retry.length) {
    prompt += `\n\n前回の${name}には次の問題がありました。直してください。\n${retry
      .map((r) => `- ${r.display}（${r.answer}）: 「${r.text}」→ ${r.problem}`)
      .join('\n')}`;
  }
  return { system, prompt, schema: textSchema, maxLength: s.maxLength };
}
