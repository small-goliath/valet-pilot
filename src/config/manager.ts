// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 설정 파일 읽기/쓰기 관리
// ────────────────────────────────────────────────────────────────

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { VALET_DIRS, ensureValetDirs } from '../utils/dirs.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type { ValetConfig } from '../types/config.js';

const CONFIG_FILENAME = 'config.yaml';

/** config.yaml 파일의 절대 경로를 반환합니다. */
export function getConfigPath(): string {
  return join(VALET_DIRS.config, CONFIG_FILENAME);
}

/**
 * config.yaml을 읽어 ValetConfig 를 반환합니다.
 * 파일이 없으면 DEFAULT_CONFIG 를 반환합니다.
 */
export async function loadConfig(): Promise<ValetConfig> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return structuredClone(DEFAULT_CONFIG);
  }

  const raw = await readFile(configPath, 'utf-8');
  const parsed = yaml.load(raw) as Partial<ValetConfig>;

  // 최상위 섹션 단위로 기본값과 병합 (깊은 병합)
  return mergeWithDefaults(parsed);
}

/**
 * ValetConfig 를 config.yaml 파일에 저장합니다.
 * 디렉토리가 없으면 자동 생성합니다.
 */
export async function saveConfig(config: ValetConfig): Promise<void> {
  await ensureValetDirs();
  const configPath = getConfigPath();
  const content = yaml.dump(config, {
    indent: 2,
    lineWidth: 120,
    quotingType: '"',
    forceQuotes: false,
  });
  await writeFile(configPath, content, 'utf-8');
}

/**
 * config 의 필수 필드를 검증합니다.
 * 오류가 있으면 오류 메시지 배열을 반환하고, 없으면 빈 배열을 반환합니다.
 */
export function validateConfig(config: Partial<ValetConfig>): string[] {
  const errors: string[] = [];

  if (!config.agent) {
    errors.push('agent 섹션이 없습니다.');
  } else {
    if (!config.agent.nickname) errors.push('agent.nickname 이 비어 있습니다.');
    if (!config.agent.model) errors.push('agent.model 이 설정되지 않았습니다.');
    if (!config.agent.language) errors.push('agent.language 가 설정되지 않았습니다.');
    if (!config.agent.voice) errors.push('agent.voice 가 설정되지 않았습니다.');

    const validModels = ['kimi-k2.5', 'claude', 'gpt', 'gemini', 'llama'] as const;
    if (config.agent.model && !validModels.includes(config.agent.model)) {
      errors.push(`agent.model 이 유효하지 않습니다: ${config.agent.model}`);
    }

    const validLanguages = ['korean', 'japanese', 'english'] as const;
    if (config.agent.language && !validLanguages.includes(config.agent.language)) {
      errors.push(`agent.language 가 유효하지 않습니다: ${config.agent.language}`);
    }
  }

  if (!config.trigger) {
    errors.push('trigger 섹션이 없습니다.');
  }

  if (!config.bgm) {
    errors.push('bgm 섹션이 없습니다.');
  } else {
    if (!config.bgm.file) errors.push('bgm.file 이 설정되지 않았습니다.');
  }

  if (!config.session) {
    errors.push('session 섹션이 없습니다.');
  }

  if (!config.stt) {
    errors.push('stt 섹션이 없습니다.');
  } else {
    const validWhisperModels = ['small', 'medium', 'large-v3'] as const;
    if (config.stt.whisper_model && !validWhisperModels.includes(config.stt.whisper_model)) {
      errors.push(`stt.whisper_model 이 유효하지 않습니다: ${config.stt.whisper_model}`);
    }
  }

  return errors;
}

// ── 내부 헬퍼 ──────────────────────────────────────────────────

/**
 * 파일에서 읽은 부분적 설정을 DEFAULT_CONFIG 와 최상위 섹션 단위로 병합합니다.
 */
function mergeWithDefaults(partial: Partial<ValetConfig>): ValetConfig {
  return {
    agent: { ...DEFAULT_CONFIG.agent, ...partial.agent },
    trigger: {
      clap: { ...DEFAULT_CONFIG.trigger.clap, ...partial.trigger?.clap },
      wake_word: { ...DEFAULT_CONFIG.trigger.wake_word, ...partial.trigger?.wake_word },
      keyboard: { ...DEFAULT_CONFIG.trigger.keyboard, ...partial.trigger?.keyboard },
    },
    bgm: { ...DEFAULT_CONFIG.bgm, ...partial.bgm },
    session: { ...DEFAULT_CONFIG.session, ...partial.session },
    stt: { ...DEFAULT_CONFIG.stt, ...partial.stt },
    cache: { ...DEFAULT_CONFIG.cache, ...partial.cache },
    interests: partial.interests ?? DEFAULT_CONFIG.interests,
  };
}
