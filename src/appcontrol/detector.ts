// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 앱 제어 의도 감지기
//  AIManager 에게 사용자 발화 분석을 위임하여
//  AppControlCommand 또는 null 을 반환합니다.
// ────────────────────────────────────────────────────────────────

import type { AIManager } from '../ai/manager.js';
import type { AppControlCommand } from '../types/appcontrol.js';

// ── 시스템 프롬프트 ───────────────────────────────────────────────

const DETECTION_SYSTEM_PROMPT = `
당신은 macOS 앱 제어 의도 분석기입니다.
사용자 발화가 macOS 애플리케이션 제어 요청인지 판별하고,
맞다면 JSON 형태로 명령을 추출하세요.

앱 제어 의도의 예:
- "크롬 열어줘" → open Chrome (level 1)
- "크롬 닫아" → quit Chrome (level 1)
- "크롬 앞으로 가져와" → activate Chrome (level 2)
- "크롬에서 새 탭 열어" → newTab Chrome (level 3)
- "크롬으로 https://google.com 열어줘" → openUrl Chrome (level 3)
- "VSCode에서 파일 열어줘 /Users/foo/bar.ts" → openFile VSCode (level 3)

위험 명령 예 (isDangerous: true):
- 파일 삭제, 포맷, 시스템 설정 변경, 개인정보 접근

앱 제어 의도라면 반드시 다음 JSON 만 반환하세요 (다른 텍스트 금지):
{
  "appName": "앱 이름 (영문 정식 명칭)",
  "action": "open|quit|activate|newTab|openUrl|openFile|기타동작",
  "level": 1 | 2 | 3,
  "args": ["추가 인자 (선택)"],
  "isDangerous": false
}

앱 제어 의도가 아니라면 반드시 다음만 반환하세요:
null
`.trim();

// ── AppControlDetector ────────────────────────────────────────────

export class AppControlDetector {
  constructor(private readonly ai: AIManager) {}

  /**
   * 사용자 발화를 분석하여 앱 제어 의도이면 AppControlCommand 를,
   * 그렇지 않으면 null 을 반환합니다.
   */
  async detect(userText: string): Promise<AppControlCommand | null> {
    let rawContent: string;

    try {
      const response = await this.ai.chat([
        { role: 'system', content: DETECTION_SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ]);
      rawContent = response.content.trim();
    } catch (err) {
      console.error('[AppControlDetector] AI 호출 오류:', err);
      return null;
    }

    // "null" 또는 빈 응답 → 앱 제어 의도 아님
    if (!rawContent || rawContent === 'null') {
      return null;
    }

    // JSON 파싱
    try {
      // 코드 블록으로 감싸인 경우 추출
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : rawContent;

      const parsed: unknown = JSON.parse(jsonText);

      if (!isAppControlCommand(parsed)) {
        return null;
      }

      return parsed;
    } catch {
      console.error('[AppControlDetector] JSON 파싱 실패:', rawContent);
      return null;
    }
  }
}

// ── 타입 가드 ─────────────────────────────────────────────────────

function isAppControlCommand(value: unknown): value is AppControlCommand {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  if (typeof obj['appName'] !== 'string' || obj['appName'].trim() === '') return false;
  if (typeof obj['action'] !== 'string' || obj['action'].trim() === '') return false;
  if (obj['level'] !== 1 && obj['level'] !== 2 && obj['level'] !== 3) return false;

  if ('args' in obj && obj['args'] !== undefined) {
    if (!Array.isArray(obj['args'])) return false;
    if (!(obj['args'] as unknown[]).every((a) => typeof a === 'string')) return false;
  }

  if ('isDangerous' in obj && obj['isDangerous'] !== undefined) {
    if (typeof obj['isDangerous'] !== 'boolean') return false;
  }

  return true;
}
