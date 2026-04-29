// ────────────────────────────────────────────────────────────────
//  Valet Pilot — PID 파일 관리
//  ~/.valet-pilot/daemon.pid 에 데몬 프로세스 ID를 저장/조회/삭제합니다.
// ────────────────────────────────────────────────────────────────

import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { VALET_HOME } from '../utils/dirs.js';

const PID_FILE = join(VALET_HOME, 'daemon.pid');

/**
 * 현재 프로세스의 PID를 파일에 저장합니다.
 */
export async function writePid(pid: number): Promise<void> {
  await writeFile(PID_FILE, String(pid), 'utf-8');
}

/**
 * PID 파일에서 PID를 읽어 반환합니다.
 * 파일이 없거나 내용이 유효하지 않으면 null을 반환합니다.
 */
export async function readPid(): Promise<number | null> {
  if (!existsSync(PID_FILE)) return null;

  try {
    const content = await readFile(PID_FILE, 'utf-8');
    const pid = parseInt(content.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * PID 파일을 삭제합니다.
 * 파일이 없으면 무시합니다.
 */
export async function removePid(): Promise<void> {
  try {
    await unlink(PID_FILE);
  } catch {
    // 파일이 없으면 무시
  }
}

/**
 * 주어진 PID의 프로세스가 현재 실행 중인지 확인합니다.
 * process.kill(pid, 0)으로 프로세스 존재 여부를 확인합니다.
 */
export function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
