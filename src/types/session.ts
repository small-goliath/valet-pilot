// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 세션 관련 공통 타입 정의
// ────────────────────────────────────────────────────────────────

/** 세션 상태 머신 */
export type SessionState = 'idle' | 'listening' | 'processing' | 'speaking' | 'ending';

/** 대화 턴 단위 */
export interface Turn {
  /** 발화 주체 */
  role: 'user' | 'assistant';
  /** 발화 내용 */
  content: string;
  /** 발화 시각 (ISO 8601) */
  timestamp: string;
  /** 응답을 생성한 AI 모델 이름 (assistant 턴 전용) */
  model?: string;
}

/** 세션 트리거 종류 */
export type TriggerType = 'clap' | 'wake_word' | 'keyboard' | 'cli';

/** 단일 대화 세션 */
export interface Session {
  /** UUID v4 */
  id: string;
  /** 세션을 시작한 트리거 종류 */
  triggerType: TriggerType;
  /** 세션 시작 시각 (ISO 8601) */
  startedAt: string;
  /** 현재 세션 상태 */
  state: SessionState;
  /** 최근 50턴 유지 */
  turns: Turn[];
}
