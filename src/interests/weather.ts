// ────────────────────────────────────────────────────────────────
//  Valet Pilot — OpenWeatherMap 날씨 관심사 Fetcher
//  GET https://api.openweathermap.org/data/2.5/weather
// ────────────────────────────────────────────────────────────────

import axios from 'axios';
import { getSecret } from '../config/keychain.js';
import { loadConfig } from '../config/manager.js';
import { AIManager } from '../ai/manager.js';
import type { InterestFetcher, InterestReport } from '../types/interest.js';
import type { Interest, AgentConfig } from '../types/config.js';

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

// ── AI 자연어 요약 생성 ──────────────────────────────────────────

/**
 * AI 모델을 사용해 날씨 데이터를 자연스러운 한국어 브리핑으로 변환합니다.
 * 실패 시 Error를 throw합니다 (호출부에서 catch → buildSummary fallback).
 */
async function generateNaturalSummary(
  location: string,
  data: OWMResponse,
  agentConfig: AgentConfig,
): Promise<string> {
  const ai = new AIManager(agentConfig);

  const weatherInfo =
    `위치: ${location}\n` +
    `날씨: ${data.weather[0]?.description ?? '알 수 없음'}\n` +
    `현재 기온: ${Math.round(data.main.temp)}°C\n` +
    `최고/최저: ${Math.round(data.main.temp_max)}°C / ${Math.round(data.main.temp_min)}°C\n` +
    `습도: ${data.main.humidity}%\n` +
    `풍속: ${data.wind.speed}m/s`;

  const response = await ai.chat([
    {
      role: 'system',
      content:
        '당신은 개인 비서입니다. 날씨 데이터를 분석해서 오늘의 날씨를 주인님께 보고하는 정중한 존댓말로 브리핑해주세요.\n' +
        '규칙:\n' +
        '- TTS로 읽히는 텍스트이므로 특수문자(°, %, * 등) 없이 자연스러운 문장으로 작성\n' +
        '- 단순 수치 나열이 아니라 오늘 날씨가 어떤지, 어떻게 준비하면 좋을지 조언 포함\n' +
        '- 전체 2~3문장 이내로 간결하게\n' +
        '- 반말 절대 금지, 항상 "~습니다", "~세요" 등 정중한 존댓말 사용',
    },
    {
      role: 'user',
      content: `다음 날씨 데이터를 브리핑해 주세요:\n${weatherInfo}`,
    },
  ]);

  const text = response.content.trim();
  if (!text) throw new Error('AI 응답이 비어 있습니다.');
  return text;
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
      const config = await loadConfig();
      const summary = await generateNaturalSummary(cityName, response.data, config.agent)
        .catch(() => buildSummary(cityName, response.data));

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
