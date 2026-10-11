// OpenAI API（Responses API）でカギを書く。
// 認証: 環境変数 OPENAI_API_KEY。クラウド環境のネットワークシークレットで
// api.openai.com にキーが付く場合は、未設定でもよい（仮の値で送り、プロキシが本物を付ける）。

import OpenAI from 'openai';

export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.5';

export function createOpenAIWriter({
  model = DEFAULT_MODEL,
  effort = 'medium',
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'injected-by-proxy' }),
} = {}) {
  return {
    name: `openai:${model}`,
    async write({ system, prompt, schema }) {
      const response = await client.responses.create({
        model,
        reasoning: { effort },
        instructions: system,
        input: prompt,
        text: { format: { type: 'json_schema', name: 'clues', schema, strict: true } },
      });
      if (response.status === 'incomplete') {
        throw new Error(`応答が途中で終わった: ${response.incomplete_details?.reason ?? '理由不明'}`);
      }
      const refusal = response.output
        ?.flatMap((item) => (item.type === 'message' ? item.content : []))
        .find((part) => part.type === 'refusal');
      if (refusal) throw new Error(`カギの生成を断られた: ${refusal.refusal}`);
      if (!response.output_text) throw new Error('応答にテキストがない');
      return JSON.parse(response.output_text).clues;
    },
  };
}
