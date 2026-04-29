// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 브리핑 캐시 관리자
//  ~/.valet-pilot/cache/briefing/{type}.json 을 읽고 씁니다.
// ────────────────────────────────────────────────────────────────

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { VALET_DIRS } from '../utils/dirs.js';
import type { BriefingCacheEntry } from '../types/cache.js';

/** TTL 기본값 (분) */
const DEFAULT_TTL_MINUTES = 30;

/** 최대 stale 허용 시간 기본값 (분) */
const DEFAULT_MAX_STALE_MINUTES = 120;

// ── BriefingCache ────────────────────────────────────────────────

export class BriefingCache {
  private readonly cacheDir: string;

  constructor(cacheDir: string = VALET_DIRS.cacheBriefing) {
    this.cacheDir = cacheDir;
  }

  /**
   * 특정 관심사 타입의 캐시 항목을 파일에서 읽어 반환합니다.
   * 파일이 없거나 파싱에 실패하면 null 을 반환합니다.
   *
   * @param interestType 관심사 종류 (예: 'redmine', 'weather')
   */
  async load(interestType: string): Promise<BriefingCacheEntry | null> {
    const filePath = this.entryPath(interestType);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const raw = await readFile(filePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);

      if (!this.isValidEntry(parsed)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * 캐시 항목을 JSON 파일로 저장합니다.
   * 디렉토리가 없으면 자동으로 생성합니다.
   *
   * @param entry 저장할 캐시 항목
   */
  async save(entry: BriefingCacheEntry): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      await mkdir(this.cacheDir, { recursive: true });
    }

    const filePath = this.entryPath(entry.interest_type);
    await writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  /**
   * 캐시 항목이 아직 유효한지 확인합니다.
   * fetched_at 으로부터 ttl_minutes 이내이면 true 를 반환합니다.
   *
   * @param entry 확인할 캐시 항목
   */
  isValid(entry: BriefingCacheEntry): boolean {
    const ttl = entry.ttl_minutes ?? DEFAULT_TTL_MINUTES;
    const fetchedAt = new Date(entry.fetched_at).getTime();
    const now = Date.now();
    const ageMinutes = (now - fetchedAt) / 60_000;

    return ageMinutes <= ttl;
  }

  /**
   * 캐시 항목이 완전히 만료(stale)되었는지 확인합니다.
   * fetched_at 으로부터 max_stale_minutes 초과이면 true 를 반환합니다.
   *
   * @param entry 확인할 캐시 항목
   */
  isStale(entry: BriefingCacheEntry): boolean {
    const maxStale = entry.max_stale_minutes ?? DEFAULT_MAX_STALE_MINUTES;
    const fetchedAt = new Date(entry.fetched_at).getTime();
    const now = Date.now();
    const ageMinutes = (now - fetchedAt) / 60_000;

    return ageMinutes > maxStale;
  }

  /**
   * 유효한 캐시 항목을 반환합니다.
   * 항목이 없거나, 로드에 실패하거나, TTL 을 초과한 경우 null 을 반환합니다.
   *
   * @param interestType 관심사 종류
   */
  async get(interestType: string): Promise<BriefingCacheEntry | null> {
    const entry = await this.load(interestType);

    if (entry === null) {
      return null;
    }

    if (!this.isValid(entry)) {
      return null;
    }

    return entry;
  }

  // ── 내부 헬퍼 ────────────────────────────────────────────────────

  private entryPath(interestType: string): string {
    return join(this.cacheDir, `${interestType}.json`);
  }

  private isValidEntry(value: unknown): value is BriefingCacheEntry {
    if (typeof value !== 'object' || value === null) return false;

    const obj = value as Record<string, unknown>;

    return (
      typeof obj['interest_type'] === 'string' &&
      typeof obj['data'] === 'object' &&
      obj['data'] !== null &&
      typeof obj['fetched_at'] === 'string' &&
      typeof obj['ttl_minutes'] === 'number' &&
      typeof obj['max_stale_minutes'] === 'number'
    );
  }
}

/** 싱글턴 인스턴스 (필요 시 import 하여 사용) */
export const briefingCache = new BriefingCache();
