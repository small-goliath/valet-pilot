import chalk from 'chalk';
import { readPid, removePid, isRunning, readUiPid, removeUiPid } from '../daemon/pid.js';

export interface StopOptions {
  force?: boolean;
}

const WAIT_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 200;

/**
 * Electron UI 프로세스를 종료합니다.
 */
async function killUi(): Promise<void> {
  const uiPid = await readUiPid();
  if (uiPid === null) return;
  try {
    if (isRunning(uiPid)) {
      process.kill(uiPid, 'SIGTERM');
    }
  } catch {
    // 이미 종료된 경우 무시
  } finally {
    await removeUiPid();
  }
}

/**
 * 프로세스가 종료될 때까지 최대 WAIT_TIMEOUT_MS 동안 대기합니다.
 */
async function waitForExit(pid: number): Promise<boolean> {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!isRunning(pid)) return true;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * `valet-pilot stop` 커맨드 핸들러
 * 실행 중인 Valet Pilot 데몬 프로세스를 종료합니다.
 */
export async function runStop(options: StopOptions = {}): Promise<void> {
  console.log(chalk.bold('\nValet Pilot을 종료합니다...\n'));

  try {
    const pid = await readPid();

    if (pid === null) {
      console.log(chalk.yellow('실행 중인 Valet Pilot 프로세스가 없습니다.'));
      return;
    }

    if (!isRunning(pid)) {
      console.log(chalk.yellow('PID 파일은 존재하지만 프로세스가 이미 종료되어 있습니다.'));
      await removePid();
      return;
    }

    // SIGTERM 전송 후 종료 대기
    process.kill(pid, 'SIGTERM');
    process.stdout.write(chalk.dim('종료 대기 중...'));

    const exited = await waitForExit(pid);

    if (exited) {
      process.stdout.write('\n');
      await removePid();
      await killUi();
      console.log(chalk.green('Valet Pilot이 종료되었습니다.') + chalk.dim(` (PID: ${pid})`));
      return;
    }

    // 5초 후에도 살아있으면 SIGKILL 또는 안내
    if (options.force) {
      process.kill(pid, 'SIGKILL');
      await waitForExit(pid);
      process.stdout.write('\n');
      await removePid();
      await killUi();
      console.log(chalk.green('Valet Pilot을 강제 종료했습니다.') + chalk.dim(` (PID: ${pid})`));
    } else {
      process.stdout.write('\n');
      console.log(chalk.yellow('프로세스가 응답하지 않습니다. 강제 종료하려면:'));
      console.log(chalk.dim(`  valet-pilot stop --force`));
    }
  } catch (err) {
    console.error(chalk.red('종료 중 오류가 발생했습니다:'), err);
    process.exit(1);
  }
}
