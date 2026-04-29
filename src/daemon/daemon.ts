// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 핵심 데몬 로직
//  TriggerManager, CacheScheduler, BriefingRunner, SessionManager를
//  통합하여 데몬 프로세스를 관리합니다.
// ────────────────────────────────────────────────────────────────

import chalk from 'chalk';
import { ensureValetDirs } from '../utils/dirs.js';
import { CacheScheduler } from '../cache/scheduler.js';
import { TriggerManager } from '../trigger/manager.js';
import { BriefingRunner } from '../briefing/runner.js';
import { SessionManager } from '../session/manager.js';
import { writePid, removePid } from './pid.js';
import { uiServer } from '../uiserver/server.js';
import type { TriggerEvent } from '../types/trigger.js';

// ── Daemon ────────────────────────────────────────────────────────

export class Daemon {
  private readonly cacheScheduler: CacheScheduler;
  private readonly triggerManager: TriggerManager;
  private readonly briefingRunner: BriefingRunner;
  private readonly sessionManager: SessionManager;
  private running = false;

  constructor() {
    this.cacheScheduler = new CacheScheduler();
    this.triggerManager = new TriggerManager();
    this.briefingRunner = new BriefingRunner();
    this.sessionManager = new SessionManager();
  }

  // ── 공개 API ─────────────────────────────────────────────────

  /**
   * 데몬을 초기화하고 시작합니다.
   *
   * 순서:
   * 1. ensureValetDirs() — 필요한 디렉토리 생성
   * 2. CacheScheduler.start() — 브리핑 캐시 갱신 시작
   * 3. TriggerManager.start() — 트리거 감지 시작
   * 4. 이벤트 핸들러 등록
   * 5. 시그널 핸들러 등록
   * 6. PID 파일 저장
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // 1. 디렉토리 보장
    await ensureValetDirs();

    // 2. 캐시 스케줄러 시작
    await this.cacheScheduler.start();

    // 3. 이벤트 핸들러 먼저 등록 (트리거 시작 전에 등록해야 오류 이벤트를 수신할 수 있음)
    this.registerEventHandlers();

    // 4. 시그널 핸들러 등록
    this.registerSignalHandlers();

    // 5. 트리거 감지 시작
    await this.triggerManager.start();

    // 6. PID 파일 저장
    await writePid(process.pid);

    // 7. UI 이벤트 훅 등록
    this.registerUiEventHooks();

    console.log(`[Daemon] 시작됨 (PID: ${process.pid})`);
  }

  /**
   * 데몬을 graceful하게 종료합니다.
   *
   * 순서:
   * 1. TriggerManager.stop()
   * 2. CacheScheduler.stop()
   * 3. SessionManager.stop() (활성 세션이 있으면)
   * 4. PID 파일 삭제
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    console.log('[Daemon] 종료 중...');

    // 트리거 감지 중지
    this.triggerManager.stop();

    // 캐시 스케줄러 중지
    this.cacheScheduler.stop();

    // 활성 세션이 있으면 종료
    if (this.sessionManager.isActive()) {
      this.sessionManager.stop();
    }

    // PID 파일 삭제
    await removePid();

    console.log('[Daemon] 종료 완료');
  }

  // ── 내부: 이벤트 핸들러 ───────────────────────────────────────

  private registerEventHandlers(): void {
    // TriggerManager 'trigger' 이벤트 → BriefingRunner.run() 실행
    this.triggerManager.on('trigger', (event: TriggerEvent) => {
      console.log(`[Daemon] 트리거 감지: ${event.type}`);

      // 브리핑 또는 세션이 이미 실행 중이면 무시
      if (this.briefingRunner.isRunning() || this.sessionManager.isActive()) {
        return;
      }

      // 브리핑 실행 중 트리거 비활성화
      this.triggerManager.setBusy(true);

      this.briefingRunner.run().finally(() => {
        // 브리핑 완료 후 세션 시작 (TriggerManager는 'ended' 이벤트 후 재활성화)
        this.sessionManager.start(event.type).catch((err) => {
          console.error('[Daemon] 세션 시작 오류:', err);
          // 세션 시작 실패 시 트리거 재활성화
          this.triggerManager.setBusy(false);
        });
      });
    });

    // SessionManager 'ended' 이벤트 → TriggerManager 재활성화
    this.sessionManager.on('ended', () => {
      console.log('[Daemon] 세션 종료 — 트리거 재활성화');
      this.triggerManager.setBusy(false);
    });

    // TriggerManager 오류 로깅 (치명적이지 않은 오류 — 데몬은 계속 실행)
    this.triggerManager.on('error', (err: Error) => {
      console.warn(chalk.yellow(`[Daemon] 트리거 초기화 경고: ${err.message}`));
      console.warn(chalk.dim('  해당 트리거는 비활성화되고 나머지 트리거로 계속 실행됩니다.'));
    });
  }

  // ── 내부: UI 이벤트 훅 ────────────────────────────────────────

  /**
   * TtsManager / SttManager / BriefingRunner 이벤트를 구독하여
   * UIServer를 통해 Electron 렌더러에 상태를 전달합니다.
   */
  private registerUiEventHooks(): void {
    if (!uiServer.isActive()) return;

    // BriefingRunner: 브리핑 시작/종료 → UI 상태 전환
    this.briefingRunner.on('start', () => {
      uiServer.emit('state-change', 'briefing');
    });
    this.briefingRunner.on('end', () => {
      uiServer.emit('state-change', 'idle');
    });

    // SessionManager: 세션 상태 변경 → UI 상태 매핑
    this.sessionManager.on('stateChange', (state: string) => {
      const uiState = this.mapSessionState(state);
      uiServer.emit('state-change', uiState);
    });

    // TtsManager (SessionManager 내부): AI 발화 텍스트 전달
    this.sessionManager.on('speak', (text: string) => {
      uiServer.emit('ai-text', text);
    });

    // SttManager: 사용자 발화 텍스트 전달
    this.sessionManager.on('transcript', (payload: { text: string; final: boolean }) => {
      uiServer.emit(
        payload.final ? 'user-text-final' : 'user-text',
        payload.text,
      );
    });
  }

  /** SessionState → UI 상태 매핑 */
  private mapSessionState(state: string): string {
    switch (state) {
      case 'listening': return 'session-listening';
      case 'processing':
      case 'speaking': return 'session-speaking';
      case 'ending':
      case 'idle':
      default: return 'idle';
    }
  }

  // ── 내부: 시그널 핸들러 ───────────────────────────────────────

  private registerSignalHandlers(): void {
    // SIGHUP: config 리로드 (TriggerManager가 자체적으로 처리)
    process.on('SIGHUP', () => {
      console.log('[Daemon] SIGHUP 수신 — 설정을 리로드합니다.');
      // TriggerManager는 자체 SIGHUP 핸들러로 config를 리로드합니다.
    });

    // SIGTERM/SIGINT: graceful shutdown
    const shutdown = () => {
      console.log('\n[Daemon] 종료 시그널 수신');
      this.stop().then(() => {
        process.exit(0);
      }).catch((err) => {
        console.error('[Daemon] 종료 중 오류:', err);
        process.exit(1);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}
