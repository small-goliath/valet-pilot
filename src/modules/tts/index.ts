import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';
import type { ValetConfig } from '../../types/config.js';

// macOS say 명령 한국어 음성 목록 (설치 필요)
const SAY_VOICE: Record<string, string> = {
  korean: 'Yuna',    // macOS 기본 한국어 음성
  japanese: 'Kyoko',
  english: 'Samantha',
};

/**
 * 텍스트를 음성으로 출력.
 * OpenAI 모델: OpenAI TTS API → 임시 파일 → afplay
 * 기타 모델: macOS say 명령
 *
 * @param text 발화할 텍스트
 * @param config 사용자 설정
 * @param speed TTS 속도 (0.25~4.0, 기본 1.0)
 * @returns 실제 재생에 소요된 시간(ms)
 */
export async function speak(text: string, config: ValetConfig, speed = 1.0): Promise<number> {
  const start = Date.now();

  if (config.ai_model === 'openai') {
    await speakWithOpenAI(text, config, speed);
  } else {
    await speakWithSay(text, config, speed);
  }

  return Date.now() - start;
}

/**
 * OpenAI TTS API로 발화
 */
async function speakWithOpenAI(text: string, config: ValetConfig, speed: number): Promise<void> {
  const client = new OpenAI({ apiKey: config.ai_api_key });

  const mp3 = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text,
    speed: Math.max(0.25, Math.min(4.0, speed)),
  });

  const tmpFile = path.join(os.tmpdir(), `valet-tts-${Date.now()}.mp3`);
  const buffer = Buffer.from(await mp3.arrayBuffer());
  fs.writeFileSync(tmpFile, buffer);

  try {
    await playAudioFile(tmpFile);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

/**
 * macOS say 명령으로 발화
 * speed 파라미터: 1.0 → 기본 속도(약 200 wpm), say -r 옵션으로 변환
 */
async function speakWithSay(text: string, config: ValetConfig, speed: number): Promise<void> {
  const voice = SAY_VOICE[config.language] ?? 'Yuna';
  const rate = Math.round(200 * speed); // 기본 200 wpm 기준으로 속도 환산

  return new Promise((resolve, reject) => {
    const proc = spawn('say', ['-v', voice, '-r', String(rate), text]);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`say 명령 실패 (code: ${code})`));
    });
    proc.on('error', reject);
  });
}

/**
 * afplay로 오디오 파일 재생 (macOS 내장)
 */
export async function playAudioFile(filePath: string, volume = 1.0): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('afplay', ['-v', String(volume), filePath]);
    proc.on('close', (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`afplay 실패 (code: ${code})`));
    });
    proc.on('error', reject);
  });
}

/**
 * 백그라운드로 BGM 재생. 반환된 함수를 호출하면 중지.
 */
export function playBGMBackground(filePath: string, volume = 0.35): () => void {
  const proc = spawn('afplay', ['-v', String(volume), filePath], {
    detached: false,
    stdio: 'ignore',
  });

  return () => {
    try {
      proc.kill('SIGTERM');
    } catch {
      // 이미 종료된 경우 무시
    }
  };
}

/**
 * 지정 시간(ms) 대기
 */
export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 사투리 스타일의 텍스트를 AI로 생성
 * (실제 억양은 TTS가 처리하며, 어휘/어미만 변환)
 */
export function dialectSystemPrompt(config: ValetConfig): string {
  const dialectMap: Record<string, string> = {
    'gyeong-sang': '경상도 사투리(경상방언)로 어미와 어휘를 변환해주세요. 예: ~했다 → ~했다 카이, ~입니다 → ~입니더',
    'jeolla': '전라도 사투리(전라방언)로 어미와 어휘를 변환해주세요. 예: ~했어요 → ~했제라우, ~입니다 → ~잉께요',
    'chung-cheong': '충청도 사투리(충청방언)로 어미와 어휘를 변환해주세요. 예: ~했어요 → ~했슈, ~입니다 → ~여',
    'jeju': '제주도 사투리(제주방언)로 어미와 어휘를 변환해주세요. 예: ~합니다 → ~하우다, ~입니다 → ~이우다',
    'gang-won': '강원도 사투리(강원방언)로 어미와 어휘를 변환해주세요. 예: ~했어요 → ~했지유, ~입니다 → ~이에유',
  };

  const dialectInstruction = config.dialect && config.dialect !== 'standard'
    ? dialectMap[config.dialect] ?? ''
    : '';

  return dialectInstruction
    ? `당신은 한국어 ${config.dialect} 사투리 전문가입니다. 입력된 텍스트를 ${dialectInstruction} 원래 의미는 유지하되 자연스러운 사투리 표현으로만 바꿔주세요.`
    : '';
}
