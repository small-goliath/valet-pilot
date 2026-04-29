// ────────────────────────────────────────────────────────────────
//  Valet Pilot — TTS 캐시 관리
//  저장 위치: ~/.valet-pilot/cache/tts/{key}.mp3
// ────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VALET_DIRS } from '../utils/dirs.js';

/**
 * 텍스트, 음성 ID, 언어를 조합해 캐시 키(SHA-256 해시)를 생성합니다.
 */
export function getCacheKey(text: string, voice: string, language: string): string {
  return createHash('sha256')
    .update(`${text}::${voice}::${language}`)
    .digest('hex');
}

/**
 * 캐시된 오디오 파일 경로를 반환합니다.
 * 캐시가 없으면 null 을 반환합니다.
 */
export function getCachedAudio(key: string): string | null {
  const filePath = join(VALET_DIRS.cacheTts, `${key}.mp3`);
  return existsSync(filePath) ? filePath : null;
}

/**
 * 생성된 오디오 파일을 캐시 디렉토리에 저장합니다.
 * audioPath 가 이미 캐시 경로인 경우 복사를 건너뜁니다.
 */
export async function setCachedAudio(key: string, audioPath: string): Promise<void> {
  const destPath = join(VALET_DIRS.cacheTts, `${key}.mp3`);
  if (audioPath !== destPath) {
    await copyFile(audioPath, destPath);
  }
}
