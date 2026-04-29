// ────────────────────────────────────────────────────────────────
//  Valet Pilot — AI 프로바이더 추상 인터페이스
// ────────────────────────────────────────────────────────────────

import type { ChatOptions, ChatResponse, StreamChunk } from '../types/ai.js';

export interface AIProvider {
  /**
   * 단일 채팅 응답을 반환합니다.
   */
  chat(options: ChatOptions): Promise<ChatResponse>;

  /**
   * 스트리밍 응답을 AsyncGenerator 로 반환합니다.
   */
  stream(options: ChatOptions): AsyncGenerator<StreamChunk>;
}
