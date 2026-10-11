// OpenAI API（Responses API）でカギ・解説・パズルの紹介文を書く。
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
    // JSON スキーマどおりのオブジェクトを返す
    async generate({ system, prompt, schema }) {
      // ストリーミングで受け取る。時間のかかる呼び出しでも途中の通信が途切れにくい
      // （応答をまとめて待つ方式では、プロキシ経由で 502 になることがあった）
      const stream = client.responses.stream({
        model,
        reasoning: { effort },
        instructions: system,
        input: prompt,
        text: { format: { type: 'json_schema', name: 'result', schema, strict: true } },
      });
      const response = await stream.finalResponse();
      if (response.status === 'incomplete') {
        throw new Error(`応答が途中で終わった: ${response.incomplete_details?.reason ?? '理由不明'}`);
      }
      const refusal = response.output
        ?.flatMap((item) => (item.type === 'message' ? item.content : []))
        .find((part) => part.type === 'refusal');
      if (refusal) throw new Error(`生成を断られた: ${refusal.refusal}`);
      if (!response.output_text) throw new Error('応答にテキストがない');
      return JSON.parse(response.output_text);
    },
    // 単語ごとの文章（カギ・解説）: [{ answer, display, text }]
    async write(request) {
      return (await this.generate(request)).items;
    },
  };
}
