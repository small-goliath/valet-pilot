// ────────────────────────────────────────────────────────────────
//  Valet Pilot — TTS 관련 공통 타입 정의
// ────────────────────────────────────────────────────────────────

/** 지원하는 음성 ID */
export type VoiceId = 'male-01' | 'male-02' | 'female-01' | 'female-02';

/** TTS 합성 옵션 */
export interface TtsOptions {
  /** 사용할 음성 ID */
  voice?: VoiceId;
  /** 출력 언어 */
  language?: string;
  /** 사투리 (korean 일 때만 유효) */
  dialect?: string;
  /** 말하기 속도 (1.0 = 기본) */
  speed?: number;
  /** 음성 높낮이 (1.0 = 기본) */
  pitch?: number;
}

/** TTS 합성 결과 */
export interface TtsResult {
  /** 생성된 오디오 파일의 절대 경로 */
  audioPath: string;
  /** 오디오 재생 시간 (초, 알 수 없으면 undefined) */
  duration?: number;
  /** 캐시에서 가져온 결과인지 여부 */
  cached: boolean;
}
