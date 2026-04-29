// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 트리거 오케스트레이터 (TriggerManager)
// ────────────────────────────────────────────────────────────────
//
//  역할:
//    • config 에서 enabled 된 트리거(박수/wake word/키보드)를 동시에 활성화
//    • 어떤 트리거든 감지되면 'trigger' 이벤트 emit (TriggerEvent 포함)
//    • 브리핑 실행 중 추가 트리거 무시 (setBusy)
//    • SIGHUP 시 config 리로드
//
//  이벤트:
//    'trigger'  (event: TriggerEvent) — 트리거 감지 시
//    'error'    (err: Error)          — 초기화 실패 시 (치명적 아님)
// ────────────────────────────────────────────────────────────────

import { EventEmitter } from 'node:events';
import { loadConfig } from '../config/manager.js';
import { ClapDetector } from './clap.js';
import { WakeWordDetector } from './wakeword.js';
import { KeyboardTrigger } from './keyboard.js';
import type { ValetConfig } from '../types/config.js';
import type { TriggerEvent } from '../types/trigger.js';

// ── TriggerManager ───────────────────────────────────────────────

export class TriggerManager extends EventEmitter {
  private config: ValetConfig | null = null;
  private clap: ClapDetector | null = null;
  private wakeWord: WakeWordDetector | null = null;
  private keyboard: KeyboardTrigger | null = null;
  private busy = false;
  private running = false;

  // SIGHUP 핸들러 참조 (제거용)
  private readonly sighupHandler: () => void;

  constructor() {
    super();
    this.sighupHandler = () => {
      void this.reload();
    };
  }

  // ── 공개 API ───────────────────────────────────────────────────

  /**
   * config 를 로드하고 활성화된 트리거를 모두 시작합니다.
   * 이미 실행 중이면 아무 작업도 하지 않습니다.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.config = await loadConfig();
    await this.startTriggers(this.config);

    process.on('SIGHUP', this.sighupHandler);
  }

  /**
   * 모든 트리거를 중지하고 리소스를 해제합니다.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    process.off('SIGHUP', this.sighupHandler);
    this.stopTriggers();
  }

  /**
   * 브리핑 실행 여부를 설정합니다.
   * busy === true 이면 트리거 이벤트가 무시됩니다.
   */
  setBusy(busy: boolean): void {
    this.busy = busy;
  }

  // ── 내부 헬퍼 ─────────────────────────────────────────────────

  private async startTriggers(config: ValetConfig): Promise<void> {
    // 박수 트리거
    if (config.trigger.clap.enabled) {
      const clap = new ClapDetector(config);
      clap.on('clap', () => {
        this.fireTrigger({ type: 'clap', timestamp: Date.now() });
      });
      clap.start();
      this.clap = clap;
    }

    // Wake word 트리거
    if (config.trigger.wake_word.enabled) {
      const wakeWord = new WakeWordDetector(config);
      wakeWord.on('wakeword', (word: string) => {
        this.fireTrigger({
          type: 'wake_word',
          timestamp: Date.now(),
          metadata: { word },
        });
      });
      try {
        await wakeWord.start();
        this.wakeWord = wakeWord;
      } catch (err) {
        // Wake word 초기화 실패 시 오류 전파 (다른 트리거는 계속 동작)
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      }
    }

    // 키보드 트리거
    if (config.trigger.keyboard.enabled) {
      const keyboard = new KeyboardTrigger(config);
      keyboard.on('keyboard', () => {
        this.fireTrigger({ type: 'keyboard', timestamp: Date.now() });
      });
      try {
        keyboard.start();
        this.keyboard = keyboard;
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private stopTriggers(): void {
    this.clap?.stop();
    this.clap = null;

    this.wakeWord?.stop();
    this.wakeWord = null;

    this.keyboard?.stop();
    this.keyboard = null;
  }

  private fireTrigger(event: TriggerEvent): void {
    if (this.busy) return;
    this.emit('trigger', event);
  }

  /** SIGHUP 수신 시 config 를 리로드하고 트리거를 재시작합니다. */
  private async reload(): Promise<void> {
    this.stopTriggers();

    try {
      this.config = await loadConfig();
      await this.startTriggers(this.config);
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }
}
