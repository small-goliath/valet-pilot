// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 관심사 레지스트리
//  config.interests 순서대로 fetcher를 찾아 병렬로 fetch 합니다.
// ────────────────────────────────────────────────────────────────

import { loadConfig } from '../config/manager.js';
import type { Interest } from '../types/config.js';
import type { InterestFetcher, InterestReport } from '../types/interest.js';
import { RedmineFetcher } from './redmine.js';
import { WeatherFetcher } from './weather.js';
import { CustomFetcher } from './custom.js';

// ── 팩토리 함수 타입 ─────────────────────────────────────────────

type FetcherFactory = (interest: Interest) => InterestFetcher;

// ────────────────────────────────────────────────────────────────

export class InterestRegistry {
  private readonly factories = new Map<string, FetcherFactory>();

  constructor() {
    // 기본 관심사 유형 등록
    this.register('redmine', (interest) => new RedmineFetcher(interest));

    this.register('weather', (interest) => new WeatherFetcher(interest));

    this.register('custom', (interest) => new CustomFetcher(interest));
  }

  /**
   * 새 관심사 유형을 등록합니다.
   * 이미 등록된 type이면 덮어씁니다.
   *
   * @param type    config.interests[].type 값과 일치하는 키
   * @param factory Interest 설정을 받아 InterestFetcher를 반환하는 팩토리
   */
  register(type: string, factory: FetcherFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * config.interests에 정의된 모든 관심사를 병렬로 fetch 합니다.
   * 개별 fetch가 실패하더라도 나머지 결과는 정상 반환됩니다.
   *
   * @returns config.interests 순서를 유지한 InterestReport 배열
   */
  async fetchAll(): Promise<InterestReport[]> {
    const config = await loadConfig();
    const interests = config.interests ?? [];

    const settled = await Promise.allSettled(
      interests.map((interest) => this.fetchOne(interest)),
    );

    return settled.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      // Promise.allSettled가 rejected를 반환하는 경우는 fetchOne 내부에서
      // 예외가 전파된 극히 예외적인 상황이므로, 여기서 안전하게 처리합니다.
      const interest = interests[index];
      return {
        type: interest.type,
        name: interest.name ?? interest.type,
        summary: '',
        fetchedAt: new Date(),
        error: result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      } satisfies InterestReport;
    });
  }

  // ── 내부 헬퍼 ────────────────────────────────────────────────────

  private fetchOne(interest: Interest): Promise<InterestReport> {
    const factory = this.factories.get(interest.type);

    if (!factory) {
      return Promise.resolve({
        type: interest.type,
        name: interest.name ?? interest.type,
        summary: '',
        fetchedAt: new Date(),
        error: `등록되지 않은 관심사 유형입니다: ${interest.type}`,
      } satisfies InterestReport);
    }

    return factory(interest).fetch();
  }
}
