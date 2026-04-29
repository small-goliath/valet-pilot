// ────────────────────────────────────────────────────────────────
//  Valet Pilot — AI 매니저
//  config.agent.model_priority 순서로 fallback 처리
//  단일 chat: 모델당 최대 3회 재시도 (1/2/4초 exponential backoff)
//  스트리밍: AsyncGenerator<StreamChunk>
// ────────────────────────────────────────────────────────────────

import type { AIProvider } from './provider.js';
import type { ChatMessage, ChatOptions, ChatResponse, StreamChunk } from '../types/ai.js';
import type { AgentConfig } from '../types/config.js';
import { KimiAdapter } from './adapters/kimi.js';
import { ClaudeAdapter } from './adapters/claude.js';
import { GptAdapter } from './adapters/gpt.js';
import { GeminiAdapter } from './adapters/gemini.js';
import { LlamaAdapter } from './adapters/llama.js';

// ── 타입 ────────────────────────────────────────────────────────

type ModelName = AgentConfig['model_priority'][number];

// ── 상수 ────────────────────────────────────────────────────────

/** 재시도 횟수 (첫 시도 제외) */
const MAX_RETRIES = 3;

/** exponential backoff 기본 딜레이 (ms) */
const BACKOFF_BASE_MS = 1000;

// ── 내부 헬퍼 ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createProvider(model: ModelName): AIProvider {
  switch (model) {
    case 'kimi-k2.5':
      return new KimiAdapter();
    case 'claude':
      return new ClaudeAdapter();
    case 'gpt':
      return new GptAdapter();
    case 'gemini':
      return new GeminiAdapter();
    case 'llama':
      return new LlamaAdapter();
    default: {
      // TypeScript 완전성 보장용
      const _exhaustive: never = model;
      throw new Error(`알 수 없는 모델: ${String(_exhaustive)}`);
    }
  }
}

// ────────────────────────────────────────────────────────────────

export class AIManager {
  private modelPriority: ModelName[];
  private currentModel: ModelName;

  constructor(agentConfig: AgentConfig) {
    if (agentConfig.model_priority.length === 0) {
      throw new Error('model_priority 가 비어 있습니다. 최소 하나의 모델을 지정하세요.');
    }
    this.modelPriority = agentConfig.model_priority;
    this.currentModel = agentConfig.model_priority[0];
  }

  /** 현재 활성 모델 이름을 반환합니다. */
  getCurrentModel(): ModelName {
    return this.currentModel;
  }

  /**
   * 채팅 요청을 보냅니다.
   * - 각 모델마다 실패 시 최대 3회 재시도 (1 → 2 → 4초 backoff)
   * - 모든 재시도 소진 시 다음 우선순위 모델로 전환
   * - 모든 모델 실패 시 Error throw
   */
  async chat(
    messages: ChatMessage[],
    options?: Omit<ChatOptions, 'messages'>,
  ): Promise<ChatResponse> {
    const errors: string[] = [];

    for (const model of this.modelPriority) {
      const provider = createProvider(model);
      const chatOptions: ChatOptions = { messages, ...options };

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const response = await provider.chat(chatOptions);
          this.currentModel = model;
          return response;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt); // 1s, 2s, 4s

          if (attempt < MAX_RETRIES - 1) {
            await sleep(backoffMs);
          } else {
            errors.push(`[${model}] ${message}`);
          }
        }
      }
    }

    throw new Error(
      `모든 AI 모델 호출이 실패했습니다:\n${errors.join('\n')}`,
    );
  }

  /**
   * 스트리밍 채팅 요청을 보냅니다.
   * - model_priority 첫 번째 모델 시도
   * - 실패 시 다음 모델로 전환 (스트리밍은 재시도 없이 바로 fallback)
   * - 모든 모델 실패 시 Error throw
   */
  async *stream(
    messages: ChatMessage[],
    options?: Omit<ChatOptions, 'messages'>,
  ): AsyncGenerator<StreamChunk> {
    const errors: string[] = [];

    for (const model of this.modelPriority) {
      const provider = createProvider(model);
      const chatOptions: ChatOptions = { messages, ...options, stream: true };

      try {
        this.currentModel = model;
        yield* provider.stream(chatOptions);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`[${model}] ${message}`);
      }
    }

    throw new Error(
      `모든 AI 모델 스트리밍 호출이 실패했습니다:\n${errors.join('\n')}`,
    );
  }
}
