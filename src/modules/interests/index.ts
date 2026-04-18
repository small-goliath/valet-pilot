import type { ValetConfig } from '../../types/config.js';
import type { AIAdapter } from '../../adapters/ai.js';
import { fetchRedmineIssues } from './redmine.js';
import { fetchJiraIssues } from './jira.js';
import { fetchWeather } from './weather.js';
import { fetchStocks } from './stock.js';

export interface InterestReport {
  section: string;   // 섹션 이름 (로그용)
  script: string;    // TTS로 읽을 자연어 텍스트
}

/**
 * 설정된 모든 관심사 데이터를 수집하고 자연어 스크립트로 변환
 */
export async function collectInterests(
  config: ValetConfig,
  ai: AIAdapter
): Promise<InterestReport[]> {
  const reports: InterestReport[] = [];
  const { language } = config;

  // 1. 업무 툴 (Redmine or JIRA)
  try {
    const workReport = await collectWorkTool(config, ai);
    if (workReport) reports.push(workReport);
  } catch (err) {
    reports.push({
      section: '업무 툴',
      script: buildFallbackScript(language, '업무 툴 정보를 가져오지 못했습니다.'),
    });
  }

  // 2. 날씨
  const weatherInterest = config.interests.find((i) => i.id === 'weather');
  if (weatherInterest) {
    try {
      const data = await fetchWeather(weatherInterest);
      const raw = JSON.stringify(data);
      const script = await ai.chat(
        `다음 날씨 데이터를 TTS로 읽을 자연스러운 한 문장으로 요약해주세요. 언어: ${language}.\n${raw}`,
        '간결하고 자연스러운 날씨 브리핑 문장을 만들어주세요. 30자 이내로.'
      );
      reports.push({ section: '날씨', script });
    } catch {
      reports.push({ section: '날씨', script: buildFallbackScript(language, '날씨 정보를 가져오지 못했습니다.') });
    }
  }

  // 3. 주식
  const stockInterest = config.interests.find((i) => i.id === 'stock');
  if (stockInterest) {
    try {
      const stocks = await fetchStocks(stockInterest);
      if (stocks.length > 0) {
        const raw = stocks
          .map(
            (s) =>
              `${s.ticker}: ${s.price.toLocaleString()} (${s.change >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%)`
          )
          .join(', ');
        const script = await ai.chat(
          `다음 주식 시세를 TTS로 읽을 자연스러운 브리핑 문장으로 만들어주세요. 언어: ${language}.\n${raw}`,
          '간결하고 자연스러운 주식 브리핑 문장을 만들어주세요.'
        );
        reports.push({ section: '주식', script });
      }
    } catch {
      reports.push({ section: '주식', script: buildFallbackScript(language, '주식 정보를 가져오지 못했습니다.') });
    }
  }

  // 4. 사용자 지정
  const customInterest = config.interests.find((i) => i.id === 'custom');
  if (customInterest?.custom_config?.endpoint) {
    try {
      const { default: axios } = await import('axios');
      const res = await axios.get(String(customInterest.custom_config.endpoint), { timeout: 8000 });
      const raw = JSON.stringify(res.data).slice(0, 500);
      const script = await ai.chat(
        `다음 데이터를 TTS 브리핑 문장으로 요약해주세요. 언어: ${language}.\n${raw}`,
        '간결한 브리핑 문장을 만들어주세요.'
      );
      reports.push({ section: customInterest.name, script });
    } catch {
      reports.push({
        section: customInterest.name,
        script: buildFallbackScript(language, `${customInterest.name} 정보를 가져오지 못했습니다.`),
      });
    }
  }

  return reports;
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
    const issues = await fetchRedmineIssues(tool);
    issueCount = issues.length;
    issueNames = issues.slice(0, 5).map((i) => i.subject);
  } else {
    const issues = await fetchJiraIssues(tool);
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

function buildFallbackScript(language: string, message: string): string {
  // 언어별 기본 오류 메시지
  if (language === 'english') return message.replace('못했습니다', 'unavailable').replace('없습니다', 'none');
  if (language === 'japanese') return message;
  return message;
}
