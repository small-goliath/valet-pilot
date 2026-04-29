import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import chalk from 'chalk';
import { ensureValetDirs } from '../utils/dirs.js';
import { VALET_DIRS } from '../utils/dirs.js';
import { Daemon } from '../daemon/daemon.js';
import { readPid, writePid, isRunning } from '../daemon/pid.js';
import { join } from 'node:path';

export interface StartOptions {
  config?: string;
  daemon?: boolean;
}

/**
 * `valet-pilot start` 커맨드 핸들러
 * Valet Pilot 데몬 프로세스를 시작합니다.
 *
 * --daemon (-d) 플래그가 있으면 백그라운드 프로세스로 포크 후 즉시 반환합니다.
 * 로그는 ~/.valet-pilot/logs/daemon.log 에 기록됩니다.
 */
export async function runStart(options: StartOptions = {}): Promise<void> {
  // 이미 실행 중인지 확인
  const existingPid = await readPid();
  if (existingPid !== null && isRunning(existingPid)) {
    console.log(chalk.yellow('Valet Pilot이 이미 실행 중입니다.') + chalk.dim(` (PID: ${existingPid})`));
    return;
  }

  // ── 백그라운드 모드: 자식 프로세스로 포크 ─────────────────────
  if (options.daemon) {
    await ensureValetDirs();

    const logPath = join(VALET_DIRS.logs, 'daemon.log');
    const logFd = openSync(logPath, 'a');

    // --daemon 없이 동일한 커맨드를 다시 실행 (무한 포크 방지)
    const args = process.argv.slice(1); // [script, 'start', ...]
    const filteredArgs = args.filter((a) => a !== '--daemon' && a !== '-d');

    const child = spawn(process.execPath, filteredArgs, {
      detached: true,
      stdio: ['ignore', logFd, logFd],
    });
    child.unref();

    console.log(chalk.green('Valet Pilot을 백그라운드로 시작했습니다.') + chalk.dim(` (PID: ${child.pid})`));
    console.log(chalk.dim(`로그: ${logPath}`));
    return;
  }

  // ── 포그라운드 모드 ────────────────────────────────────────────
  console.log(chalk.bold('\nValet Pilot을 시작합니다...\n'));

  try {
    await ensureValetDirs();

    if (options.config) {
      console.log(chalk.dim(`설정 파일: ${options.config}`));
    }

    // PID 파일 저장 (Daemon.start() 내에서도 저장하지만 먼저 기록)
    await writePid(process.pid);

    // 데몬 시작
    const daemon = new Daemon();
    await daemon.start();

    console.log(chalk.green('Valet Pilot이 시작되었습니다.'));
    console.log(chalk.dim('박수를 두 번 치거나 wake word를 말하면 브리핑이 시작됩니다.'));
  } catch (err) {
    console.error(chalk.red('시작 중 오류가 발생했습니다:'), err);
    process.exit(1);
  }
}
