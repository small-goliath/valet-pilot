// ────────────────────────────────────────────────────────────────
//  Valet Pilot — AI 관련 공통 타입 정의
// ────────────────────────────────────────────────────────────────

/** 채팅 메시지 역할 */
export type MessageRole = 'user' | 'assistant' | 'system';

/** 채팅 메시지 단위 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/** chat / stream 호출 옵션 */
export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/** 토큰 사용량 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/** 단일 chat 응답 */
export interface ChatResponse {
  content: string;
  model: string;
  usage: TokenUsage;
}

/** 스트리밍 청크 */
export interface StreamChunk {
  delta: string;
  done: boolean;
}
