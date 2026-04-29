// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 대화 히스토리 관련 타입 정의
// ────────────────────────────────────────────────────────────────

import type { Turn, TriggerType } from './session.js';

// Turn, TriggerType 은 session.ts 에서 재사용
export type { Turn, TriggerType };

/** 단일 세션의 저장된 히스토리 */
export interface SessionHistory {
  /** 세션 UUID v4 */
  session_id: string;
  /** 세션을 시작한 트리거 종류 */
  trigger_type: TriggerType;
  /** 세션 시작 시각 (ISO 8601) */
  started_at: string;
  /** 세션 종료 시각 (ISO 8601) */
  ended_at: string;
  /** AI 생성 요약 (2~3문장) */
  summary: string;
  /** 민감 정보가 마스킹된 대화 턴 목록 */
  turns: Turn[];
}
