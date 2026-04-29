import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const VALET_HOME = join(homedir(), '.valet-pilot');

export const VALET_DIRS = {
  root: VALET_HOME,
  config: join(VALET_HOME, 'config'),
  cacheBriefing: join(VALET_HOME, 'cache', 'briefing'),
  cacheTts: join(VALET_HOME, 'cache', 'tts'),
  history: join(VALET_HOME, 'history'),
  logs: join(VALET_HOME, 'logs'),
} as const;

/**
 * ~/.valet-pilot/ 하위 디렉토리를 모두 생성합니다.
 * 이미 존재하는 디렉토리는 건너뜁니다.
 */
export async function ensureValetDirs(): Promise<void> {
  for (const dir of Object.values(VALET_DIRS)) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

/**
 * 특정 디렉토리 경로를 반환합니다.
 */
export function getValetDir(key: keyof typeof VALET_DIRS): string {
  return VALET_DIRS[key];
}
