// ────────────────────────────────────────────────────────────────
//  Valet Pilot — STT 관련 공통 타입 정의
// ────────────────────────────────────────────────────────────────

/** Whisper 세그먼트 단위 */
export interface TranscriptionSegment {
  /** 세그먼트 시작 시각 (초) */
  start: number;
  /** 세그먼트 종료 시각 (초) */
  end: number;
  /** 해당 세그먼트의 텍스트 */
  text: string;
  /** 평균 로그 확률 (Whisper 내부 신뢰도 지표, 일반적으로 음수) */
  avg_logprob: number;
  /** 무음일 확률 (0~1, 높을수록 실제 음성이 없을 가능성이 큼) */
  no_speech_prob: number;
}

/** STT 변환 결과 */
export interface TranscriptionResult {
  /** 인식된 전체 텍스트 */
  text: string;
  /**
   * 전체 발화 신뢰도 (0~1).
   * Whisper avg_logprob 기반으로 계산하거나, Google STT confidence 그대로 사용.
   */
  confidence: number;
  /** 세그먼트 목록 (Whisper 전용; Google STT 사용 시 단일 요소로 채워질 수 있음) */
  segments: TranscriptionSegment[];
  /** ISO 639-1 언어 코드 (예: "ko", "en") */
  language: string;
}

/** transcribe 호출 시 전달할 옵션 */
export interface SttOptions {
  /**
   * 인식 대상 언어.
   * Whisper: "korean" | "english" | "japanese" 등 자연어 표기 수용.
   * Google STT: BCP-47 코드로 자동 변환됨.
   */
  language?: string;
  /** 사용할 Whisper 모델 크기 (기본값은 config.stt.whisper_model 또는 아키텍처 자동 감지) */
  whisperModel?: 'small' | 'medium' | 'large-v3';
}
