// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Anthropic Claude 어댑터
//  API: https://api.anthropic.com/v1
//  인증: x-api-key 헤더 + anthropic-version 헤더
// ────────────────────────────────────────────────────────────────

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import type { AIProvider } from '../provider.js';
import type { ChatMessage, ChatOptions, ChatResponse, StreamChunk } from '../../types/ai.js';
import { getSecret } from '../../config/keychain.js';

const BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const SERVICE = 'valet-pilot';
const ACCOUNT = 'claude-api-key';

// ── Anthropic 응답 타입 ──────────────────────────────────────────

interface AnthropicContent {
  type: 'text';
  text: string;
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicResponse {
  id: string;
  model: string;
  content: AnthropicContent[];
  usage: AnthropicUsage;
  stop_reason: string;
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { type: string; text?: string };
  usage?: { output_tokens: number };
  message?: { model: string; usage: AnthropicUsage };
}

// ────────────────────────────────────────────────────────────────

export class ClaudeAdapter implements AIProvider {
  private model: string;

  constructor(model = DEFAULT_MODEL) {
    this.model = model;
  }

  private async getApiKey(): Promise<string> {
    const key = await getSecret(SERVICE, ACCOUNT);
    if (!key) throw new Error('Claude API 키가 Keychain에 없습니다 (account: claude-api-key)');
    return key;
  }

  /** system 메시지를 분리하여 Anthropic API 형식으로 변환합니다. */
  private splitMessages(messages: ChatMessage[]): {
    system: string | undefined;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    return {
      system: systemParts.length > 0 ? systemParts.join('\n') : undefined,
      messages: rest,
    };
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const apiKey = await this.getApiKey();
    const { system, messages } = this.splitMessages(options.messages);

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
    };
    if (system) body['system'] = system;

    const res: AxiosResponse<AnthropicResponse> = await axios.post(
      `${BASE_URL}/messages`,
      body,
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
        },
      },
    );

    const text = res.data.content.map((c) => c.text).join('');
    return {
      content: text,
      model: res.data.model,
      usage: {
        promptTokens: res.data.usage.input_tokens,
        completionTokens: res.data.usage.output_tokens,
      },
    };
  }

  async *stream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    const apiKey = await this.getApiKey();
    const { system, messages } = this.splitMessages(options.messages);

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      stream: true,
    };
    if (system) body['system'] = system;

    const res = await axios.post(`${BASE_URL}/messages`, body, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
    });

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
          const event = JSON.parse(data) as AnthropicStreamEvent;

          if (event.type === 'content_block_delta' && event.delta?.text) {
            yield { delta: event.delta.text, done: false };
          } else if (event.type === 'message_stop') {
            yield { delta: '', done: true };
            return;
          }
        } catch {
          // 파싱 실패 줄 무시
        }
      }
    }

    yield { delta: '', done: true };
  }
}
