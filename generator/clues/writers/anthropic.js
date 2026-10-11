// Claude API でカギを書く。ANTHROPIC_API_KEY などの認証情報が必要。

import Anthropic from '@anthropic-ai/sdk';

export function createAnthropicWriter({ model = 'claude-opus-5-5', effort = 'medium', client = new Anthropic() } = {}) {
  return {
    name: `anthropic:${model}`,
    async write({ system, prompt, schema }) {
      const response = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        // 安全分類で断られたときは、API 側で別のモデルに自動で切り替える
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort, format: { type: 'json_schema', schema } },
        system,
        messages: [{ role: 'user', content: prompt }],
      });
      if (response.stop_reason === 'refusal') {
        throw new Error(`カギの生成を断られた: ${response.stop_details?.category ?? '理由不明'}`);
      }
      if (response.stop_reason === 'max_tokens') throw new Error('出力が長すぎて途中で切れた');
      const text = response.content.find((b) => b.type === 'text')?.text;
      if (!text) throw new Error('応答にテキストがない');
      return JSON.parse(text).clues;
    },
  };
}
