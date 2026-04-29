import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { VALET_DIRS } from '../utils/dirs.js';
import { readPid, isRunning } from '../daemon/pid.js';

export interface StatusOptions {
  json?: boolean;
}

export interface ValetStatus {
  initialized: boolean;
  running: boolean;
  pid: number | null;
  configExists: boolean;
  dirs: Record<string, boolean>;
  version: string;
}

/**
 * `valet-pilot status` 커맨드 핸들러
 * 현재 Valet Pilot의 상태를 출력합니다.
 */
export async function runStatus(options: StatusOptions = {}): Promise<void> {
  const status = await collectStatus();

  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  printStatus(status);
}

async function collectStatus(): Promise<ValetStatus> {
  const dirs: Record<string, boolean> = {};
  for (const [key, path] of Object.entries(VALET_DIRS)) {
    dirs[key] = existsSync(path);
  }

  const configExists = existsSync(join(VALET_DIRS.config, 'config.yaml'));
  const initialized = dirs['root'] ?? false;

  // PID 파일 확인으로 실제 데몬 상태 체크
  const pid = await readPid();
  const running = pid !== null && isRunning(pid);

  return {
    initialized,
    running,
    pid: running ? pid : null,
    configExists,
    dirs,
    version: '0.1.0',
  };
}

function printStatus(status: ValetStatus): void {
  console.log(chalk.bold('\nValet Pilot 상태\n'));

  const dot = (ok: boolean) => (ok ? chalk.green('●') : chalk.red('○'));

  console.log(`  ${dot(status.initialized)} 초기화됨`);

  if (status.running && status.pid !== null) {
    console.log(`  ${dot(true)} 실행 중: PID ${status.pid}`);
  } else {
    console.log(`  ${dot(false)} 실행 중이 아닙니다.`);
  }

  console.log(`  ${dot(status.configExists)} 설정 파일 존재`);

  console.log(chalk.bold('\n디렉토리 상태:'));
  for (const [key, exists] of Object.entries(status.dirs)) {
    const path = VALET_DIRS[key as keyof typeof VALET_DIRS];
    console.log(`  ${dot(exists)} ${chalk.dim(path)}`);
  }

  console.log(chalk.dim(`\n버전: ${status.version}`));

  if (!status.initialized) {
    console.log(chalk.yellow('\n초기화가 필요합니다. valet-pilot init 을 실행하세요.'));
  } else if (!status.configExists) {
    console.log(chalk.yellow('\n설정 파일이 없습니다. valet-pilot config 을 실행하세요.'));
  }
}
