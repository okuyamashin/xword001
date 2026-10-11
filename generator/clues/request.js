// ヒント生成の依頼内容を作る（標準形式）
//
// どのテーマでも、依頼は次の3つでできている。
//   1. 言語ごとの標準の指示（locales/<locale>.js の clueDefaults）
//   2. テーマごとの指示（テーマファイルの clue.style と clue.examples）
//   3. ヒントをつける単語の一覧
// テーマごとの違いはテーマファイルの clue に書き、ここは変えない。

export const clueSchema = {
  type: 'object',
  properties: {
    clues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          answer: { type: 'string' },
          display: { type: 'string' },
          clue: { type: 'string' },
        },
        required: ['answer', 'display', 'clue'],
        additionalProperties: false,
      },
    },
  },
  required: ['clues'],
  additionalProperties: false,
};

// テーマファイルの clue と言語の標準設定を合わせる
export function resolveClueSettings(themeFile, locale) {
  const clue = themeFile.clue ?? {};
  return {
    maxLength: clue.maxLength ?? locale.clueDefaults.maxLength,
    instructions: locale.clueDefaults.instructions,
    style: clue.style ?? '',
    examples: clue.examples ?? [],
  };
}

/**
 * @param {object} args
 * @param {object} args.themeFile   テーマファイル（title, clue）
 * @param {object} args.locale      locales/<locale>.js
 * @param {{answer:string, display:string, note?:string}[]} args.words
 * @param {{answer:string, display:string, clue:string, problem:string}[]} [args.retry] 前回だめだったカギ
 */
export function buildClueRequest({ themeFile, locale, words, retry = [] }) {
  const s = resolveClueSettings(themeFile, locale);
  const system = [
    ...s.instructions,
    `1つのカギは${s.maxLength}文字以内にする。`,
    `今回のテーマは「${themeFile.title}」。`,
    s.style && `このテーマのカギの作り方: ${s.style}`,
    s.examples.length && `例:\n${s.examples.map((e) => `- ${e.display}（${e.answer}）→ ${e.clue}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const lines = words.map((w) => {
    const note = w.note ? ` メモ: ${w.note}` : '';
    return `- ${w.display}（${w.answer}、${[...w.answer].length}文字）${note}`;
  });
  let prompt = `次の単語それぞれにカギを1つずつ書いてください。answer と display は一覧のとおりに返してください。\n${lines.join('\n')}`;
  if (retry.length) {
    prompt += `\n\n前回のカギには次の問題がありました。直してください。\n${retry
      .map((r) => `- ${r.display}（${r.answer}）: 「${r.clue}」→ ${r.problem}`)
      .join('\n')}`;
  }
  return { system, prompt, schema: clueSchema, maxLength: s.maxLength };
}
