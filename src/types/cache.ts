// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 브리핑 캐시 타입 정의
// ────────────────────────────────────────────────────────────────

import type { InterestReport } from './interest.js';

/** 관심사별 캐시 항목 */
export interface BriefingCacheEntry {
  /** 관심사 종류 (예: 'redmine', 'weather') */
  interest_type: string;
  /** fetch 결과 리포트 */
  data: InterestReport;
  /** 데이터를 가져온 시각 (ISO 8601 문자열) */
  fetched_at: string;
  /** 유효 기간 (분) — 이 시간 이내이면 fresh */
  ttl_minutes: number;
  /** 최대 stale 허용 시간 (분) — 이 시간 초과 시 완전 만료 */
  max_stale_minutes: number;
  /** 마지막 갱신 오류 메시지 (성공 시 undefined) */
  last_error?: string;
  /** 사전 합성된 TTS 오디오 파일 경로 (없으면 undefined) */
  tts_audio_path?: string;
}

/** 전체 캐시 스토어 */
export interface BriefingCacheStore {
  /** interest_type → BriefingCacheEntry */
  entries: Record<string, BriefingCacheEntry>;
}
