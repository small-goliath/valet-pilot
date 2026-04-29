import { confirm, input, password, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { ensureValetDirs, VALET_DIRS } from '../utils/dirs.js';
import { loadConfig, saveConfig } from '../config/manager.js';
import { setSecret } from '../config/keychain.js';
import type { ValetConfig } from '../types/config.js';

export interface InitOptions {
  force?: boolean;
}

const KEYCHAIN_SERVICE = 'valet-pilot';

/**
 * `valet-pilot init` 커맨드 핸들러.
 * 디렉토리 생성 → 대화형 설정 → config.yaml 저장 → API 키 Keychain 저장
 */
export async function runInit(options: InitOptions = {}): Promise<void> {
  console.log(chalk.bold('\nValet Pilot 초기 설정을 시작합니다.\n'));

  // ── 이미 초기화된 경우 경고 ──────────────────────────────────
  const proceed =
    options.force ||
    (await confirm({
      message: `${chalk.cyan(VALET_DIRS.root)} 디렉토리를 생성하고 초기화하겠습니까?`,
      default: true,
    }));

  if (!proceed) {
    console.log(chalk.yellow('초기화를 취소했습니다.'));
    return;
  }

  try {
    // ── 디렉토리 생성 ─────────────────────────────────────────
    await ensureValetDirs();
    console.log(chalk.green('\n디렉토리 구조가 생성되었습니다.'));

    // ── 현재 config 로드 (이미 있으면 기본값으로 채워진 값을 사용) ──
    const config: ValetConfig = await loadConfig();

    // ── 1. 닉네임 ─────────────────────────────────────────────
    config.agent.nickname = await input({
      message: 'AI 에이전트 닉네임을 입력하세요:',
      default: config.agent.nickname,
    });

    // ── 2. AI 모델 선택 ───────────────────────────────────────
    config.agent.model = await select({
      message: '기본 AI 모델을 선택하세요:',
      choices: [
        { name: 'Kimi K2.5 (Moonshot AI, 기본값)', value: 'kimi-k2.5' },
        { name: 'Claude (Anthropic)', value: 'claude' },
        { name: 'GPT (OpenAI)', value: 'gpt' },
        { name: 'Gemini (Google)', value: 'gemini' },
        { name: 'Llama (로컬 Ollama)', value: 'llama' },
      ],
      default: config.agent.model,
    });

    // ── 3. 선택한 모델의 API 키 ──────────────────────────────
    const MODEL_KEY_MAP: Record<string, { account: string; label: string } | null> = {
      'kimi-k2.5': { account: 'kimi-api-key', label: 'Moonshot API Key' },
      'claude':    { account: 'claude-api-key', label: 'Anthropic API Key' },
      'gpt':       { account: 'openai-api-key', label: 'OpenAI API Key' },
      'gemini':    { account: 'gemini-api-key', label: 'Google Gemini API Key' },
      'llama':     null, // 로컬 Ollama — API 키 불필요
    };

    const modelKeyInfo = MODEL_KEY_MAP[config.agent.model];
    if (modelKeyInfo) {
      const apiKeyInput = await password({
        message: `${modelKeyInfo.label}를 입력하세요 (입력 내용은 화면에 표시되지 않습니다):`,
        mask: '*',
      });
      if (apiKeyInput) {
        await setSecret(KEYCHAIN_SERVICE, modelKeyInfo.account, apiKeyInput);
        console.log(chalk.green(`  ${modelKeyInfo.label}가 Keychain에 저장되었습니다.`));
      } else {
        console.log(chalk.yellow(`  ${modelKeyInfo.label}를 입력하지 않았습니다. 나중에 직접 설정하세요.`));
      }
    }

    // ── 4. 언어 ───────────────────────────────────────────────
    config.agent.language = await select({
      message: '응답 언어를 선택하세요:',
      choices: [
        { name: '한국어', value: 'korean' },
        { name: '일본어', value: 'japanese' },
        { name: '영어', value: 'english' },
      ],
      default: config.agent.language,
    });

    // ── 5. 사투리 (한국어일 때만) ─────────────────────────────
    if (config.agent.language === 'korean') {
      const dialectChoice = await select({
        message: '사투리를 선택하세요:',
        choices: [
          { name: '표준어 (기본값)', value: '' },
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

    // ── 6. 목소리 ─────────────────────────────────────────────
    config.agent.voice = await select({
      message: 'TTS 목소리를 선택하세요:',
      choices: [
        { name: '여성 1 (female-01, 기본값)', value: 'female-01' },
        { name: '여성 2 (female-02)', value: 'female-02' },
        { name: '남성 1 (male-01)', value: 'male-01' },
        { name: '남성 2 (male-02)', value: 'male-02' },
      ],
      default: config.agent.voice,
    });

    // ── 7. Redmine 연동 ───────────────────────────────────────
    const useRedmine = await confirm({
      message: 'Redmine을 관심사로 등록하겠습니까?',
      default: config.interests.some((i) => i.type === 'redmine'),
    });

    if (useRedmine) {
      const redmineUrl = await input({
        message: 'Redmine URL을 입력하세요:',
        default: config.interests.find((i) => i.type === 'redmine')?.url ?? 'https://redmine.example.com',
      });

      const redmineApiKey = await password({
        message: 'Redmine API Key (입력 내용은 화면에 표시되지 않습니다):',
        mask: '*',
      });

      if (redmineApiKey) {
        await setSecret(KEYCHAIN_SERVICE, 'redmine-api-key', redmineApiKey);
        console.log(chalk.green('  Redmine API 키가 Keychain에 저장되었습니다.'));
      }

      // interests 배열에서 기존 redmine 항목 교체 또는 추가
      const redmineIdx = config.interests.findIndex((i) => i.type === 'redmine');
      const redmineInterest = {
        type: 'redmine',
        name: 'Redmine 일감',
        url: redmineUrl,
        api_key: '${REDMINE_API_KEY}',
      };
      if (redmineIdx >= 0) {
        config.interests[redmineIdx] = redmineInterest;
      } else {
        config.interests.push(redmineInterest);
      }
    }

    // ── 8. 날씨 위치 ──────────────────────────────────────────
    const useWeather = await confirm({
      message: '날씨 관심사를 등록하겠습니까?',
      default: config.interests.some((i) => i.type === 'weather'),
    });

    if (useWeather) {
      const weatherLocation = await input({
        message: '날씨 조회 지역을 입력하세요:',
        default: config.interests.find((i) => i.type === 'weather')?.location ?? '서울',
      });

      const weatherApiKey = await password({
        message: 'OpenWeatherMap API Key (입력 내용은 화면에 표시되지 않습니다):',
        mask: '*',
      });
      if (weatherApiKey) {
        await setSecret(KEYCHAIN_SERVICE, 'openweathermap-api-key', weatherApiKey);
        console.log(chalk.green('  OpenWeatherMap API 키가 Keychain에 저장되었습니다.'));
      } else {
        console.log(chalk.yellow('  OpenWeatherMap API 키를 입력하지 않았습니다. 나중에 직접 설정하세요.'));
      }

      const weatherIdx = config.interests.findIndex((i) => i.type === 'weather');
      const weatherInterest = {
        type: 'weather',
        name: '날씨',
        location: weatherLocation,
      };
      if (weatherIdx >= 0) {
        config.interests[weatherIdx] = weatherInterest;
      } else {
        config.interests.push(weatherInterest);
      }
    }

    // ── 9. 트리거 on/off ──────────────────────────────────────
    console.log(chalk.bold('\n트리거 설정\n'));

    config.trigger.clap.enabled = await confirm({
      message: '박수 감지 트리거를 활성화하겠습니까?',
      default: config.trigger.clap.enabled,
    });

    config.trigger.wake_word.enabled = await confirm({
      message: 'Wake word 트리거를 활성화하겠습니까?',
      default: config.trigger.wake_word.enabled,
    });

    config.trigger.keyboard.enabled = await confirm({
      message: `키보드 단축키 트리거(${config.trigger.keyboard.shortcut})를 활성화하겠습니까?`,
      default: config.trigger.keyboard.enabled,
    });

    // ── config.yaml 저장 ──────────────────────────────────────
    await saveConfig(config);

    console.log(chalk.green('\n초기화가 완료되었습니다!'));
    console.log(chalk.dim(`설정 파일: ${VALET_DIRS.config}/config.yaml`));
    console.log(chalk.dim('\nvalet-pilot config 명령어로 추가 설정을 변경할 수 있습니다.'));
  } catch (err) {
    console.error(chalk.red('\n초기화 중 오류가 발생했습니다:'), err);
    process.exit(1);
  }
}
