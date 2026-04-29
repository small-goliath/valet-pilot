// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Edge TTS 연동
//  edge-tts Python CLI 를 child_process 로 호출합니다.
//  사투리 처리: dialect 설정 시 AI 모델로 텍스트를 변환 후 표준어 TTS
// ────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import type { TtsOptions, TtsResult, VoiceId } from '../types/tts.js';

// ── 상수 ────────────────────────────────────────────────────────

const KEYCHAIN_SERVICE = 'valet-pilot';

/** VoiceId → Edge TTS 한국어 음성 이름 매핑 */
const VOICE_MAP: Record<VoiceId, string> = {
  'male-01': 'ko-KR-InJoonNeural',
  'male-02': 'ko-KR-HyunsuNeural',
  'female-01': 'ko-KR-SunHiNeural',
  'female-02': 'ko-KR-YuJinNeural',
};

const DEFAULT_VOICE: VoiceId = 'female-01';

// ── 에러 클래스 ──────────────────────────────────────────────────

/** edge-tts CLI 가 설치되어 있지 않을 때 throw 되는 에러 */
export class EdgeTtsNotInstalledError extends Error {
  constructor() {
    super(
      'edge-tts CLI 를 찾을 수 없습니다. `pip install edge-tts` 로 설치해주세요.',
    );
    this.name = 'EdgeTtsNotInstalledError';
  }
}

// ── 내부 헬퍼 ────────────────────────────────────────────────────

/**
 * 임시 파일 경로를 생성합니다.
 */
function makeTempPath(): string {
  const rand = randomBytes(8).toString('hex');
  return join(tmpdir(), `valet-tts-${rand}.mp3`);
}

/**
 * edge-tts CLI 를 실행합니다.
 * ENOENT 가 발생하면 EdgeTtsNotInstalledError 를 throw 합니다.
 */
function runEdgeTts(text: string, voice: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('edge-tts', [
      '--text', text,
      '--voice', voice,
      '--write-media', outputPath,
    ]);

    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new EdgeTtsNotInstalledError());
      } else {
        reject(new Error(`edge-tts 실행 오류: ${err.message}`));
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`edge-tts 종료 코드 ${code ?? 'null'}: ${stderr.trim()}`));
      }
    });
  });
}

/**
 * dialect 가 설정된 경우 AI 모델로 텍스트를 해당 사투리로 변환합니다.
 * Phase 1 방식: AI 에게 사투리 변환 프롬프트 적용 후 표준어 TTS 사용
 */
async function applyDialect(text: string, dialect: string): Promise<string> {
  try {
    // 순환 의존 방지를 위해 동적 import 사용
    const { AIManager } = await import('../ai/manager.js');
    const { loadConfig } = await import('../config/manager.js');

    const config = await loadConfig();
    const ai = new AIManager(config.agent);

    const response = await ai.chat([
      {
        role: 'system',
        content: `당신은 한국어 ${dialect} 사투리 번역기입니다. 입력된 표준어 문장을 ${dialect} 사투리로 자연스럽게 변환하세요. 변환된 텍스트만 출력하고 설명은 하지 마세요.`,
      },
      {
        role: 'user',
        content: text,
      },
    ]);

    return response.content.trim();
  } catch {
    // 사투리 변환 실패 시 원본 텍스트 사용
    return text;
  }
}

// ── 공개 API ─────────────────────────────────────────────────────

/**
 * Edge TTS 로 텍스트를 합성합니다.
 *
 * @param text       합성할 텍스트
 * @param outputPath 출력 mp3 파일 경로. 생략하면 임시 경로 자동 생성.
 * @param options    TTS 옵션
 */
export async function synthesize(
  text: string,
  outputPath?: string,
  options?: TtsOptions,
): Promise<TtsResult> {
  const voiceId = (options?.voice ?? DEFAULT_VOICE) as VoiceId;
  const edgeVoice = VOICE_MAP[voiceId] ?? VOICE_MAP[DEFAULT_VOICE];
  const destPath = outputPath ?? makeTempPath();

  // 사투리 처리: dialect 설정 시 AI 변환 적용
  let finalText = text;
  if (options?.dialect) {
    finalText = await applyDialect(text, options.dialect);
  }

  await runEdgeTts(finalText, edgeVoice, destPath);

  return {
    audioPath: destPath,
    cached: false,
  };
}

export { KEYCHAIN_SERVICE, VOICE_MAP };
