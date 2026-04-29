// ────────────────────────────────────────────────────────────────
//  Valet Pilot — UI IPC 서버 (Unix Domain Socket)
//  데몬과 Electron UI 간 상태 이벤트를 전달합니다.
//  소켓 경로: ~/.valet-pilot/ui.sock
// ────────────────────────────────────────────────────────────────

import { createServer, type Server, type Socket } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';

// ── 타입 정의 ─────────────────────────────────────────────────────

export type UIEventType =
  | 'state-change'
  | 'ai-text'
  | 'user-text'
  | 'user-text-final';

export type UIState =
  | 'idle'
  | 'briefing'
  | 'session-listening'
  | 'session-speaking';

export interface UIEvent {
  type: UIEventType;
  payload: string;
  timestamp: string;
}

// ── 경로 ─────────────────────────────────────────────────────────

export function getSocketPath(): string {
  return join(homedir(), '.valet-pilot', 'ui.sock');
}

// ── UIServer ─────────────────────────────────────────────────────

export class UIServer {
  private server: Server | null = null;
  private clients: Set<Socket> = new Set();

  /**
   * Unix socket 서버를 시작합니다.
   * 이전 소켓 파일이 남아 있으면 삭제 후 재생성합니다.
   */
  async start(): Promise<void> {
    const socketPath = getSocketPath();

    // 이전 소켓 파일 정리
    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => {
        this.clients.add(socket);

        socket.on('error', () => {
          this.clients.delete(socket);
        });

        socket.on('close', () => {
          this.clients.delete(socket);
        });
      });

      this.server.on('error', reject);

      this.server.listen(socketPath, () => {
        resolve();
      });
    });
  }

  /**
   * UI 이벤트를 연결된 모든 클라이언트에 전송합니다.
   */
  emit(type: UIEventType, payload: string): void {
    if (this.clients.size === 0) return;

    const event: UIEvent = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    const data = JSON.stringify(event) + '\n';

    for (const client of this.clients) {
      try {
        client.write(data);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  /**
   * 서버를 종료하고 소켓 파일을 삭제합니다.
   */
  stop(): void {
    for (const client of this.clients) {
      try {
        client.destroy();
      } catch {
        // 무시
      }
    }
    this.clients.clear();

    this.server?.close();
    this.server = null;

    const socketPath = getSocketPath();
    if (existsSync(socketPath)) {
      try {
        unlinkSync(socketPath);
      } catch {
        // 무시
      }
    }
  }

  isActive(): boolean {
    return this.server !== null;
  }
}

/** 싱글턴 인스턴스 */
export const uiServer = new UIServer();
