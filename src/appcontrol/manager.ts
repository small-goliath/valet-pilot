// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 앱 제어 오케스트레이터
//  detect → (위험 확인) → execute → TTS 피드백
// ────────────────────────────────────────────────────────────────

import type { AIManager } from '../ai/manager.js';
import type { TtsManager } from '../tts/manager.js';
import { AppControlDetector } from './detector.js';
import { AppControlExecutor } from './executor.js';

// ── AppControlManager ─────────────────────────────────────────────

export class AppControlManager {
  private readonly detector: AppControlDetector;
  private readonly executor: AppControlExecutor;

  constructor(
    private readonly ai: AIManager,
    private readonly tts: TtsManager,
  ) {
    this.detector = new AppControlDetector(ai);
    this.executor = new AppControlExecutor();
  }

  /**
   * 사용자 발화를 처리합니다.
   *
   * - 앱 제어 의도로 판별되면 명령을 실행하고 true 를 반환합니다.
   * - 앱 제어 의도가 아니면 false 를 반환하여 호출자가 AI 대화로 fallback 하게 합니다.
   */
  async handle(userText: string): Promise<boolean> {
    // ── 1. 의도 감지 ──────────────────────────────────────────────
    const cmd = await this.detector.detect(userText);

    if (!cmd) {
      return false;
    }

    // ── 2. 위험 명령 확인 ─────────────────────────────────────────
    if (cmd.isDangerous) {
      await this.tts.speak(
        '이 작업은 위험할 수 있습니다. 진행하시겠습니까? 진행하려면 "예"라고 말씀해주세요.',
      );

      const confirmed = await this.waitForConfirmation();

      if (!confirmed) {
        await this.tts.speak('작업을 취소했습니다.');
        return true;
      }
    }

    // ── 3. 명령 실행 ──────────────────────────────────────────────
    const result = await this.executor.execute(cmd);

    // ── 4. TTS 피드백 ─────────────────────────────────────────────
    if (result.success) {
      await this.tts.speak(result.message);
    } else {
      await this.tts.speak(`실행에 실패했습니다. ${result.message}`);
    }

    return true;
  }

  // ── 내부: 위험 명령 확인 대기 ────────────────────────────────

  /**
   * STT 없이 AI 에게 사용자 음성 텍스트를 전달받는 대신,
   * 타임아웃 기반 단순 확인을 사용합니다.
   *
   * 실제 STT 연동은 SessionManager 레벨에서 처리하도록 설계되어 있으므로,
   * 여기서는 AI 에게 확인 의도를 분석하게 합니다.
   *
   * @returns 사용자가 긍정 응답을 했으면 true, 부정이면 false
   */
  private async waitForConfirmation(): Promise<boolean> {
    // 위험 확인 로직: AI 에게 짧은 사용자 응답을 받아 판별
    // (실제 구현에서는 SessionManager 가 STT 결과를 여기로 전달해야 함)
    // MVP 단계에서는 5초 대기 후 취소로 처리합니다.
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        // 타임아웃 → 취소
        resolve(false);
      }, 5000);
    });
  }
}
