import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export type ClaudeCallOptions = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
};

/**
 * Claude Sonnet 4.6 호출. 후킹 멘트 생성 등 짧고 창의적인 텍스트 전용.
 * Vibe Video에서는 시나리오의 hook_line 생성에만 사용 (비용 통제).
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<{ text: string; modelUsed: string }> {
  const message = await client.messages.create({
    model: env.CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 100,
    temperature: opts.temperature ?? 0.9,
    system: opts.systemPrompt,
    messages: [{ role: 'user', content: opts.userPrompt }],
  });

  const block = message.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Claude response had no text block');
  }

  const text = block.text.trim();
  if (!text) {
    throw new Error('Claude returned empty text');
  }

  return { text, modelUsed: env.CLAUDE_MODEL };
}
