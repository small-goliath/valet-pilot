import { recordUntilSilence } from './recorder.js';
import { transcribe } from './transcriber.js';
import type { ValetConfig } from '../../types/config.js';

export type VoiceEvent =
  | { type: 'trigger' }
  | { type: 'command'; text: string }
  | { type: 'stop' };

/**
 * 트리거 키워드 감지 여부 판단
 * "{닉네임}, 시작하자" / "드가자" / "Let's Go!" 등 유연하게 매칭
 */
export function isTrigger(text: string, nickname: string): boolean {
  const t = text.toLowerCase().trim();
  const nick = nickname.toLowerCase();

  const patterns = [
    new RegExp(`${nick}.*시작`),
    new RegExp(`${nick}.*드가자`),
    new RegExp(`${nick}.*let'?s\\s*go`, 'i'),
    /^드가자$/,
    /^시작하자$/,
    /^let'?s\s*go[!]?$/i,
  ];

  return patterns.some((p) => p.test(t));
}

/**
 * 종료 명령 감지 여부 판단
 */
export function isStopCommand(text: string, nickname: string): boolean {
  const t = text.toLowerCase().trim();
  const nick = nickname.toLowerCase();

  const patterns = [
    new RegExp(`${nick}.*종료`),
    new RegExp(`${nick}.*그만`),
    new RegExp(`${nick}.*bye`, 'i'),
    /^종료$/,
    /^그만해$/,
    /^종료해줘$/,
  ];

  return patterns.some((p) => p.test(t));
}

/**
 * 대기 루프: 음성을 감지하고 이벤트 타입을 반환
 */
export async function listenOnce(config: ValetConfig): Promise<VoiceEvent> {
  process.stdout.write('  👂 8초간 녹음 중...');
  const recording = await recordUntilSilence(8);
  process.stdout.write(' STT 변환 중...\n');
  try {
    const text = await transcribe(recording.filePath, config);

    if (!text || text.length < 2) {
      // 빈 결과 → 아무 말 없었던 것으로 간주, 재시도
      throw new Error('유효한 음성이 감지되지 않았습니다.');
    }

    console.log(`  🗣  인식된 텍스트: "${text}"`);

    if (isTrigger(text, config.agent_nickname)) {
      return { type: 'trigger' };
    }
    if (isStopCommand(text, config.agent_nickname)) {
      return { type: 'stop' };
    }
    return { type: 'command', text };
  } finally {
    recording.cleanup();
  }
}
