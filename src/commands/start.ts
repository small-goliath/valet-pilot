import { spawn } from 'node:child_process';
import { openSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import { ensureValetDirs } from '../utils/dirs.js';
import { VALET_DIRS } from '../utils/dirs.js';
import { Daemon } from '../daemon/daemon.js';
import { uiServer } from '../uiserver/server.js';
import { readPid, writePid, isRunning, writeUiPid, removeUiPid } from '../daemon/pid.js';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

export interface StartOptions {
  config?: string;
  daemon?: boolean;
  noUi?: boolean;
}

/**
 * `valet-pilot start` 커맨드 핸들러
 *
 * 시작 순서 (UI 모드):
 *  1. UIServer.start()  — Unix socket LISTEN 상태 확보
 *  2. Daemon.start()    — 트리거/브리핑/세션 시작
 *  3. electron spawn    — UIServer 준비 후 앱 창 열기
 *
 * --daemon (-d): 백그라운드 프로세스로 포크
 * --no-ui:      UI 없이 CLI 전용 모드
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
    const args = process.argv.slice(1);
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

    // 1. UIServer 시작 (소켓 LISTEN 확보) — Electron보다 먼저 시작
    const useUi = !options.noUi;
    if (useUi) {
      try {
        await uiServer.start();
        console.log(chalk.dim('UI 서버 시작됨'));
      } catch (err) {
        console.warn(chalk.yellow('UI 서버 시작 실패 — UI 없이 진행합니다.'), err);
      }
    }

    // 2. PID 파일 저장 + Daemon 시작
    await writePid(process.pid);
    const daemon = new Daemon();
    await daemon.start();

    // 3. Electron UI 창 실행 (UIServer 준비 완료 후)
    if (useUi && uiServer.isActive()) {
      await spawnElectron();
    }

    console.log(chalk.green('Valet Pilot이 시작되었습니다.'));
    console.log(chalk.dim('박수를 두 번 치거나 wake word를 말하면 브리핑이 시작됩니다.'));
  } catch (err) {
    uiServer.stop();
    console.error(chalk.red('시작 중 오류가 발생했습니다:'), err);
    process.exit(1);
  }
}

// ── Electron spawn 헬퍼 ───────────────────────────────────────────

async function spawnElectron(): Promise<void> {
  try {
    // electron 패키지의 바이너리 경로 resolve
    const req = createRequire(import.meta.url);
    const electronPath = req('electron') as string;
    const mainPath = resolve(new URL('../main/main.js', import.meta.url).pathname);

    if (!existsSync(mainPath)) {
      console.warn(chalk.yellow('Electron main.js 가 빌드되지 않았습니다. --no-ui 모드로 실행됩니다.'));
      return;
    }

    const child = spawn(electronPath, [mainPath], {
      detached: false,
      stdio: 'ignore',
      env: { ...process.env },
    });

    child.unref();
    if (child.pid) {
      await writeUiPid(child.pid);
    }
    console.log(chalk.dim(`Electron UI 시작됨 (PID: ${child.pid})`));
  } catch {
    console.warn(chalk.yellow('Electron을 찾을 수 없습니다. UI 없이 계속 실행됩니다.'));
  }
}
