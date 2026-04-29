// ────────────────────────────────────────────────────────────────
//  Valet Pilot — macOS Keychain (security CLI) 래퍼
//  keytar 패키지 미사용 (아카이브됨, Node.js 24 비호환)
// ────────────────────────────────────────────────────────────────

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** security CLI 실행 오류를 래핑하는 에러 클래스 */
export class KeychainError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'KeychainError';
  }
}

/**
 * macOS Keychain에 비밀 값을 저장합니다.
 * 이미 존재하면 업데이트합니다.
 *
 * @param service  Keychain 항목의 서비스 이름 (예: "valet-pilot")
 * @param account  계정 이름 (예: "redmine-api-key")
 * @param password 저장할 비밀 값
 */
export async function setSecret(
  service: string,
  account: string,
  password: string,
): Promise<void> {
  // 기존 항목이 있으면 먼저 삭제 (update 지원을 위해)
  try {
    await deleteSecret(service, account);
  } catch {
    // 항목이 없으면 무시
  }

  try {
    await execFileAsync('security', [
      'add-generic-password',
      '-s', service,
      '-a', account,
      '-w', password,
    ]);
  } catch (err) {
    throw new KeychainError(
      `Keychain에 비밀 값을 저장하지 못했습니다 (service=${service}, account=${account})`,
      err,
    );
  }
}

/**
 * macOS Keychain에서 비밀 값을 읽어옵니다.
 *
 * @param service  Keychain 항목의 서비스 이름
 * @param account  계정 이름
 * @returns 저장된 비밀 값, 없으면 null
 */
export async function getSecret(service: string, account: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-s', service,
      '-a', account,
      '-w', // 비밀 값만 stdout으로 출력
    ]);
    return stdout.trim();
  } catch (err) {
    // 항목이 없을 때 security 명령은 exit code 44로 종료
    if (isNotFoundError(err)) {
      return null;
    }
    throw new KeychainError(
      `Keychain에서 비밀 값을 읽지 못했습니다 (service=${service}, account=${account})`,
      err,
    );
  }
}

/**
 * macOS Keychain에서 비밀 값을 삭제합니다.
 * 항목이 없으면 아무 동작도 하지 않습니다.
 *
 * @param service  Keychain 항목의 서비스 이름
 * @param account  계정 이름
 */
export async function deleteSecret(service: string, account: string): Promise<void> {
  try {
    await execFileAsync('security', [
      'delete-generic-password',
      '-s', service,
      '-a', account,
    ]);
  } catch (err) {
    if (isNotFoundError(err)) {
      return; // 이미 없는 항목이므로 무시
    }
    throw new KeychainError(
      `Keychain에서 비밀 값을 삭제하지 못했습니다 (service=${service}, account=${account})`,
      err,
    );
  }
}

// ── 내부 헬퍼 ──────────────────────────────────────────────────

/**
 * security CLI 가 "항목 없음" 오류로 종료했는지 판별합니다.
 * exit code 44 또는 stderr에 "could not be found" 포함 여부로 확인합니다.
 */
function isNotFoundError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const e = err as { code?: number; stderr?: string };
    if (e.code === 44) return true;
    if (typeof e.stderr === 'string' && e.stderr.includes('could not be found')) return true;
  }
  return false;
}
