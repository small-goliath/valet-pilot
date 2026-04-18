import { execa } from 'execa';
import fs from 'fs';
import { run as jxaRun } from '@jxa/run';

// JXA 런타임 전용 글로벌 (macOS Automation 환경에서만 실제 존재)
declare function Application(name: string): {
  activate(): void;
  windows: { length: number; [i: number]: { activeTab: { url: string } } };
  Window(): { make(): void };
};

export type ToolName =
  | 'execute_shell'
  | 'read_file'
  | 'write_file'
  | 'open_app'
  | 'chrome_navigate';

export interface ToolCall {
  tool: ToolName;
  params: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  output: string;
}

/**
 * AI에게 전달할 도구 목록 설명 (시스템 프롬프트에 포함)
 */
export const TOOLS_DESCRIPTION = `
사용 가능한 도구:
1. execute_shell: 쉘 명령 실행
   params: { command: string }
   예) { "tool": "execute_shell", "params": { "command": "git log --oneline -5" } }

2. read_file: 파일 내용 읽기
   params: { path: string }
   예) { "tool": "read_file", "params": { "path": "/Users/me/notes.txt" } }

3. write_file: 파일 내용 쓰기
   params: { path: string, content: string }
   예) { "tool": "write_file", "params": { "path": "/tmp/note.txt", "content": "내용" } }

4. open_app: macOS 앱 실행
   params: { app: string }
   앱 이름 예시: "Google Chrome", "Visual Studio Code", "IntelliJ IDEA"
   예) { "tool": "open_app", "params": { "app": "Google Chrome" } }

5. chrome_navigate: Chrome에서 URL 열기
   params: { url: string }
   예) { "tool": "chrome_navigate", "params": { "url": "https://gmail.com" } }
`.trim();

/**
 * 도구 실행
 */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  try {
    switch (call.tool) {
      case 'execute_shell':
        return await runShell(String(call.params.command));

      case 'read_file':
        return readFile(String(call.params.path));

      case 'write_file':
        return writeFile(String(call.params.path), String(call.params.content));

      case 'open_app':
        return await openApp(String(call.params.app));

      case 'chrome_navigate':
        return await chromeNavigate(String(call.params.url));

      default:
        return { success: false, output: `알 수 없는 도구: ${call.tool}` };
    }
  } catch (err) {
    return {
      success: false,
      output: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runShell(command: string): Promise<ToolResult> {
  // 위험 명령 차단
  const blocked = /rm\s+-rf\s+\/|mkfs|dd\s+if=|shutdown|reboot/;
  if (blocked.test(command)) {
    return { success: false, output: '위험한 명령은 실행할 수 없습니다.' };
  }

  const result = await execa('bash', ['-c', command], { timeout: 30000 });
  const output = (result.stdout || result.stderr || '(출력 없음)').slice(0, 2000);
  return { success: true, output };
}

function readFile(filePath: string): ToolResult {
  if (!fs.existsSync(filePath)) {
    return { success: false, output: `파일을 찾을 수 없습니다: ${filePath}` };
  }
  const content = fs.readFileSync(filePath, 'utf-8').slice(0, 3000);
  return { success: true, output: content };
}

function writeFile(filePath: string, content: string): ToolResult {
  fs.writeFileSync(filePath, content, 'utf-8');
  return { success: true, output: `파일 저장 완료: ${filePath}` };
}

async function openApp(appName: string): Promise<ToolResult> {
  // VSCode, IntelliJ는 CLI 방식 우선
  if (/visual studio code|vscode/i.test(appName)) {
    await execa('code', ['.'], { reject: false });
    return { success: true, output: 'VSCode를 열었습니다.' };
  }
  if (/intellij/i.test(appName)) {
    await execa('idea', ['.'], { reject: false });
    return { success: true, output: 'IntelliJ를 열었습니다.' };
  }

  // 나머지는 macOS open 명령
  await execa('open', ['-a', appName]);
  return { success: true, output: `${appName}을(를) 열었습니다.` };
}

async function chromeNavigate(url: string): Promise<ToolResult> {
  // URL 유효성 검사
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { success: false, output: 'URL은 http:// 또는 https://로 시작해야 합니다.' };
  }

  await jxaRun((urlArg: string) => {
    const chrome = Application('Google Chrome');
    chrome.activate();
    if (chrome.windows.length === 0) {
      chrome.Window().make();
    }
    chrome.windows[0].activeTab.url = urlArg;
  }, url);

  return { success: true, output: `Chrome에서 ${url}을(를) 열었습니다.` };
}
