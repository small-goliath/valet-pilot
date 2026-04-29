// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 세션 컨텍스트 빌더
// ────────────────────────────────────────────────────────────────

import type { ChatMessage } from '../types/ai.js';
import type { AgentConfig } from '../types/config.js';
import type { Turn } from '../types/session.js';

// ── 시스템 프롬프트 빌더 ─────────────────────────────────────────

/**
 * AI에게 전달할 시스템 프롬프트를 생성합니다.
 *
 * @param config AgentConfig (닉네임, 언어, 사투리 포함)
 * @returns 시스템 프롬프트 문자열
 */
export function buildSystemPrompt(config: AgentConfig): string {
  const { nickname, language, dialect } = config;

  const languageLabel =
    language === 'korean' ? '한국어' :
    language === 'japanese' ? '일본어' :
    'English';

  const dialectNote =
    language === 'korean' && dialect
      ? `\n- 사투리: ${dialect} 사투리로 자연스럽게 말해주세요.`
      : '';

  return [
    `당신은 "${nickname}"라는 이름의 개인 업무 보조 AI 비서입니다.`,
    '',
    '역할 및 지침:',
    '- 사용자의 업무를 지원하고 일정·정보·작업 관리를 돕습니다.',
    '- 간결하고 명확하게 답변하세요. 불필요한 서두나 중복 설명은 피합니다.',
    `- 응답 언어: ${languageLabel}${dialectNote}`,
    '- 음성으로 전달되므로 마크다운 기호(*, #, ` 등)는 사용하지 마세요.',
    '- 사용자를 존중하는 어조로 대화하되, 너무 격식을 차리지 않아도 됩니다.',
  ].join('\n');
}

// ── Turn → ChatMessage 변환 ──────────────────────────────────────

/**
 * Turn 배열을 AI API용 ChatMessage 배열로 변환합니다.
 *
 * @param turns 세션의 Turn 배열
 * @returns ChatMessage 배열 (system 역할 제외)
 */
export function turnsToMessages(turns: Turn[]): ChatMessage[] {
  return turns.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));
}
