// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 앱 제어 타입 정의
// ────────────────────────────────────────────────────────────────

/**
 * 앱 제어 수준
 *
 * 1: 앱 실행/종료 (open -a / osascript quit)
 * 2: 앱 내부 포커스/활성화 (osascript activate)
 * 3: 앱 내부 조작 (JXA / osascript 스크립트)
 */
export type ControlLevel = 1 | 2 | 3;

/** AI가 사용자 발화에서 추출한 앱 제어 명령 */
export interface AppControlCommand {
  /** 제어 대상 앱 이름 (예: "Chrome", "Visual Studio Code") */
  appName: string;
  /** 수행할 동작 (예: "open", "quit", "activate", "newTab", "openUrl", "openFile") */
  action: string;
  /** 제어 수준 */
  level: ControlLevel;
  /** 동작에 필요한 추가 인자 (예: URL, 파일 경로) */
  args?: string[];
  /** 위험 명령 여부 (파일 삭제, 시스템 설정 변경 등) */
  isDangerous?: boolean;
}

/** 앱 제어 명령 실행 결과 */
export interface AppControlResult {
  /** 실행 성공 여부 */
  success: boolean;
  /** 결과 메시지 */
  message: string;
}
