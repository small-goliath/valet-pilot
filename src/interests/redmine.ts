// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Redmine 관심사 Fetcher
//  GET /issues.json?status_id=open&assigned_to_id=me
// ────────────────────────────────────────────────────────────────

import axios from 'axios';
import { getSecret } from '../config/keychain.js';
import type { InterestFetcher, InterestReport } from '../types/interest.js';
import type { Interest } from '../types/config.js';

// ── Redmine API 응답 타입 ─────────────────────────────────────────

interface RedmineNamedValue {
  id: number;
  name: string;
}

interface RedmineIssue {
  id: number;
  subject: string;
  status: RedmineNamedValue;
  priority: RedmineNamedValue;
  project: RedmineNamedValue;
}

interface RedmineIssuesResponse {
  issues: RedmineIssue[];
  total_count: number;
}

// ── 우선순위 → 한국어 레이블 매핑 ───────────────────────────────

const PRIORITY_LABEL: Record<string, string> = {
  Immediate: '즉시',
  Urgent: '긴급',
  High: '높음',
  Normal: '보통',
  Low: '낮음',
};

function priorityLabel(name: string): string {
  return PRIORITY_LABEL[name] ?? name;
}

// ── 브리핑 텍스트 생성 ────────────────────────────────────────────

/**
 * 이슈 목록을 우선순위별로 그룹화하여 브리핑 문장을 만듭니다.
 * 우선순위 내에서 최대 5건을 읽고 나머지는 "외 N건"으로 요약합니다.
 */
function buildSummary(issues: RedmineIssue[]): string {
  if (issues.length === 0) {
    return '오늘 할당된 일감은 없습니다.';
  }

  const lines: string[] = [`오늘 할당된 일감은 총 ${issues.length}건입니다.`];

  // 우선순위별 그룹화 (입력 순서 유지, 중복 없이)
  const groups = new Map<string, RedmineIssue[]>();
  for (const issue of issues) {
    const key = issue.priority.name;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(issue);
  }

  const MAX_PER_GROUP = 5;

  for (const [priorityName, groupIssues] of groups) {
    const label = priorityLabel(priorityName);
    const shown = groupIssues.slice(0, MAX_PER_GROUP);
    const rest = groupIssues.length - shown.length;

    const issueParts = shown.map((i) => `#${i.id} ${i.subject}`);
    if (rest > 0) {
      issueParts.push(`외 ${rest}건`);
    }

    lines.push(`${label} ${groupIssues.length}건: ${issueParts.join(', ')}`);
  }

  return lines.join(' ');
}

// ────────────────────────────────────────────────────────────────

export class RedmineFetcher implements InterestFetcher {
  private readonly interest: Interest;

  constructor(interest: Interest) {
    this.interest = interest;
  }

  async fetch(): Promise<InterestReport> {
    const name = this.interest.name ?? 'Redmine';
    const fetchedAt = new Date();

    try {
      // API 키: config의 api_key 우선 (플레이스홀더 ${...} 는 무시), 없으면 Keychain에서 조회
      const rawKey = this.interest.api_key;
      const apiKey =
        (rawKey && !rawKey.startsWith('${'))
          ? rawKey
          : (await getSecret('valet-pilot', 'redmine-api-key'));

      if (!apiKey) {
        return {
          type: 'redmine',
          name,
          summary: '',
          fetchedAt,
          error: 'Redmine API 키가 설정되지 않았습니다. `valet-pilot config set redmine` 을 실행하세요.',
        };
      }

      const baseUrl = this.interest.location ?? this.interest.url;
      if (!baseUrl) {
        return {
          type: 'redmine',
          name,
          summary: '',
          fetchedAt,
          error: 'Redmine URL(location)이 설정되지 않았습니다.',
        };
      }

      const url = `${baseUrl.replace(/\/$/, '')}/issues.json`;

      const response = await axios.get<RedmineIssuesResponse>(url, {
        headers: { 'X-Redmine-API-Key': apiKey },
        params: {
          status_id: 'open',
          assigned_to_id: 'me',
          sort: 'status:asc,priority:desc,updated_on:desc',
          limit: 100,
        },
        timeout: 10_000,
      });

      const issues = response.data.issues ?? [];
      const summary = buildSummary(issues);

      return { type: 'redmine', name, summary, fetchedAt };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);

      return {
        type: 'redmine',
        name,
        summary: '',
        fetchedAt,
        error: `Redmine 데이터를 가져오지 못했습니다: ${message}`,
      };
    }
  }
}
