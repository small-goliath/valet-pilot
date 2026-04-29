// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 대화 히스토리 저장/조회 관리자
// ────────────────────────────────────────────────────────────────

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../config/manager.js';
import { AIManager } from '../ai/manager.js';
import { VALET_DIRS } from '../utils/dirs.js';
import { maskSensitiveInfo } from './masker.js';
import type { Session } from '../types/session.js';
import type { SessionHistory } from '../types/history.js';

// ── 상수 ────────────────────────────────────────────────────────

/** 요약 생성 최대 토큰 수 */
const SUMMARY_MAX_TOKENS = 256;

// ── 내부 헬퍼 ────────────────────────────────────────────────────

/**
 * Date 객체를 YYYY-MM-DD 형식 문자열로 변환합니다.
 */
function toDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 히스토리 파일 경로를 반환합니다.
 * 형식: ~/.valet-pilot/history/{YYYY-MM-DD}_{session_id}.json
 */
function buildFilePath(sessionId: string, endedAt: Date): string {
  return join(VALET_DIRS.history, `${toDateString(endedAt)}_${sessionId}.json`);
}

// ── HistoryManager ────────────────────────────────────────────────

export class HistoryManager {
  /**
   * 세션 종료 후 히스토리를 저장합니다.
   *
   * 1. AIManager.chat() 으로 대화 요약을 생성합니다.
   * 2. 각 턴의 content 에서 민감 정보를 마스킹합니다.
   * 3. SessionHistory 객체를 JSON 파일로 저장합니다.
   *
   * @param session 종료된 세션 객체
   * @param endedAt 세션 종료 시각
   */
  async save(session: Session, endedAt: Date): Promise<void> {
    // ── 1. AI 요약 생성 ───────────────────────────────────────────
    let summary = '';

    try {
      const config = await loadConfig();
      const ai = new AIManager(config.agent);

      const turnsText = session.turns
        .map((t) => `[${t.role}] ${t.content}`)
        .join('\n');

      const response = await ai.chat(
        [
          {
            role: 'user',
            content: `다음 대화를 2~3문장으로 요약해줘:\n${turnsText}`,
          },
        ],
        { maxTokens: SUMMARY_MAX_TOKENS },
      );

      summary = response.content.trim();
    } catch (err) {
      // 요약 실패는 히스토리 저장을 막지 않습니다
      console.warn('[HistoryManager] 요약 생성 실패:', err);
      summary = '(요약 생성 실패)';
    }

    // ── 2. 민감 정보 마스킹 ──────────────────────────────────────
    const maskedTurns = session.turns.map((turn) => ({
      ...turn,
      content: maskSensitiveInfo(turn.content),
    }));

    // ── 3. SessionHistory 생성 및 파일 저장 ──────────────────────
    const history: SessionHistory = {
      session_id: session.id,
      trigger_type: session.triggerType,
      started_at: session.startedAt,
      ended_at: endedAt.toISOString(),
      summary,
      turns: maskedTurns,
    };

    const filePath = buildFilePath(session.id, endedAt);
    await writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
  }

  /**
   * 저장된 모든 히스토리를 반환합니다.
   * 파일 이름의 날짜 오름차순으로 정렬됩니다.
   *
   * @returns SessionHistory 배열 (파싱 실패한 파일은 건너뜁니다)
   */
  async list(): Promise<SessionHistory[]> {
    let files: string[];

    try {
      files = await readdir(VALET_DIRS.history);
    } catch {
      return [];
    }

    const jsonFiles = files
      .filter((f) => f.endsWith('.json'))
      .sort(); // 파일명이 YYYY-MM-DD_<id>.json 형식이므로 사전식 정렬 = 날짜 오름차순

    const results: SessionHistory[] = [];

    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(VALET_DIRS.history, file), 'utf-8');
        const history = JSON.parse(raw) as SessionHistory;
        results.push(history);
      } catch (err) {
        console.warn(`[HistoryManager] 파일 파싱 실패 (${file}):`, err);
      }
    }

    return results;
  }

  /**
   * 가장 최근에 저장된 히스토리를 반환합니다.
   *
   * @returns 최신 SessionHistory, 없으면 null
   */
  async getLatest(): Promise<SessionHistory | null> {
    let files: string[];

    try {
      files = await readdir(VALET_DIRS.history);
    } catch {
      return null;
    }

    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();

    if (jsonFiles.length === 0) return null;

    const latestFile = jsonFiles[jsonFiles.length - 1];

    try {
      const raw = await readFile(join(VALET_DIRS.history, latestFile), 'utf-8');
      return JSON.parse(raw) as SessionHistory;
    } catch (err) {
      console.warn(`[HistoryManager] 최신 파일 파싱 실패 (${latestFile}):`, err);
      return null;
    }
  }
}
