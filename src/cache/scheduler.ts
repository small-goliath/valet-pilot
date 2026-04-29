// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 브리핑 캐시 백그라운드 갱신 스케줄러
//  config.cache.refresh_interval_minutes 주기로 관심사 데이터를
//  갱신하고 TTS 오디오를 사전 합성합니다.
// ────────────────────────────────────────────────────────────────

import { loadConfig } from '../config/manager.js';
import { InterestRegistry } from '../interests/registry.js';
import { ttsManager } from '../tts/manager.js';
import { getCacheKey, getCachedAudio } from '../tts/cache.js';
import { BriefingCache } from './briefing.js';
import type { BriefingCacheEntry } from '../types/cache.js';
import type { InterestReport } from '../types/interest.js';

/** 갱신 주기 기본값 (분) */
const DEFAULT_REFRESH_INTERVAL_MINUTES = 15;

/** TTL 기본값 (분) */
const DEFAULT_TTL_MINUTES = 30;

/** 최대 stale 허용 시간 기본값 (분) */
const DEFAULT_MAX_STALE_MINUTES = 120;

// ── CacheScheduler ───────────────────────────────────────────────

export class CacheScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly cache: BriefingCache;
  private readonly registry: InterestRegistry;

  constructor(
    cache: BriefingCache = new BriefingCache(),
    registry: InterestRegistry = new InterestRegistry(),
  ) {
    this.cache = cache;
    this.registry = registry;
  }

  /**
   * 스케줄러를 시작합니다.
   * 즉시 1회 갱신을 실행한 뒤 이후 인터벌로 반복합니다.
   * 이미 실행 중이면 기존 인터벌을 중지하고 재시작합니다.
   */
  async start(): Promise<void> {
    if (this.intervalId !== null) {
      this.stop();
    }

    // 즉시 1회 실행
    await this.refresh();

    // 설정에서 갱신 주기를 읽어 인터벌 시작
    const intervalMs = await this.resolveIntervalMs();
    this.intervalId = setInterval(() => {
      void this.refresh();
    }, intervalMs);
  }

  /**
   * 스케줄러를 중지합니다.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 모든 관심사 데이터를 즉시 갱신합니다.
   * - InterestRegistry.fetchAll() 로 병렬 fetch
   * - 각 결과를 BriefingCache.save() 로 저장
   * - TtsManager.presynthesize() 로 TTS 사전 합성 후 tts_audio_path 기록
   * - 갱신 실패 시 last_error 업데이트 (기존 캐시 data 유지)
   */
  async refresh(): Promise<void> {
    let reports: InterestReport[];

    try {
      reports = await this.registry.fetchAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[CacheScheduler] fetchAll 실패: ${message}`);
      return;
    }

    await Promise.allSettled(
      reports.map((report) => this.processReport(report)),
    );
  }

  // ── 내부 헬퍼 ────────────────────────────────────────────────────

  /**
   * 단일 리포트를 처리합니다.
   * 오류 발생 시 기존 캐시의 data 를 유지하고 last_error 를 갱신합니다.
   */
  private async processReport(report: InterestReport): Promise<void> {
    const now = new Date().toISOString();

    // fetch 자체가 error 를 담고 있는 경우
    if (report.error) {
      const existing = await this.cache.load(report.type);
      const entry: BriefingCacheEntry = existing ?? this.makeEntry(report, now);
      entry.last_error = report.error;

      // stale 하지 않으면 기존 data 보존
      if (existing !== null && !this.cache.isStale(existing)) {
        await this.cache.save(entry);
      } else {
        // stale 이거나 캐시가 없으면 오류 상태 그대로 저장
        await this.cache.save({
          ...entry,
          data: report,
          fetched_at: now,
        });
      }
      return;
    }

    // 정상 fetch — TTS 사전 합성
    const ttsAudioPath = await this.tryPresynthesize(report.summary);

    const entry: BriefingCacheEntry = {
      interest_type: report.type,
      data: report,
      fetched_at: now,
      ttl_minutes: DEFAULT_TTL_MINUTES,
      max_stale_minutes: DEFAULT_MAX_STALE_MINUTES,
      tts_audio_path: ttsAudioPath ?? undefined,
    };

    await this.cache.save(entry);
  }

  /**
   * TTS 사전 합성을 시도하고 캐시된 오디오 파일 경로를 반환합니다.
   * 합성 또는 경로 조회에 실패하면 null 을 반환합니다.
   */
  private async tryPresynthesize(summary: string): Promise<string | null> {
    if (!summary) return null;

    try {
      await ttsManager.presynthesize(summary);

      // presynthesize 는 void 를 반환하므로, 동일한 캐시 키로 경로를 조회합니다.
      // TtsManager 의 기본 voice/language 를 읽어 캐시 키를 계산합니다.
      const config = await loadConfig();
      const voice = config.agent.voice ?? 'female-01';
      const language = config.agent.language ?? 'korean';
      const cacheKey = getCacheKey(summary, voice, language);
      return getCachedAudio(cacheKey);
    } catch {
      return null;
    }
  }

  /**
   * 기본 항목 틀을 생성합니다 (캐시 파일이 없을 때 사용).
   */
  private makeEntry(report: InterestReport, fetchedAt: string): BriefingCacheEntry {
    return {
      interest_type: report.type,
      data: report,
      fetched_at: fetchedAt,
      ttl_minutes: DEFAULT_TTL_MINUTES,
      max_stale_minutes: DEFAULT_MAX_STALE_MINUTES,
    };
  }

  /**
   * 설정 파일에서 갱신 주기를 읽어 밀리초로 반환합니다.
   * 설정 읽기 실패 시 기본값을 사용합니다.
   */
  private async resolveIntervalMs(): Promise<number> {
    try {
      const config = await loadConfig();
      const minutes = config.cache?.refresh_interval_minutes ?? DEFAULT_REFRESH_INTERVAL_MINUTES;
      return minutes * 60_000;
    } catch {
      return DEFAULT_REFRESH_INTERVAL_MINUTES * 60_000;
    }
  }
}

/** 싱글턴 인스턴스 (필요 시 import 하여 사용) */
export const cacheScheduler = new CacheScheduler();
