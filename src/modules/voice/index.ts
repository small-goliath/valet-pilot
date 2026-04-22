import { recordUntilSilence } from './recorder.js';
import { transcribe } from './transcriber.js';
import { detectClapsInFile } from './clap-detector.js';
import type { ValetConfig } from '../../types/config.js';

export type VoiceEvent =
  | { type: 'trigger' }
  | { type: 'command'; text: string }
  | { type: 'stop' };

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
  process.stdout.write('  👂 5초간 녹음 중...');
  const recording = await recordUntilSilence(5);
  process.stdout.write(' 분석 중...\n');
  try {
    // 박수 두 번 패턴 감지 → 트리거
    if (detectClapsInFile(recording.filePath)) {
      console.log('  👏 박수 두 번 감지됨 → 브리핑 시작');
      return { type: 'trigger' };
    }

    // 박수가 아니면 STT로 명령 처리
    const text = await transcribe(recording.filePath, config);

    if (!text || text.length < 2) {
      throw new Error('유효한 음성이 감지되지 않았습니다.');
    }

    console.log(`  🗣  인식된 텍스트: "${text}"`);

    if (isStopCommand(text, config.agent_nickname)) {
      return { type: 'stop' };
    }
    return { type: 'command', text };
  } finally {
    recording.cleanup();
  }
}
