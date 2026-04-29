// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Kimi (Moonshot AI) 어댑터
//  API: https://api.moonshot.ai/v1  (OpenAI 호환)
//  인증: Authorization: Bearer <token>
// ────────────────────────────────────────────────────────────────

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import type { AIProvider } from '../provider.js';
import type { ChatOptions, ChatResponse, StreamChunk } from '../../types/ai.js';
import { getSecret } from '../../config/keychain.js';

const BASE_URL = 'https://api.moonshot.ai/v1';
const DEFAULT_MODEL = 'moonshot-v1-8k';
const SERVICE = 'valet-pilot';
const ACCOUNT = 'kimi-api-key';

// ── OpenAI-호환 응답 타입 ────────────────────────────────────────

interface OAIChoice {
  message: { role: string; content: string };
  finish_reason: string;
}

interface OAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

interface OAIResponse {
  id: string;
  model: string;
  choices: OAIChoice[];
  usage: OAIUsage;
}

interface OAIStreamDelta {
  choices: Array<{ delta: { content?: string }; finish_reason: string | null }>;
}

// ────────────────────────────────────────────────────────────────

export class KimiAdapter implements AIProvider {
  private model: string;

  constructor(model = DEFAULT_MODEL) {
    this.model = model;
  }

  private async getApiKey(): Promise<string> {
    const key = await getSecret(SERVICE, ACCOUNT);
    if (!key) throw new Error('Kimi API 키가 Keychain에 없습니다 (account: kimi-api-key)');
    return key;
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const apiKey = await this.getApiKey();

    const res: AxiosResponse<OAIResponse> = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: this.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const choice = res.data.choices[0];
    return {
      content: choice.message.content,
      model: res.data.model,
      usage: {
        promptTokens: res.data.usage.prompt_tokens,
        completionTokens: res.data.usage.completion_tokens,
      },
    };
  }

  async *stream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    const apiKey = await this.getApiKey();

    const res = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: this.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
      },
    );

    yield* parseSSEStream(res.data as NodeJS.ReadableStream);
  }
}

// ── SSE 파싱 헬퍼 ────────────────────────────────────────────────

async function* parseSSEStream(stream: NodeJS.ReadableStream): AsyncGenerator<StreamChunk> {
  let buffer = '';

  for await (const chunk of stream) {
    buffer += (chunk as Buffer).toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') {
        yield { delta: '', done: true };
        return;
      }

      try {
        const parsed = JSON.parse(data) as OAIStreamDelta;
        const delta = parsed.choices[0]?.delta?.content ?? '';
        const finishReason = parsed.choices[0]?.finish_reason;
        yield { delta, done: finishReason === 'stop' };
      } catch {
        // 파싱 실패 줄 무시
      }
    }
  }

  yield { delta: '', done: true };
}
