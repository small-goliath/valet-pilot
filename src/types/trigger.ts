// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 트리거 공통 타입 정의
// ────────────────────────────────────────────────────────────────

/** 트리거 종류 */
export type TriggerType = 'clap' | 'wake_word' | 'keyboard' | 'cli';

/** 트리거 감지 이벤트 */
export interface TriggerEvent {
  /** 트리거 종류 */
  type: TriggerType;
  /** 감지 시각 (Unix ms) */
  timestamp: number;
  /** 트리거 별 추가 메타데이터 (선택) */
  metadata?: Record<string, unknown>;
}
