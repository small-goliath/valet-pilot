// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Ollama (Llama) 어댑터
//  API: http://localhost:11434/api  (Ollama REST API)
//  인증: 없음 (로컬 서버)
// ────────────────────────────────────────────────────────────────

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import type { AIProvider } from '../provider.js';
import type { ChatMessage, ChatOptions, ChatResponse, StreamChunk } from '../../types/ai.js';

const BASE_URL = 'http://localhost:11434/api';
const DEFAULT_MODEL = 'llama3.2';

// ── Ollama 요청/응답 타입 ────────────────────────────────────────

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

// ── 내부 변환 헬퍼 ────────────────────────────────────────────────

function toOllamaMessages(messages: ChatMessage[]): OllamaMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

// ────────────────────────────────────────────────────────────────

export class LlamaAdapter implements AIProvider {
  private model: string;

  constructor(model = DEFAULT_MODEL) {
    this.model = model;
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const res: AxiosResponse<OllamaResponse> = await axios.post(
      `${BASE_URL}/chat`,
      {
        model: this.model,
        messages: toOllamaMessages(options.messages),
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        },
        stream: false,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    return {
      content: res.data.message.content,
      model: res.data.model,
      usage: {
        promptTokens: res.data.prompt_eval_count ?? 0,
        completionTokens: res.data.eval_count ?? 0,
      },
    };
  }

  async *stream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    const res = await axios.post(
      `${BASE_URL}/chat`,
      {
        model: this.model,
        messages: toOllamaMessages(options.messages),
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        },
        stream: true,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'stream',
      },
    );

    // Ollama 스트리밍은 NDJSON (개행 구분 JSON) 형식
    let buffer = '';

    for await (const chunk of res.data as NodeJS.ReadableStream) {
      buffer += (chunk as Buffer).toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as OllamaStreamChunk;
          const delta = parsed.message?.content ?? '';
          yield { delta, done: parsed.done };
          if (parsed.done) return;
        } catch {
          // 파싱 실패 줄 무시
        }
      }
    }

    yield { delta: '', done: true };
  }
}
