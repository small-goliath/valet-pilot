// ────────────────────────────────────────────────────────────────
//  Valet Pilot — config.yaml 전체 TypeScript 타입 정의
// ────────────────────────────────────────────────────────────────

/** AI 에이전트 설정 */
export interface AgentConfig {
  /** 호출 닉네임 (예: "자비스") */
  nickname: string;
  /** 기본 AI 모델 */
  model: 'kimi-k2.5' | 'claude' | 'gpt' | 'gemini' | 'llama';
  /** 응답 언어 */
  language: 'korean' | 'japanese' | 'english';
  /** 사투리 (language === 'korean' 일 때만 유효) */
  dialect?: string;
  /** TTS 목소리 ID */
  voice: string;
  /**
   * fallback 우선순위 목록.
   * 기본 모델 실패 시 순서대로 시도.
   */
  model_priority: Array<'kimi-k2.5' | 'claude' | 'gpt' | 'gemini' | 'llama'>;
}

/** 박수 감지 설정 */
export interface ClapTriggerConfig {
  enabled: boolean;
  /** 감지 임계값 (dB, 예: -30) */
  threshold_db: number;
  /** 두 번 박수 간격 허용 범위 (ms, 예: 800) */
  interval_ms: number;
}

/** Wake-word 감지 설정 */
export interface WakeWordTriggerConfig {
  enabled: boolean;
  /** 인식할 wake word 목록 */
  words: string[];
}

/** 키보드 단축키 트리거 설정 */
export interface KeyboardTriggerConfig {
  enabled: boolean;
  /** 단축키 표현 문자열 (예: "Ctrl+Shift+V") */
  shortcut: string;
}

/** 전체 트리거 설정 */
export interface TriggerConfig {
  clap: ClapTriggerConfig;
  wake_word: WakeWordTriggerConfig;
  keyboard: KeyboardTriggerConfig;
}

/** BGM 재생 타이밍 설정 */
export interface BgmConfig {
  /** BGM 파일 경로 (상대 또는 절대) */
  file: string;
  /** 환영 인사 종료 시각 (초) */
  greeting_end: number;
  /** 힘찬 선언 시작 시각 (초) */
  shout_start: number;
  /** 힘찬 선언 종료 시각 (초) */
  shout_end: number;
  /** 리포트 배경음 시작 시각 (초) */
  report_start: number;
  /** BGM 최대 재생 시간 (초) */
  max_duration: number;
}

/** 세션 관리 설정 */
export interface SessionConfig {
  /** 세션 종료 인식 키워드 목록 */
  end_keywords: string[];
  /** 무응답 자동 종료 시간 (분) */
  auto_end_minutes: number;
  /** 종료 인사 활성화 여부 */
  farewell_enabled: boolean;
}

/** STT(음성 인식) 설정 */
export interface SttConfig {
  /** 로컬 Whisper 모델 크기 */
  whisper_model: 'small' | 'medium' | 'large-v3';
  /** 로컬 Whisper 실패 시 클라우드 STT로 fallback 여부 */
  fallback_to_cloud: boolean;
}

/** 브리핑 캐시 설정 */
export interface CacheConfig {
  /** 관심사 데이터 갱신 주기 (분) */
  refresh_interval_minutes: number;
}

/** 관심사 데이터 소스 */
export interface InterestSource {
  /** 소스 종류 */
  type: 'rest_api' | 'rss' | 'scraping' | 'local_file';
  /** HTTP 메서드 (rest_api 전용) */
  method?: 'GET' | 'POST';
  /**
   * 데이터 추출 경로.
   * - rest_api: JSONPath (예: "$.rates.KRW")
   * - scraping: CSS 셀렉터
   * - local_file: 생략 가능 (파일 전체 읽기)
   */
  extract?: string;
}

/** 관심사 항목 */
export interface Interest {
  /**
   * 사전 정의된 관심사 타입 또는 'custom'.
   * 예: 'redmine' | 'weather' | 'custom'
   */
  type: string;
  /** 표시 이름 */
  name?: string;
  /** API / 피드 / 스크래핑 URL */
  url?: string;
  /**
   * API 인증 키.
   * 평문 값 또는 "${ENV_VAR}" 형식의 환경 변수 참조.
   */
  api_key?: string;
  /** 커스텀 관심사의 데이터 소스 정의 */
  source?: InterestSource;
  /** 수집 주기 (예: 'daily', 'hourly') */
  schedule?: string;
  /** 리포트 출력 템플릿 (예: "현재 환율은 {value}원입니다.") */
  report_template?: string;
  /** Redmine / JIRA URL (type === 'redmine' | 'jira' 전용) */
  location?: string;
}

/** config.yaml 최상위 루트 타입 */
export interface ValetConfig {
  agent: AgentConfig;
  trigger: TriggerConfig;
  bgm: BgmConfig;
  session: SessionConfig;
  stt: SttConfig;
  cache: CacheConfig;
  interests: Interest[];
}
