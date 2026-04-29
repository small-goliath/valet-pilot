// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 앱 제어 명령 실행기
//  Level 1: open / quit
//  Level 2: AppleScript activate
//  Level 3: JXA (@jxa/run) 또는 osascript CLI
// ────────────────────────────────────────────────────────────────

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AppControlCommand, AppControlResult } from '../types/appcontrol.js';

const execFileAsync = promisify(execFile);

// ── Level 3 앱별 JXA 스크립트 빌더 ──────────────────────────────

function buildJxaScript(cmd: AppControlCommand): string {
  const { appName, action, args = [] } = cmd;
  const lowerApp = appName.toLowerCase();

  // Chrome 전용 조작
  if (lowerApp === 'chrome' || lowerApp === 'google chrome') {
    if (action === 'newTab') {
      return `
        const chrome = Application('Google Chrome');
        chrome.activate();
        const win = chrome.windows[0];
        const tab = chrome.Tab({ url: 'chrome://newtab' });
        win.tabs.push(tab);
      `;
    }
    if (action === 'openUrl' && args[0]) {
      const url = args[0];
      return `
        const chrome = Application('Google Chrome');
        chrome.activate();
        const win = chrome.windows[0];
        const tab = chrome.Tab({ url: '${url}' });
        win.tabs.push(tab);
      `;
    }
  }

  // VSCode 전용 조작
  if (lowerApp === 'vscode' || lowerApp === 'visual studio code' || lowerApp === 'code') {
    if (action === 'openFile' && args[0]) {
      const filePath = args[0];
      return `
        const app = Application.currentApplication();
        app.includeStandardAdditions = true;
        app.doShellScript('open -a "Visual Studio Code" "${filePath}"');
      `;
    }
  }

  // 범용 osascript 스크립트 fallback
  return `
    const app = Application('${appName}');
    app.activate();
  `;
}

// ── AppControlExecutor ────────────────────────────────────────────

export class AppControlExecutor {
  /**
   * AppControlCommand 를 받아 macOS 앱을 제어합니다.
   */
  async execute(cmd: AppControlCommand): Promise<AppControlResult> {
    try {
      switch (cmd.level) {
        case 1:
          return await this.executeLevel1(cmd);
        case 2:
          return await this.executeLevel2(cmd);
        case 3:
          return await this.executeLevel3(cmd);
        default: {
          const _exhaustive: never = cmd.level;
          return { success: false, message: `알 수 없는 제어 수준: ${String(_exhaustive)}` };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `실행 오류: ${message}` };
    }
  }

  // ── Level 1: 앱 실행 / 종료 ─────────────────────────────────

  private async executeLevel1(cmd: AppControlCommand): Promise<AppControlResult> {
    const { appName, action } = cmd;

    if (action === 'open') {
      await execFileAsync('open', ['-a', appName]);
      return { success: true, message: `${appName} 을(를) 실행했습니다.` };
    }

    if (action === 'quit') {
      const script = `quit app "${appName}"`;
      await execFileAsync('osascript', ['-e', script]);
      return { success: true, message: `${appName} 을(를) 종료했습니다.` };
    }

    return { success: false, message: `Level 1 에서 지원하지 않는 동작: ${action}` };
  }

  // ── Level 2: 앱 활성화 (포커스) ─────────────────────────────

  private async executeLevel2(cmd: AppControlCommand): Promise<AppControlResult> {
    const { appName, action } = cmd;

    if (action === 'activate') {
      const script = `tell application "${appName}" to activate`;
      await execFileAsync('osascript', ['-e', script]);
      return { success: true, message: `${appName} 을(를) 활성화했습니다.` };
    }

    return { success: false, message: `Level 2 에서 지원하지 않는 동작: ${action}` };
  }

  // ── Level 3: 앱 내부 조작 (JXA / osascript) ─────────────────

  private async executeLevel3(cmd: AppControlCommand): Promise<AppControlResult> {
    // @jxa/run 동적 임포트 시도 → 없으면 osascript CLI fallback
    try {
      const { runJXACode } = await import('@jxa/run');
      const script = buildJxaScript(cmd);
      await runJXACode(script);
      return { success: true, message: `${cmd.appName} - ${cmd.action} 을(를) 실행했습니다.` };
    } catch (jxaErr) {
      // @jxa/run 모듈 없음 또는 스크립트 오류 → osascript CLI fallback
      const isModuleNotFound =
        jxaErr instanceof Error && jxaErr.message.includes('Cannot find package');

      if (!isModuleNotFound) {
        // 모듈은 있지만 스크립트 자체 오류 → 실패 반환
        const message = jxaErr instanceof Error ? jxaErr.message : String(jxaErr);
        return { success: false, message: `JXA 실행 오류: ${message}` };
      }

      // osascript -l JavaScript CLI fallback
      const script = buildJxaScript(cmd);
      await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script]);
      return { success: true, message: `${cmd.appName} - ${cmd.action} 을(를) 실행했습니다.` };
    }
  }
}
