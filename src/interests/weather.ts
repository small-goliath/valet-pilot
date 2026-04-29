// ────────────────────────────────────────────────────────────────
//  Valet Pilot — OpenWeatherMap 날씨 관심사 Fetcher
//  GET https://api.openweathermap.org/data/2.5/weather
// ────────────────────────────────────────────────────────────────

import axios from 'axios';
import { getSecret } from '../config/keychain.js';
import type { InterestFetcher, InterestReport } from '../types/interest.js';
import type { Interest } from '../types/config.js';

// ── OpenWeatherMap API 응답 타입 ──────────────────────────────────

interface OWMWeatherDesc {
  description: string;
}

interface OWMMain {
  temp: number;
  temp_min: number;
  temp_max: number;
  humidity: number;
}

interface OWMWind {
  speed: number;
}

interface OWMResponse {
  weather: OWMWeatherDesc[];
  main: OWMMain;
  wind: OWMWind;
  name: string;
}

// ── 브리핑 텍스트 생성 ────────────────────────────────────────────

function buildSummary(location: string, data: OWMResponse): string {
  const desc = data.weather[0]?.description ?? '알 수 없음';
  const current = Math.round(data.main.temp);
  const max = Math.round(data.main.temp_max);
  const min = Math.round(data.main.temp_min);
  const humidity = data.main.humidity;
  const wind = data.wind.speed;

  return (
    `오늘 ${location}은 ${desc}이고 현재 ${current}도, ` +
    `최고 ${max}도, 최저 ${min}도입니다. ` +
    `습도 ${humidity}%, 풍속 ${wind}m/s입니다.`
  );
}

// ────────────────────────────────────────────────────────────────

const OWM_API_URL = 'https://api.openweathermap.org/data/2.5/weather';

export class WeatherFetcher implements InterestFetcher {
  private readonly interest: Interest;

  constructor(interest: Interest) {
    this.interest = interest;
  }

  async fetch(): Promise<InterestReport> {
    const name = this.interest.name ?? '날씨';
    const fetchedAt = new Date();

    try {
      // API 키: config의 api_key 우선, 없으면 Keychain에서 조회
      const apiKey =
        this.interest.api_key ?? (await getSecret('valet-pilot', 'openweathermap-api-key'));

      if (!apiKey) {
        return {
          type: 'weather',
          name,
          summary: '',
          fetchedAt,
          error: 'OpenWeatherMap API 키가 설정되지 않았습니다. `valet-pilot config set weather` 를 실행하세요.',
        };
      }

      // 위치: interest.location 우선, 없으면 interest.url, 기본값 'Seoul'
      const location = this.interest.location ?? this.interest.url ?? 'Seoul';

      const response = await axios.get<OWMResponse>(OWM_API_URL, {
        params: {
          q: location,
          appid: apiKey,
          lang: 'ko',
          units: 'metric',
        },
        timeout: 10_000,
      });

      const cityName = response.data.name || location;
      const summary = buildSummary(cityName, response.data);

      return { type: 'weather', name, summary, fetchedAt };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      return {
        type: 'weather',
        name,
        summary: '',
        fetchedAt,
        error: `날씨 데이터를 가져오지 못했습니다: ${message}`,
      };
    }
  }
}
