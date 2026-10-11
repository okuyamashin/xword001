// パズルの紹介文をつける
//
// テーマは作るときに指定したもの。紹介文は、このパズルに実際に入った答えを見て AI が書く。
// 答えを書かないよう指示するが、漏れても止めない（注意として返すだけ）。
// 絵はジャンル（テーマ）ごとに 1 枚で、テーマファイルの imagePrompt から作る（cli/theme-image.js）ので、ここでは扱わない。
// ファイル操作はしない。

export const introSchema = {
  type: 'object',
  properties: {
    description: { type: 'string' },
  },
  required: ['description'],
  additionalProperties: false,
};

export function buildIntroRequest({ puzzle, themeFiles, locale, retry }) {
  const d = locale.introDefaults;
  const main = themeFiles.filter((f) => puzzle.theme.split('+').includes(f.theme));
  const system = [
    ...d.instructions,
    `紹介文は${d.maxLength}文字以内にする。`,
    `テーマは「${puzzle.title}」。`,
    ...main.map((f) => f.description && `テーマの一般的な説明（参考）: ${f.description}`),
  ]
    .filter(Boolean)
    .join('\n');
  const words = puzzle.words.map((w) => `- ${w.display}（${w.answer}）${main.some((f) => f.theme === w.theme) ? '' : '［テーマ外のつなぎの言葉］'}`);
  let prompt = `このパズルに入っている言葉（答え）は次のとおりです。紹介文には書かないでください。\n${words.join('\n')}`;
  if (retry) prompt += `\n\n前回の紹介文には次の問題がありました。直してください。\n「${retry.description}」→ ${retry.problem}`;
  return { system, prompt, schema: introSchema, maxLength: d.maxLength };
}

export async function addIntro({ puzzle, themeFiles, locale, writer, maxRounds = 2 }) {
  if (puzzle.intro?.description) return { puzzle, warnings: [], problems: [] };
  let retry = null;
  for (let round = 1; round <= maxRounds; round++) {
    const request = buildIntroRequest({ puzzle, themeFiles, locale, retry });
    const result = await writer.generate(request);
    const description = result.description?.trim() ?? '';
    let problem = null;
    if (!description) problem = '紹介文が空';
    else if ([...description].length > request.maxLength) problem = `${request.maxLength}文字を超えている（${[...description].length}文字）`;
    if (problem) {
      retry = { description, problem };
      continue;
    }
    const warnings = puzzle.words.map((w) => locale.leaksAnswer(description, w)).filter(Boolean);
    const intro = { theme: puzzle.title, description };
    return { puzzle: { ...puzzle, intro }, warnings, problems: [] };
  }
  return { puzzle, warnings: [], problems: [retry] };
}
