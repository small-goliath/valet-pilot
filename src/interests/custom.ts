// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 커스텀 관심사 Fetcher
//  config.interests[].type === 'custom' 인 항목을 처리합니다.
// ────────────────────────────────────────────────────────────────

import fs from 'node:fs/promises';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import type { InterestFetcher, InterestReport } from '../types/interest.js';
import type { Interest } from '../types/config.js';

// ── RSS 파싱 관련 타입 ────────────────────────────────────────────

interface RssItem {
  title?: unknown;
  link?: unknown;
}

interface RssChannel {
  item?: RssItem | RssItem[];
}

interface RssFeed {
  rss?: { channel?: RssChannel };
  feed?: { entry?: RssItem | RssItem[] };
}

// ── JSONPath dot-notation 추출 ────────────────────────────────────

/**
 * "$.a.b.c" 또는 "a.b.c" 형태의 dot-notation 경로로 객체에서 값을 추출합니다.
 * 배열 인덱스(예: items[0]) 는 지원하지 않으며, 단순 키 체인만 처리합니다.
 */
function extractByPath(data: unknown, path: string): unknown {
  // "$." 접두어 제거
  const normalised = path.startsWith('$.') ? path.slice(2) : path;
  const keys = normalised.split('.');

  let current: unknown = data;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// ── 브리핑 텍스트 빌더 ────────────────────────────────────────────

/**
 * report_template 이 있으면 {value} 를 치환하고, 없으면 값을 자연어 문장으로 변환합니다.
 */
function buildSummary(name: string, value: unknown, template?: string): string {
  const valueStr = Array.isArray(value)
    ? value.join(', ')
    : String(value ?? '');

  if (template) {
    return template.replace(/\{value\}/g, valueStr);
  }

  // 템플릿이 없을 경우 자연어 fallback
  return `${name} 정보: ${valueStr}`;
}

// ── 소스별 fetch 로직 ─────────────────────────────────────────────

async function fetchRestApi(interest: Interest): Promise<string> {
  const url = interest.url;
  if (!url) throw new Error('rest_api 소스에는 url 이 필요합니다.');

  const method = interest.source?.method ?? 'GET';

  // API 키 처리: Authorization 헤더 또는 쿼리 파라미터 (헤더 우선)
  const headers: Record<string, string> = {};
  const params: Record<string, string> = {};

  if (interest.api_key) {
    headers['Authorization'] = `Bearer ${interest.api_key}`;
  }

  const response = await axios.request<unknown>({
    method,
    url,
    headers,
    params: method === 'GET' ? params : undefined,
    data: method === 'POST' ? params : undefined,
    timeout: 10_000,
  });

  const data = response.data;

  // extract 경로가 있으면 JSONPath dot-notation 추출
  const extract = interest.source?.extract;
  if (extract) {
    const extracted = extractByPath(data, extract);
    return buildSummary(interest.name ?? 'REST API', extracted, interest.report_template);
  }

  return buildSummary(
    interest.name ?? 'REST API',
    typeof data === 'string' ? data : JSON.stringify(data),
    interest.report_template,
  );
}

async function fetchRss(interest: Interest): Promise<string> {
  const url = interest.url;
  if (!url) throw new Error('rss 소스에는 url 이 필요합니다.');

  const response = await axios.get<string>(url, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    timeout: 10_000,
    responseType: 'text',
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const parsed = parser.parse(response.data) as RssFeed;

  // RSS 2.0 (<rss><channel><item>) 또는 Atom (<feed><entry>) 모두 처리
  let rawItems: RssItem[] = [];

  if (parsed.rss?.channel?.item) {
    const item = parsed.rss.channel.item;
    rawItems = Array.isArray(item) ? item : [item];
  } else if (parsed.feed?.entry) {
    const entry = parsed.feed.entry;
    rawItems = Array.isArray(entry) ? entry : [entry];
  }

  const top3 = rawItems.slice(0, 3);

  if (top3.length === 0) {
    return buildSummary(interest.name ?? 'RSS', '최신 항목이 없습니다.', interest.report_template);
  }

  const lines = top3.map((item, i) => {
    const title = String(item.title ?? '제목 없음');
    const link = String(item.link ?? '');
    return link ? `${i + 1}. ${title} (${link})` : `${i + 1}. ${title}`;
  });

  return buildSummary(interest.name ?? 'RSS', lines.join(' | '), interest.report_template);
}

async function fetchLocalFile(interest: Interest): Promise<string> {
  const filePath = interest.url;
  if (!filePath) throw new Error('local_file 소스에는 url(파일 경로)이 필요합니다.');

  const content = await fs.readFile(filePath, 'utf-8');

  const extract = interest.source?.extract;
  if (extract) {
    try {
      const parsed: unknown = JSON.parse(content);
      const extracted = extractByPath(parsed, extract);
      return buildSummary(interest.name ?? '로컬 파일', extracted, interest.report_template);
    } catch {
      // JSON 파싱 실패 시 파일 내용 전체 사용
    }
  }

  return buildSummary(interest.name ?? '로컬 파일', content.trim(), interest.report_template);
}

// ────────────────────────────────────────────────────────────────

export class CustomFetcher implements InterestFetcher {
  private readonly interest: Interest;

  constructor(interest: Interest) {
    this.interest = interest;
  }

  async fetch(): Promise<InterestReport> {
    const name = this.interest.name ?? 'custom';
    const fetchedAt = new Date();
    const sourceType = this.interest.source?.type;

    try {
      let summary: string;

      switch (sourceType) {
        case 'rest_api':
          summary = await fetchRestApi(this.interest);
          break;

        case 'rss':
          summary = await fetchRss(this.interest);
          break;

        case 'scraping':
          // 보안상 스크래핑 기능은 의도적으로 제외합니다.
          return {
            type: 'custom',
            name,
            summary: '',
            fetchedAt,
            error:
              '스크래핑(scraping) 소스 타입은 보안상 지원하지 않습니다. rest_api 또는 rss 를 사용하세요.',
          };

        case 'local_file':
          summary = await fetchLocalFile(this.interest);
          break;

        default:
          return {
            type: 'custom',
            name,
            summary: '',
            fetchedAt,
            error: `알 수 없는 소스 타입입니다: ${sourceType ?? '(미지정)'}. rest_api | rss | local_file 중 하나를 지정하세요.`,
          };
      }

      return { type: 'custom', name, summary, fetchedAt };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        type: 'custom',
        name,
        summary: '',
        fetchedAt,
        error: `커스텀 관심사 데이터를 가져오지 못했습니다: ${message}`,
      };
    }
  }
}
