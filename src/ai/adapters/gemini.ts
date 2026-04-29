// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Google Gemini 어댑터
//  API: https://generativelanguage.googleapis.com/v1beta
//  인증: API 키를 쿼리 파라미터 ?key= 로 전달
// ────────────────────────────────────────────────────────────────

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import type { AIProvider } from '../provider.js';
import type { ChatMessage, ChatOptions, ChatResponse, StreamChunk } from '../../types/ai.js';
import { getSecret } from '../../config/keychain.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-1.5-flash';
const SERVICE = 'valet-pilot';
const ACCOUNT = 'gemini-api-key';

// ── Gemini 요청/응답 타입 ────────────────────────────────────────

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
}

interface GeminiUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata: GeminiUsage;
  modelVersion: string;
}

// ── SSE 스트림 청크 타입 ─────────────────────────────────────────

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: GeminiUsage;
}

// ── 내부 변환 헬퍼 ────────────────────────────────────────────────

/**
 * ChatMessage 배열을 Gemini contents 형식으로 변환합니다.
 * - system 메시지는 첫 번째 user 메시지 앞에 텍스트로 prepend합니다.
 * - Gemini는 user/model 역할만 허용합니다.
 */
function toGeminiContents(messages: ChatMessage[]): {
  systemInstruction?: { parts: GeminiPart[] };
  contents: GeminiContent[];
} {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const rest = messages.filter((m) => m.role !== 'system');

  const contents: GeminiContent[] = rest.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  return {
    systemInstruction:
      systemParts.length > 0
        ? { parts: [{ text: systemParts.join('\n') }] }
        : undefined,
    contents,
  };
}

// ────────────────────────────────────────────────────────────────

export class GeminiAdapter implements AIProvider {
  private model: string;

  constructor(model = DEFAULT_MODEL) {
    this.model = model;
  }

  private async getApiKey(): Promise<string> {
    const key = await getSecret(SERVICE, ACCOUNT);
    if (!key) throw new Error('Gemini API 키가 Keychain에 없습니다 (account: gemini-api-key)');
    return key;
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const apiKey = await this.getApiKey();
    const { systemInstruction, contents } = toGeminiContents(options.messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    };
    if (systemInstruction) body['systemInstruction'] = systemInstruction;

    const res: AxiosResponse<GeminiResponse> = await axios.post(
      `${BASE_URL}/models/${this.model}:generateContent`,
      body,
      {
        params: { key: apiKey },
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const text = res.data.candidates[0]?.content.parts.map((p) => p.text).join('') ?? '';
    return {
      content: text,
      model: res.data.modelVersion ?? this.model,
      usage: {
        promptTokens: res.data.usageMetadata.promptTokenCount,
        completionTokens: res.data.usageMetadata.candidatesTokenCount,
      },
    };
  }

  async *stream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    const apiKey = await this.getApiKey();
    const { systemInstruction, contents } = toGeminiContents(options.messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    };
    if (systemInstruction) body['systemInstruction'] = systemInstruction;

    const res = await axios.post(
      `${BASE_URL}/models/${this.model}:streamGenerateContent`,
      body,
      {
        params: { key: apiKey, alt: 'sse' },
        headers: { 'Content-Type': 'application/json' },
        responseType: 'stream',
      },
    );

    let buffer = '';

    for await (const chunk of res.data as NodeJS.ReadableStream) {
      buffer += (chunk as Buffer).toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        try {
          const parsed = JSON.parse(data) as GeminiStreamChunk;
          const candidate = parsed.candidates?.[0];
          const text = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';
          const done = candidate?.finishReason === 'STOP';
          yield { delta: text, done };
          if (done) return;
        } catch {
          // 파싱 실패 줄 무시
        }
      }
    }

    yield { delta: '', done: true };
  }
}
