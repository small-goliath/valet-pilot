import { confirm, input, password, select } from '@inquirer/prompts';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { loadConfig, saveConfig, getConfigPath, validateConfig } from '../config/manager.js';
import { setSecret } from '../config/keychain.js';
import type { ValetConfig, Interest } from '../types/config.js';

export interface ConfigOptions {
  get?: string;
  set?: string;
  list?: boolean;
  edit?: boolean;
}

const KEYCHAIN_SERVICE = 'valet-pilot';

/**
 * `valet-pilot config` 커맨드 핸들러.
 */
export async function runConfig(options: ConfigOptions = {}): Promise<void> {
  if (options.list) {
    await listConfig();
    return;
  }

  if (options.get) {
    await getConfigValue(options.get);
    return;
  }

  if (options.set) {
    const eqIdx = options.set.indexOf('=');
    if (eqIdx < 0) {
      console.error(chalk.red('형식 오류: --set key=value 형식으로 입력하세요.'));
      process.exit(1);
    }
    const key = options.set.slice(0, eqIdx).trim();
    const value = options.set.slice(eqIdx + 1).trim();
    await setConfigValue(key, value);
    return;
  }

  // 옵션 없음 → 대화형 설정 메뉴
  await interactiveConfig();
}

// ── --list ────────────────────────────────────────────────────

async function listConfig(): Promise<void> {
  const configPath = getConfigPath();
  console.log(chalk.bold('\n현재 설정:\n'));
  console.log(chalk.dim(`파일 위치: ${configPath}\n`));

  const config = await loadConfig();
  const dumped = yaml.dump(config, { indent: 2, lineWidth: 120 });
  console.log(dumped);
}

// ── --get ─────────────────────────────────────────────────────

async function getConfigValue(key: string): Promise<void> {
  const config = await loadConfig();
  const value = resolveKey(config, key);
  if (value === undefined) {
    console.log(chalk.yellow(`키를 찾을 수 없습니다: ${key}`));
  } else {
    console.log(`${chalk.cyan(key)}: ${JSON.stringify(value)}`);
  }
}

// ── --set ─────────────────────────────────────────────────────

async function setConfigValue(key: string, value: string): Promise<void> {
  const config = await loadConfig();
  const updated = applyKey(config, key, value);
  if (!updated) {
    console.error(chalk.red(`알 수 없는 설정 키: ${key}`));
    process.exit(1);
  }

  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error(chalk.red('설정 값이 유효하지 않습니다:'));
    errors.forEach((e) => console.error(chalk.red(`  - ${e}`)));
    process.exit(1);
  }

  await saveConfig(config);
  console.log(chalk.green(`설정이 저장되었습니다: ${key} = ${value}`));
}

// ── 대화형 메뉴 ───────────────────────────────────────────────

async function interactiveConfig(): Promise<void> {
  console.log(chalk.bold('\nValet Pilot 대화형 설정\n'));

  const category = await select({
    message: '설정할 항목을 선택하세요:',
    choices: [
      { name: 'AI 에이전트 설정', value: 'agent' },
      { name: 'API 키 설정', value: 'secrets' },
      { name: '트리거 설정', value: 'trigger' },
      { name: '관심사 설정', value: 'interests' },
      { name: 'BGM 설정', value: 'bgm' },
      { name: '세션 설정', value: 'session' },
      { name: '취소', value: 'cancel' },
    ],
  });

  if (category === 'cancel') {
    console.log(chalk.yellow('설정을 취소했습니다.'));
    return;
  }

  const config = await loadConfig();

  switch (category) {
    case 'agent':
      await configureAgent(config);
      break;
    case 'secrets':
      await configureSecrets();
      break;
    case 'trigger':
      await configureTrigger(config);
      break;
    case 'interests':
      await configureInterests(config);
      break;
    case 'bgm':
      await configureBgm(config);
      break;
    case 'session':
      await configureSession(config);
      break;
  }
}

// ── AI 에이전트 설정 ──────────────────────────────────────────

async function configureAgent(config: ValetConfig): Promise<void> {
  console.log(chalk.bold('\nAI 에이전트 설정\n'));

  config.agent.nickname = await input({
    message: 'AI 에이전트 이름:',
    default: config.agent.nickname,
  });

  config.agent.user_name = await input({
    message: 'AI가 사용자를 부를 호칭:',
    default: config.agent.user_name,
  });

  config.agent.model = await select({
    message: '기본 AI 모델:',
    choices: [
      { name: 'Kimi K2.5 (Moonshot AI)', value: 'kimi-k2.5' },
      { name: 'Claude (Anthropic)', value: 'claude' },
      { name: 'GPT (OpenAI)', value: 'gpt' },
      { name: 'Gemini (Google)', value: 'gemini' },
      { name: 'Llama (로컬 Ollama)', value: 'llama' },
    ],
    default: config.agent.model,
  });

  config.agent.language = await select({
    message: '응답 언어:',
    choices: [
      { name: '한국어', value: 'korean' },
      { name: '일본어', value: 'japanese' },
      { name: '영어', value: 'english' },
    ],
    default: config.agent.language,
  });

  if (config.agent.language === 'korean') {
    const dialectChoice = await select({
      message: '사투리:',
      choices: [
        { name: '표준어', value: '' },
        { name: '경상도', value: '경상도' },
        { name: '전라도', value: '전라도' },
        { name: '제주도', value: '제주도' },
        { name: '강원도', value: '강원도' },
        { name: '충청도', value: '충청도' },
      ],
      default: config.agent.dialect ?? '',
    });
    config.agent.dialect = dialectChoice || undefined;
  } else {
    config.agent.dialect = undefined;
  }

  config.agent.voice = await select({
    message: 'TTS 목소리:',
    choices: [
      { name: '여성 1 (female-01)', value: 'female-01' },
      { name: '여성 2 (female-02)', value: 'female-02' },
      { name: '남성 1 (male-01)', value: 'male-01' },
      { name: '남성 2 (male-02)', value: 'male-02' },
    ],
    default: config.agent.voice,
  });

  await saveConfig(config);
  console.log(chalk.green('\nAI 에이전트 설정이 저장되었습니다.'));
}

// ── API 키 설정 ───────────────────────────────────────────────

const SECRET_ACCOUNTS: Array<{ label: string; account: string }> = [
  { label: 'Moonshot API Key (kimi-k2.5)', account: 'kimi-api-key' },
  { label: 'Anthropic API Key (claude)', account: 'claude-api-key' },
  { label: 'OpenAI API Key (gpt)', account: 'openai-api-key' },
  { label: 'Google Gemini API Key (gemini)', account: 'gemini-api-key' },
  { label: 'OpenWeatherMap API Key (날씨)', account: 'openweathermap-api-key' },
  { label: 'Redmine API Key', account: 'redmine-api-key' },
];

async function configureSecrets(): Promise<void> {
  console.log(chalk.bold('\nAPI 키 설정\n'));

  const choices = [
    ...SECRET_ACCOUNTS.map((s) => ({ name: s.label, value: s.account })),
    { name: '뒤로 가기', value: 'back' },
  ];

  const account = await select({
    message: '갱신할 API 키를 선택하세요:',
    choices,
  });

  if (account === 'back') return;

  const selected = SECRET_ACCOUNTS.find((s) => s.account === account)!;
  const newKey = await password({
    message: `${selected.label} (입력 내용은 화면에 표시되지 않습니다):`,
    mask: '*',
  });

  if (!newKey) {
    console.log(chalk.yellow('입력하지 않았습니다. 기존 값이 유지됩니다.'));
    return;
  }

  await setSecret(KEYCHAIN_SERVICE, account, newKey);
  console.log(chalk.green(`${selected.label}가 Keychain에 저장되었습니다.`));
}

// ── 트리거 설정 ───────────────────────────────────────────────

async function configureTrigger(config: ValetConfig): Promise<void> {
  console.log(chalk.bold('\n트리거 설정\n'));

  config.trigger.clap.enabled = await confirm({
    message: '박수 감지 트리거 활성화:',
    default: config.trigger.clap.enabled,
  });

  if (config.trigger.clap.enabled) {
    const thresholdStr = await input({
      message: '박수 감지 임계값 (dB, 예: -30):',
      default: String(config.trigger.clap.threshold_db),
    });
    const threshold = Number(thresholdStr);
    if (!isNaN(threshold)) config.trigger.clap.threshold_db = threshold;

    const intervalStr = await input({
      message: '두 번 박수 허용 간격 (ms, 예: 800):',
      default: String(config.trigger.clap.interval_ms),
    });
    const interval = Number(intervalStr);
    if (!isNaN(interval)) config.trigger.clap.interval_ms = interval;
  }

  config.trigger.wake_word.enabled = await confirm({
    message: 'Wake word 트리거 활성화:',
    default: config.trigger.wake_word.enabled,
  });

  if (config.trigger.wake_word.enabled) {
    const wordsStr = await input({
      message: 'Wake word 목록 (쉼표로 구분):',
      default: config.trigger.wake_word.words.join(', '),
    });
    config.trigger.wake_word.words = wordsStr
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
  }

  config.trigger.keyboard.enabled = await confirm({
    message: '키보드 단축키 트리거 활성화:',
    default: config.trigger.keyboard.enabled,
  });

  if (config.trigger.keyboard.enabled) {
    config.trigger.keyboard.shortcut = await input({
      message: '키보드 단축키 (예: Ctrl+Shift+V):',
      default: config.trigger.keyboard.shortcut,
    });
  }

  await saveConfig(config);
  console.log(chalk.green('\n트리거 설정이 저장되었습니다.'));
}

// ── 관심사 설정 ───────────────────────────────────────────────

async function configureInterests(config: ValetConfig): Promise<void> {
  console.log(chalk.bold('\n관심사 설정\n'));

  const action = await select({
    message: '작업을 선택하세요:',
    choices: [
      { name: '관심사 목록 보기', value: 'list' },
      { name: '관심사 추가', value: 'add' },
      { name: '관심사 삭제', value: 'remove' },
      { name: '뒤로 가기', value: 'back' },
    ],
  });

  if (action === 'back') return;

  if (action === 'list') {
    if (config.interests.length === 0) {
      console.log(chalk.yellow('등록된 관심사가 없습니다.'));
    } else {
      config.interests.forEach((interest, idx) => {
        console.log(chalk.cyan(`  ${idx + 1}. [${interest.type}] ${interest.name ?? interest.url ?? ''}`));
      });
    }
    return;
  }

  if (action === 'add') {
    await addInterest(config);
    await saveConfig(config);
    console.log(chalk.green('\n관심사가 추가되었습니다.'));
    return;
  }

  if (action === 'remove') {
    if (config.interests.length === 0) {
      console.log(chalk.yellow('삭제할 관심사가 없습니다.'));
      return;
    }

    const choices = config.interests.map((i, idx) => ({
      name: `[${i.type}] ${i.name ?? i.url ?? `#${idx + 1}`}`,
      value: idx,
    }));

    const removeIdx = await select({
      message: '삭제할 관심사를 선택하세요:',
      choices,
    });

    config.interests.splice(removeIdx, 1);
    await saveConfig(config);
    console.log(chalk.green('\n관심사가 삭제되었습니다.'));
  }
}

async function addInterest(config: ValetConfig): Promise<void> {
  const interestType = await select({
    message: '관심사 종류를 선택하세요:',
    choices: [
      { name: 'Redmine', value: 'redmine' },
      { name: '날씨', value: 'weather' },
      { name: '커스텀 (REST API / RSS / 스크래핑 / 파일)', value: 'custom' },
    ],
  });

  if (interestType === 'redmine') {
    const url = await input({ message: 'Redmine URL:' });
    const apiKey = await password({ message: 'Redmine API Key:', mask: '*' });
    if (apiKey) {
      await setSecret(KEYCHAIN_SERVICE, 'redmine-api-key', apiKey);
      console.log(chalk.green('  API 키가 Keychain에 저장되었습니다.'));
    }
    const newInterest: Interest = { type: 'redmine', name: 'Redmine 일감', url, api_key: '${REDMINE_API_KEY}' };
    config.interests.push(newInterest);
    return;
  }

  if (interestType === 'weather') {
    const location = await input({ message: '날씨 조회 지역:', default: '서울' });
    const weatherKey = await password({ message: 'OpenWeatherMap API Key:', mask: '*' });
    if (weatherKey) {
      await setSecret(KEYCHAIN_SERVICE, 'openweathermap-api-key', weatherKey);
      console.log(chalk.green('  OpenWeatherMap API 키가 Keychain에 저장되었습니다.'));
    }
    const newInterest: Interest = { type: 'weather', name: '날씨', location };
    config.interests.push(newInterest);
    return;
  }

  // custom
  const name = await input({ message: '관심사 이름:' });
  const sourceType = await select({
    message: '데이터 소스 유형:',
    choices: [
      { name: 'REST API', value: 'rest_api' },
      { name: 'RSS/Atom', value: 'rss' },
      { name: '웹 스크래핑', value: 'scraping' },
      { name: '로컬 파일', value: 'local_file' },
    ],
  });
  const url = await input({ message: 'URL 또는 파일 경로:' });
  const extract = await input({ message: '데이터 추출 경로 (JSONPath / CSS 셀렉터, 생략 가능):' });
  const reportTemplate = await input({ message: '리포트 템플릿 (예: "현재 값은 {value}입니다."):' });

  const newInterest: Interest = {
    type: 'custom',
    name,
    url,
    source: {
      type: sourceType as Interest['source'] extends { type: infer T } ? T : never,
      method: sourceType === 'rest_api' ? 'GET' : undefined,
      extract: extract || undefined,
    },
    report_template: reportTemplate || undefined,
    schedule: 'daily',
  };
  config.interests.push(newInterest);
}

// ── BGM 설정 ──────────────────────────────────────────────────

async function configureBgm(config: ValetConfig): Promise<void> {
  console.log(chalk.bold('\nBGM 설정\n'));

  config.bgm.file = await input({
    message: 'BGM 파일 경로:',
    default: config.bgm.file,
  });

  const greetingEndStr = await input({
    message: '환영 인사 종료 시각 (초):',
    default: String(config.bgm.greeting_end),
  });
  config.bgm.greeting_end = parseFloatOrDefault(greetingEndStr, config.bgm.greeting_end);

  const shoutStartStr = await input({
    message: '힘찬 선언 시작 시각 (초):',
    default: String(config.bgm.shout_start),
  });
  config.bgm.shout_start = parseFloatOrDefault(shoutStartStr, config.bgm.shout_start);

  const shoutEndStr = await input({
    message: '힘찬 선언 종료 시각 (초):',
    default: String(config.bgm.shout_end),
  });
  config.bgm.shout_end = parseFloatOrDefault(shoutEndStr, config.bgm.shout_end);

  const reportStartStr = await input({
    message: '리포트 시작 시각 (초):',
    default: String(config.bgm.report_start),
  });
  config.bgm.report_start = parseFloatOrDefault(reportStartStr, config.bgm.report_start);

  const maxDurationStr = await input({
    message: 'BGM 최대 재생 시간 (초):',
    default: String(config.bgm.max_duration),
  });
  config.bgm.max_duration = parseFloatOrDefault(maxDurationStr, config.bgm.max_duration);

  await saveConfig(config);
  console.log(chalk.green('\nBGM 설정이 저장되었습니다.'));
}

// ── 세션 설정 ─────────────────────────────────────────────────

async function configureSession(config: ValetConfig): Promise<void> {
  console.log(chalk.bold('\n세션 설정\n'));

  const keywordsStr = await input({
    message: '세션 종료 키워드 (쉼표로 구분):',
    default: config.session.end_keywords.join(', '),
  });
  config.session.end_keywords = keywordsStr
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

  const autoEndStr = await input({
    message: '무응답 자동 종료 시간 (분):',
    default: String(config.session.auto_end_minutes),
  });
  const autoEnd = Number(autoEndStr);
  if (!isNaN(autoEnd) && autoEnd > 0) config.session.auto_end_minutes = autoEnd;

  config.session.farewell_enabled = await confirm({
    message: '종료 인사 활성화:',
    default: config.session.farewell_enabled,
  });

  await saveConfig(config);
  console.log(chalk.green('\n세션 설정이 저장되었습니다.'));
}

// ── 내부 유틸 ─────────────────────────────────────────────────

/**
 * 점(.) 으로 구분된 키 경로를 사용해 config 에서 값을 읽습니다.
 * 예: "agent.model" → config.agent.model
 */
function resolveKey(config: ValetConfig, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = config;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * 점(.) 으로 구분된 키 경로를 사용해 config 에 값을 설정합니다.
 * 최종 값은 문자열로 받아 가능한 경우 숫자/불리언으로 변환합니다.
 * 존재하지 않는 키면 false를 반환합니다.
 */
function applyKey(config: ValetConfig, key: string, rawValue: string): boolean {
  const parts = key.split('.');
  let current: unknown = config;

  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof current !== 'object' || current === null) return false;
    current = (current as Record<string, unknown>)[parts[i]];
  }

  if (typeof current !== 'object' || current === null) return false;

  const leaf = parts[parts.length - 1];
  const target = current as Record<string, unknown>;

  if (!(leaf in target)) return false;

  // 타입 변환
  const existingType = typeof target[leaf];
  if (existingType === 'number') {
    const num = Number(rawValue);
    if (isNaN(num)) return false;
    target[leaf] = num;
  } else if (existingType === 'boolean') {
    target[leaf] = rawValue === 'true' || rawValue === '1';
  } else {
    target[leaf] = rawValue;
  }

  return true;
}

function parseFloatOrDefault(str: string, defaultValue: number): number {
  const v = parseFloat(str);
  return isNaN(v) ? defaultValue : v;
}
