import type { ValetConfig } from '../../types/config.js';
import type { AIAdapter } from '../../adapters/ai.js';
import { fetchRedmineIssues } from './redmine.js';
import { fetchJiraIssues } from './jira.js';
import { fetchWeather } from './weather.js';
import { fetchStocks } from './stock.js';

export interface InterestReport {
  section: string;
  script: string;
}

// B: 소스별 타임아웃 (ms)
const SOURCE_TIMEOUT_MS = 8000;

/**
 * Promise에 타임아웃을 걸어 초과 시 fallback 반환
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * 설정된 모든 관심사 데이터를 병렬로 수집하고 자연어 스크립트로 변환.
 * 각 소스는 SOURCE_TIMEOUT_MS 초과 시 fallback 메시지로 대체.
 */
export async function collectInterests(
  config: ValetConfig,
  ai: AIAdapter
): Promise<InterestReport[]> {
  const { language } = config;

  // B: 각 소스를 독립 Promise로 만들고 모두 병렬 실행
  const tasks: Promise<InterestReport | null>[] = [];

  // 1. 업무 툴
  tasks.push(
    withTimeout(
      collectWorkTool(config, ai),
      SOURCE_TIMEOUT_MS,
      { section: '업무 툴', script: buildFallbackScript(language, '업무 툴 정보를 가져오지 못했습니다.') }
    ).catch((err) => {
      const detail = (err as any)?.response?.data ?? (err as any)?.status ?? '';
      console.error('  ❌ [업무 툴 오류]', err instanceof Error ? err.message : err, detail ? JSON.stringify(detail) : '');
      return { section: '업무 툴', script: buildFallbackScript(language, '업무 툴 정보를 가져오지 못했습니다.') };
    })
  );

  // 2. 날씨
  const weatherInterest = config.interests.find((i) => i.id === 'weather');
  if (weatherInterest) {
    tasks.push(
      withTimeout(
        fetchWeather(weatherInterest)
          .catch((err) => { throw new Error(`OpenWeatherMap API: ${err instanceof Error ? err.message : err}`); })
          .then(async (data) => {
          const script = await withTimeout(
            ai.chat(
              `다음 날씨 데이터를 TTS로 읽을 자연스러운 한 문장으로 요약해주세요. 언어: ${language}.\n${JSON.stringify(data)}`,
              '간결하고 자연스러운 날씨 브리핑 문장을 만들어주세요. 30자 이내로.'
            ),
            SOURCE_TIMEOUT_MS,
            buildWeatherFallback(data)
          );
          return { section: '날씨', script };
        }),
        SOURCE_TIMEOUT_MS,
        { section: '날씨', script: buildFallbackScript(language, '날씨 정보를 가져오지 못했습니다.') }
      ).catch((err) => {
        const detail = (err as any)?.response?.data ?? (err as any)?.status ?? '';
        console.error('  ❌ [날씨 오류]', err instanceof Error ? err.message : err, detail ? JSON.stringify(detail) : '');
        return { section: '날씨', script: buildFallbackScript(language, '날씨 정보를 가져오지 못했습니다.') };
      })
    );
  }

  // 3. 주식
  const stockInterest = config.interests.find((i) => i.id === 'stock');
  if (stockInterest) {
    tasks.push(
      withTimeout(
        fetchStocks(stockInterest).then(async (stocks) => {
          if (stocks.length === 0) return null;
          const raw = stocks
            .map((s) => `${s.ticker}: ${s.price.toLocaleString()} (${s.change >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%)`)
            .join(', ');
          const script = await withTimeout(
            ai.chat(
              `다음 주식 시세를 TTS로 읽을 자연스러운 브리핑 문장으로 만들어주세요. 언어: ${language}.\n${raw}`,
              '간결하고 자연스러운 주식 브리핑 문장을 만들어주세요.'
            ),
            SOURCE_TIMEOUT_MS,
            raw
          );
          return { section: '주식', script };
        }),
        SOURCE_TIMEOUT_MS,
        { section: '주식', script: buildFallbackScript(language, '주식 정보를 가져오지 못했습니다.') }
      ).catch((err) => {
        console.error('  ❌ [주식 오류]', err instanceof Error ? err.message : err);
        return { section: '주식', script: buildFallbackScript(language, '주식 정보를 가져오지 못했습니다.') };
      })
    );
  }

  // 4. 사용자 지정
  const customInterest = config.interests.find((i) => i.id === 'custom');
  if (customInterest?.custom_config?.endpoint) {
    tasks.push(
      withTimeout(
        (async () => {
          const { default: axios } = await import('axios');
          const res = await axios.get(String(customInterest.custom_config!.endpoint), { timeout: SOURCE_TIMEOUT_MS });
          const raw = JSON.stringify(res.data).slice(0, 500);
          const script = await withTimeout(
            ai.chat(
              `다음 데이터를 TTS 브리핑 문장으로 요약해주세요. 언어: ${language}.\n${raw}`,
              '간결한 브리핑 문장을 만들어주세요.'
            ),
            SOURCE_TIMEOUT_MS,
            raw
          );
          return { section: customInterest.name, script };
        })(),
        SOURCE_TIMEOUT_MS * 2,
        { section: customInterest.name, script: buildFallbackScript(language, `${customInterest.name} 정보를 가져오지 못했습니다.`) }
      ).catch(() => ({
        section: customInterest.name,
        script: buildFallbackScript(language, `${customInterest.name} 정보를 가져오지 못했습니다.`),
      }))
    );
  }

  // 모든 소스 병렬 실행
  const results = await Promise.all(tasks);
  return results.filter((r): r is InterestReport => r !== null);
}

async function collectWorkTool(
  config: ValetConfig,
  ai: AIAdapter
): Promise<InterestReport | null> {
  const { language } = config;
  const tool = config.work_tool;

  let issueCount = 0;
  let issueNames: string[] = [];

  if (tool.type === 'redmine') {
    const issues = await fetchRedmineIssues(tool).catch((err) => {
      throw new Error(`Redmine API: ${err instanceof Error ? err.message : err}`);
    });
    issueCount = issues.length;
    issueNames = issues.slice(0, 5).map((i) => i.subject);
  } else {
    const issues = await fetchJiraIssues(tool).catch((err) => {
      throw new Error(`Jira API: ${err instanceof Error ? err.message : err}`);
    });
    issueCount = issues.length;
    issueNames = issues.slice(0, 5).map((i) => i.fields.summary);
  }

  if (issueCount === 0) {
    return {
      section: '업무 툴',
      script: buildFallbackScript(language, '현재 할당된 이슈가 없습니다.'),
    };
  }

  const listText = issueNames.join(', ');
  const prompt = `오늘 할당된 이슈는 총 ${issueCount}건입니다. 주요 이슈: ${listText}. 이를 자연스러운 TTS 브리핑 문장으로 만들어주세요. 언어: ${language}.`;
  const script = await ai.chat(prompt, '간결하고 업무 브리핑에 맞는 문장을 만들어주세요.');

  return { section: '업무 툴', script };
}

function buildWeatherFallback(data: { location: string; description: string; temp: number }): string {
  return `${data.location} 현재 ${data.description}, 기온 ${data.temp}도입니다.`;
}

function buildFallbackScript(language: string, message: string): string {
  if (language === 'english') return message.replace('못했습니다', 'unavailable').replace('없습니다', 'none');
  return message;
}
