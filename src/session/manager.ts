// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 음성 대화 세션 관리자
//  STT → AI(stream) → TTS 루프 실행
// ────────────────────────────────────────────────────────────────

import { EventEmitter } from 'node:events';
import { loadConfig } from '../config/manager.js';
import { SttManager } from '../stt/manager.js';
import { AIManager } from '../ai/manager.js';
import { TtsManager } from '../tts/manager.js';
import { HistoryManager } from '../history/manager.js';
import { buildSystemPrompt, turnsToMessages } from './context.js';
import type { ChatMessage } from '../types/ai.js';
import type { Session, SessionState, Turn, TriggerType } from '../types/session.js';

// ── 상수 ────────────────────────────────────────────────────────

/** 세션에 보존할 최대 턴 수 */
const MAX_TURNS = 50;

/** 저신뢰 발화 재확인 최대 횟수 */
const MAX_LOW_CONFIDENCE_RETRIES = 3;

// ── SessionManager ───────────────────────────────────────────────

export class SessionManager extends EventEmitter {
  private session: Session | null = null;
  private stt: SttManager;
  private ai: AIManager | null = null;
  private tts: TtsManager;
  private history: HistoryManager;

  /** 자동 종료 타이머 핸들 */
  private autoEndTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.stt = new SttManager();
    this.tts = new TtsManager();
    this.history = new HistoryManager();
  }

  // ── 공개 API ──────────────────────────────────────────────────

  /**
   * 새 세션을 시작합니다.
   * 이미 활성 세션이 있으면 무시합니다.
   *
   * @param triggerType 세션을 시작한 트리거 종류
   */
  async start(triggerType: TriggerType): Promise<void> {
    if (this.isActive()) return;

    const config = await loadConfig();

    this.ai = new AIManager(config.agent);
    await this.tts.loadDefaults();

    this.session = {
      id: crypto.randomUUID(),
      triggerType,
      startedAt: new Date().toISOString(),
      state: 'idle',
      turns: [],
    };

    this.resetAutoEndTimer(config.session.auto_end_minutes);
    this.setState('listening');

    // 루프는 비동기로 실행 — 호출자를 블로킹하지 않습니다
    this.listen().catch((err) => {
      console.error('[SessionManager] listen 루프 오류:', err);
      this.stop();
    });
  }

  /**
   * 현재 세션을 종료합니다.
   * 이미 종료 중이거나 세션이 없으면 무시합니다.
   *
   * 순서:
   * 1. 'ending' 상태로 전환
   * 2. 자동 종료 타이머 해제
   * 3. farewell_enabled 이면 종료 인사 TTS 재생
   * 4. HistoryManager.save() 로 히스토리 저장
   * 5. 'ended' 이벤트 emit (TriggerManager 가 재활성화 책임)
   */
  stop(): void {
    if (!this.session || this.session.state === 'ending') return;

    this.setState('ending');
    this.clearAutoEndTimer();

    // 세션 참조를 즉시 캡처하고 인스턴스 필드를 null 로 초기화합니다.
    // 이후 비동기 종료 작업은 캡처된 참조로 진행합니다.
    const endedSession = { ...this.session, turns: [...this.session.turns] };
    this.session = null;

    // 비동기 종료 작업을 백그라운드에서 실행합니다.
    void this.runShutdown(endedSession);
  }

  /** stop() 에서 분리된 비동기 종료 시퀀스 */
  private async runShutdown(endedSession: Session): Promise<void> {
    const endedAt = new Date();

    // ── 1. 종료 인사 ────────────────────────────────────────────────
    try {
      const config = await loadConfig();

      if (config.session.farewell_enabled) {
        const nickname = config.agent.nickname;
        await this.tts.speak(`수고하셨습니다, ${nickname}님. 좋은 하루 되세요.`);
      }

      // ── 2. 히스토리 저장 ─────────────────────────────────────────
      await this.history.save(endedSession, endedAt);
    } catch (err) {
      console.error('[SessionManager] 종료 처리 중 오류:', err);
    }

    // ── 3. 'ended' 이벤트 emit ────────────────────────────────────
    // TriggerManager 가 이 이벤트를 수신하여 트리거 감지를 재활성화합니다.
    this.emit('ended', endedSession);
  }

  /**
   * 세션이 현재 활성 상태인지 반환합니다.
   * ('ending' 상태는 이미 종료 절차 중이므로 비활성으로 간주합니다.)
   */
  isActive(): boolean {
    return this.session !== null && this.session.state !== 'ending';
  }

  /**
   * 현재 세션 컨텍스트를 AI API용 ChatMessage 배열로 반환합니다.
   * 시스템 프롬프트가 맨 앞에 포함됩니다.
   */
  async getContext(): Promise<ChatMessage[]> {
    const config = await loadConfig();
    const systemPrompt = buildSystemPrompt(config.agent);
    const history = turnsToMessages(this.session?.turns ?? []);

    return [
      { role: 'system', content: systemPrompt },
      ...history,
    ];
  }

  // ── 내부: 메인 루프 ──────────────────────────────────────────

  /**
   * STT → AI → TTS 루프.
   * stop() 이 호출될 때까지 반복합니다.
   */
  private async listen(): Promise<void> {
    let lowConfidenceCount = 0;

    while (this.isActive()) {
      // ── 1. STT: 사용자 발화 감지 ──────────────────────────────
      this.setState('listening');

      let sttText: string;

      try {
        const result = await this.stt.transcribeMic();

        // ── 2. 저신뢰 처리 ─────────────────────────────────────
        if (result.lowConfidence) {
          lowConfidenceCount++;

          if (lowConfidenceCount >= MAX_LOW_CONFIDENCE_RETRIES) {
            lowConfidenceCount = 0;
            await this.tts.speak('텍스트로 입력해주세요.');
            // 연속 실패 후에도 루프를 계속하여 다음 발화를 기다립니다
            continue;
          }

          await this.tts.speak('다시 한번 말씀해주시겠습니까?');
          continue;
        }

        lowConfidenceCount = 0;
        sttText = result.text.trim();
      } catch (err) {
        // STT 자체 오류 — 루프 유지
        console.error('[SessionManager] STT 오류:', err);
        continue;
      }

      if (!sttText) continue;

      // ── 3. 종료 키워드 감지 ────────────────────────────────────
      const config = await loadConfig();
      const lowerText = sttText.toLowerCase();
      const isEndKeyword = config.session.end_keywords.some((kw) =>
        lowerText.includes(kw.toLowerCase()),
      );

      if (isEndKeyword) {
        this.stop();
        return;
      }

      // ── 4. 사용자 턴 기록 ──────────────────────────────────────
      this.addTurn({ role: 'user', content: sttText });
      this.resetAutoEndTimer(config.session.auto_end_minutes);

      // ── 5. AI 응답 스트리밍 ────────────────────────────────────
      this.setState('processing');

      let responseText = '';
      const usedModel = this.ai!.getCurrentModel();

      try {
        const messages = await this.getContext();
        for await (const chunk of this.ai!.stream(messages)) {
          responseText += chunk.delta;
          if (chunk.done) break;
        }
      } catch (err) {
        console.error('[SessionManager] AI 오류:', err);
        await this.tts.speak('죄송합니다. 응답을 가져오지 못했습니다.');
        continue;
      }

      if (!responseText.trim()) continue;

      // ── 6. TTS 출력 ────────────────────────────────────────────
      this.setState('speaking');
      await this.tts.speak(responseText);

      // ── 7. 어시스턴트 턴 기록 ─────────────────────────────────
      this.addTurn({
        role: 'assistant',
        content: responseText,
        model: usedModel,
      });
    }
  }

  // ── 내부: 상태 관리 ──────────────────────────────────────────

  private setState(state: SessionState): void {
    if (!this.session) return;
    this.session.state = state;
  }

  // ── 내부: 턴 관리 ────────────────────────────────────────────

  private addTurn(partial: Omit<Turn, 'timestamp'>): void {
    if (!this.session) return;

    const turn: Turn = {
      ...partial,
      timestamp: new Date().toISOString(),
    };

    this.session.turns.push(turn);

    // 최대 턴 수 초과 시 가장 오래된 턴 제거
    if (this.session.turns.length > MAX_TURNS) {
      this.session.turns.splice(0, this.session.turns.length - MAX_TURNS);
    }
  }

  // ── 내부: 자동 종료 타이머 ───────────────────────────────────

  private resetAutoEndTimer(minutes: number): void {
    this.clearAutoEndTimer();

    if (minutes <= 0) return;

    this.autoEndTimer = setTimeout(() => {
      if (this.isActive()) {
        console.log(`[SessionManager] ${minutes}분 무응답으로 자동 종료합니다.`);
        this.stop();
      }
    }, minutes * 60 * 1000);
  }

  private clearAutoEndTimer(): void {
    if (this.autoEndTimer !== null) {
      clearTimeout(this.autoEndTimer);
      this.autoEndTimer = null;
    }
  }
}
