// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 관심사(Interest) 공통 타입 정의
// ────────────────────────────────────────────────────────────────

/** 관심사 fetch 결과 리포트 */
export interface InterestReport {
  /** 관심사 종류 (예: 'redmine', 'weather') */
  type: string;
  /** 표시 이름 */
  name: string;
  /** 브리핑용 텍스트 (TTS에 전달되는 완성된 문장) */
  summary: string;
  /** 데이터를 가져온 시각 */
  fetchedAt: Date;
  /** 오류 발생 시 오류 메시지 (throw 금지, 여기에 담아 반환) */
  error?: string;
}

/** 관심사 데이터를 가져오는 fetcher 인터페이스 */
export interface InterestFetcher {
  fetch(): Promise<InterestReport>;
}
