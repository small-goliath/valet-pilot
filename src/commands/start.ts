import chalk from 'chalk';
import { ensureValetDirs } from '../utils/dirs.js';
import { Daemon } from '../daemon/daemon.js';
import { readPid, writePid, isRunning } from '../daemon/pid.js';

export interface StartOptions {
  config?: string;
  daemon?: boolean;
}

/**
 * `valet-pilot start` 커맨드 핸들러
 * Valet Pilot 데몬 프로세스를 시작합니다.
 */
export async function runStart(options: StartOptions = {}): Promise<void> {
  // 이미 실행 중인지 확인
  const existingPid = await readPid();
  if (existingPid !== null && isRunning(existingPid)) {
    console.log(chalk.yellow('Valet Pilot이 이미 실행 중입니다.') + chalk.dim(` (PID: ${existingPid})`));
    return;
  }

  console.log(chalk.bold('\nValet Pilot을 시작합니다...\n'));

  try {
    await ensureValetDirs();

    if (options.config) {
      console.log(chalk.dim(`설정 파일: ${options.config}`));
    }

    if (options.daemon) {
      console.log(chalk.dim('데몬 모드로 시작합니다.'));
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
