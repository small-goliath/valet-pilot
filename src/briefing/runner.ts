// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 브리핑 실행기
//  BGM 타이밍에 맞춰 환영 인사 → 힘찬 선언 → 관심사 리포트를
//  순서대로 재생합니다. 모든 오디오는 캐시에서만 가져옵니다.
// ────────────────────────────────────────────────────────────────

import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { briefingCache } from '../cache/briefing.js';
import { loadConfig } from '../config/manager.js';
import { InterestRegistry } from '../interests/registry.js';
import { ttsManager } from '../tts/manager.js';
import * as player from '../tts/player.js';
import type { BgmConfig, Interest } from '../types/config.js';

export interface BriefingRunOptions {
  dry?: boolean;    // true: 오디오 재생 없이 텍스트만 출력
  noTts?: boolean;  // true: TTS 음성 출력 비활성화
  noBgm?: boolean;  // true: BGM 재생 비활성화
}

// ── 타이밍 상수 ──────────────────────────────────────────────────

/** BGM 재생 시작 후 환영 인사 TTS 가 시작될 때까지 최대 대기 (ms) */
const BGM_START_GRACE_MS = 300;

// ── BriefingRunner ───────────────────────────────────────────────

export class BriefingRunner {
  private _isRunning = false;
  private _opts: BriefingRunOptions = {};

  /** 브리핑이 현재 실행 중인지 여부를 반환합니다. */
  isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * 전체 브리핑 파이프라인을 실행합니다.
   *
   * 실행 순서:
   *  1. BGM 재생 시작 (백그라운드)
   *  2. 환영 인사 TTS (0초 ~ greeting_end)
   *  3. 힘찬 선언 TTS (shout_start ~ shout_end)
   *  4. 관심사 리포트 순서대로 재생 (report_start~)
   *  5. 리포트 완료 시 BGM fade-out
   *  6. max_duration 초과 시 BGM 강제 종료
   */
  async run(opts: BriefingRunOptions = {}): Promise<void> {
    if (this._isRunning) {
      return;
    }
    this._isRunning = true;
    this._opts = opts;

    try {
      await this._runPipeline();
    } finally {
      this._isRunning = false;
      this._opts = {};
    }
  }

  /** dry/noTts 모드일 때 텍스트 출력, 아닐 때 TTS 재생 */
  private async _speak(text: string): Promise<void> {
    if (!text?.trim()) return;
    if (this._opts.dry || this._opts.noTts) {
      console.log(chalk.cyan(`[TTS] ${text}`));
      return;
    }
    await ttsManager.speak(text);
  }

  // ── 내부 파이프라인 ─────────────────────────────────────────────

  private async _runPipeline(): Promise<void> {
    const config = await loadConfig();
    const { bgm } = config;
    const userName = config.agent.user_name;
    const interests = config.interests;

    // BGM 재생 시작 시각 (타이밍 기준점)
    const bgmStartedAt = Date.now();

    const skipAudio = this._opts.dry || this._opts.noBgm;

    // 1. BGM 재생 (비동기 — 백그라운드에서 재생, 에러 무시)
    let bgmPromise: Promise<void> | null = null;
    const hasBgm = !skipAudio && bgm.file && existsSync(bgm.file);

    if (hasBgm) {
      if (this._opts.dry) {
        console.log(chalk.dim(`[BGM] ${bgm.file} 재생 시작`));
      } else {
        bgmPromise = player.playBgmDucked(bgm.file, bgm.report_start, 0.35, 1.5).catch(() => {});
      }
    } else if (!bgm.file || !existsSync(bgm.file)) {
      if (!this._opts.dry) {
        console.log(chalk.dim('BGM 파일 없음 — BGM 없이 진행합니다.'));
      }
    }

    // BGM 시작 grace period 대기 (최대 300ms)
    const elapsed = Date.now() - bgmStartedAt;
    if (elapsed < BGM_START_GRACE_MS) {
      await sleep(BGM_START_GRACE_MS - elapsed);
    }

    // 2. 환영 인사 TTS (greeting_end 이전)
    await this._playGreeting(userName, bgm, bgmStartedAt);

    // 3. 힘찬 선언 TTS (shout_start ~ shout_end)
    await this._playShout(bgm, bgmStartedAt);

    // 4. 관심사 리포트 (report_start~)
    await this._waitUntil(bgmStartedAt, bgm.report_start * 1000);
    await this._playReports(interests, bgm, bgmStartedAt);

    // 5. BGM 마무리 (fade-out 또는 stop)
    if (hasBgm && bgmPromise) {
      const totalElapsed = Date.now() - bgmStartedAt;
      const maxMs = bgm.max_duration * 1000;

      if (totalElapsed < maxMs) {
        const remaining = maxMs - totalElapsed;
        player.stopBgm();
        void bgmPromise;
        await player.playBgmWithFadeOut(bgm.file, remaining).catch(() => {});
      } else {
        player.stopBgm();
      }
    }
  }

  // ── 환영 인사 ────────────────────────────────────────────────────

  private async _playGreeting(
    userName: string,
    bgm: BgmConfig,
    bgmStartedAt: number,
  ): Promise<void> {
    const greetingText = `안녕하세요 ${userName}, 오늘도 힘찬 하루 시작해봅시다!`;
    const greetingDeadlineMs = bgm.greeting_end * 1000;

    // 캐시된 TTS 오디오가 있으면 직접 재생, 없으면 speak()
    const cachedEntry = await briefingCache.get('greeting');
    if (!this._opts.dry && cachedEntry?.tts_audio_path && existsSync(cachedEntry.tts_audio_path)) {
      await player.play(cachedEntry.tts_audio_path).catch(() => {});
    } else {
      await this._speak(greetingText);
    }

    // greeting_end 까지 시간이 남아있으면 대기
    await this._waitUntil(bgmStartedAt, greetingDeadlineMs);
  }

  // ── 힘찬 선언 ────────────────────────────────────────────────────

  private async _playShout(bgm: BgmConfig, bgmStartedAt: number): Promise<void> {
    await this._waitUntil(bgmStartedAt, bgm.shout_start * 1000);

    const shoutText = '자, 시작합니다!';

    const cachedEntry = await briefingCache.get('shout');
    if (!this._opts.dry && cachedEntry?.tts_audio_path && existsSync(cachedEntry.tts_audio_path)) {
      await player.play(cachedEntry.tts_audio_path).catch(() => {});
    } else {
      await this._speak(shoutText);
    }

    // shout_end 까지 대기
    await this._waitUntil(bgmStartedAt, bgm.shout_end * 1000);
  }

  // ── 관심사 리포트 ────────────────────────────────────────────────

  private async _playReports(
    interests: Interest[],
    bgm: BgmConfig,
    bgmStartedAt: number,
  ): Promise<void> {
    for (const interest of interests) {
      // max_duration 초과 시 즉시 중단
      if (Date.now() - bgmStartedAt >= bgm.max_duration * 1000) {
        break;
      }

      try {
        await this._playOneReport(interest);
      } catch {
        const label = interest.name ?? interest.type;
        await this._speak(`${label} 정보를 가져오지 못했습니다.`);
      }
    }
  }

  private async _playOneReport(interest: Interest): Promise<void> {
    const label = interest.name ?? interest.type;
    let cachedEntry = await briefingCache.get(interest.type);

    // 캐시 미스 시 실시간 fetch (dry 모드 또는 데몬 미실행 상황 대응)
    if (!cachedEntry) {
      try {
        const registry = new InterestRegistry();
        const reports = await registry.fetchAll();
        const report = reports.find((r) => r.type === interest.type);
        if (report?.summary) {
          await this._speak(report.summary);
          return;
        }
      } catch {
        // fetch 실패 시 fallback 메시지로 계속
      }
      await this._speak(`${label} 정보를 가져오지 못했습니다.`);
      return;
    }

    const summary = cachedEntry.data.summary || `${label} 정보를 가져오지 못했습니다.`;

    // tts_audio_path 가 있고 파일이 존재하면 직접 재생 (dry 모드 제외)
    if (!this._opts.dry && cachedEntry.tts_audio_path && existsSync(cachedEntry.tts_audio_path)) {
      await player.play(cachedEntry.tts_audio_path).catch(() => this._speak(summary));
    } else {
      await this._speak(summary);
    }
  }

  // ── 타이밍 헬퍼 ─────────────────────────────────────────────────

  /**
   * bgmStartedAt 기준으로 targetMs 시점이 될 때까지 대기합니다.
   * 이미 지났으면 즉시 반환합니다.
   */
  private async _waitUntil(bgmStartedAt: number, targetMs: number): Promise<void> {
    const remaining = targetMs - (Date.now() - bgmStartedAt);
    if (remaining > 0) {
      await sleep(remaining);
    }
  }
}

/** 싱글턴 인스턴스 */
export const briefingRunner = new BriefingRunner();

// ── 내부 유틸 ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
