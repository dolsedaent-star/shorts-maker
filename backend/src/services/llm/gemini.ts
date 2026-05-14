import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export type GeminiCallOptions = {
  model?: 'pro' | 'flash';
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  responseSchema?: object;
  /** 이미지 첨부 (image-to-video 프롬프트 생성 등 비전 입력) */
  imageInput?: { mimeType: string; base64Data: string };
};

/**
 * Gemini 호출 래퍼. JSON 스키마 기반 구조화 출력 + 비전 입력 지원.
 * 반환값: { text: 응답 문자열, modelUsed: 실제 호출된 모델 ID }
 */
export async function callGemini(opts: GeminiCallOptions): Promise<{ text: string; modelUsed: string }> {
  const modelId = opts.model === 'flash' ? env.GEMINI_MODEL_FLASH : env.GEMINI_MODEL_PRO;

  const config: Record<string, unknown> = {
    systemInstruction: opts.systemInstruction,
    temperature: opts.temperature ?? 0.8,
  };

  if (opts.responseSchema) {
    config.responseMimeType = 'application/json';
    config.responseSchema = opts.responseSchema;
  }

  // 비전 입력이 있으면 multi-part 구조로 보냄
  const contents = opts.imageInput
    ? [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: opts.imageInput.mimeType, data: opts.imageInput.base64Data } },
            { text: opts.userPrompt },
          ],
        },
      ]
    : opts.userPrompt;

  const response = await callWithRetry(() =>
    ai.models.generateContent({ model: modelId, contents, config })
  );

  const text = response.text;
  if (!text) {
    throw new Error(`Gemini returned empty response (model=${modelId})`);
  }

  return { text, modelUsed: modelId };
}

/**
 * 일시적 에러(503/429) 자동 재시도. 지수 백오프 (2s → 4s → 8s).
 * 영구 에러(quota limit: 0, 인증 실패 등)는 즉시 throw.
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message || '';
      const isTransient503 = msg.includes('503') || msg.includes('UNAVAILABLE');
      const isRetryable429 =
        (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) && !msg.includes('limit: 0');
      const retryable = isTransient503 || isRetryable429;

      if (!retryable || attempt === maxRetries) throw err;

      const delayMs = 2000 * Math.pow(2, attempt);
      console.warn(
        `[gemini] retry ${attempt + 1}/${maxRetries} in ${delayMs}ms — ${msg.slice(0, 120)}`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

/**
 * JSON 응답 파싱 + 검증 헬퍼.
 */
export function parseJsonResponse<T = unknown>(text: string): T {
  // Gemini가 가끔 ```json ... ``` 으로 감싸서 반환 → 정리
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(`Failed to parse Gemini JSON response: ${(err as Error).message}\nRaw: ${cleaned.slice(0, 500)}`);
  }
}
