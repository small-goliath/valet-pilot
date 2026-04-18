import { select, input, password, checkbox } from '@inquirer/prompts';
import type { ValetConfig, WorkTool, Interest } from '../../types/config.js';
import { saveConfig } from '../config/index.js';

export async function runSetupWizard(): Promise<void> {
  console.log('\n🤵 Valet Pilot 초기 설정을 시작합니다.\n');

  // 1. 닉네임
  const agent_nickname = await input({
    message: 'AI 에이전트 닉네임을 입력하세요 (예: 자비스, 버디):',
    validate: (v) => v.trim().length > 0 || '닉네임을 입력해주세요.',
  });

  // 2. AI 모델
  const ai_model = await select({
    message: 'AI 모델을 선택하세요:',
    choices: [
      { name: 'Moonshot AI (Kimi) — 기본 추천', value: 'moonshot' },
      { name: 'Anthropic (Claude)', value: 'anthropic' },
      { name: 'OpenAI (GPT)', value: 'openai' },
    ],
  });

  const modelLabel: Record<string, string> = {
    moonshot: 'Moonshot AI API Key',
    anthropic: 'Anthropic API Key',
    openai: 'OpenAI API Key',
  };

  const ai_api_key = await password({
    message: `${modelLabel[ai_model]}를 입력하세요:`,
    mask: '*',
    validate: (v) => v.trim().length > 0 || 'API Key를 입력해주세요.',
  });

  // 3. 언어
  const language = await select({
    message: '응답 언어를 선택하세요:',
    choices: [
      { name: '한국어', value: 'korean' },
      { name: '日本語', value: 'japanese' },
      { name: 'English', value: 'english' },
    ],
  });

  // 4. 사투리 (한국어일 때만)
  let dialect: string | undefined;
  if (language === 'korean') {
    dialect = await select({
      message: '사투리를 선택하세요:',
      choices: [
        { name: '표준어', value: 'standard' },
        { name: '경상도', value: 'gyeong-sang' },
        { name: '전라도', value: 'jeolla' },
        { name: '충청도', value: 'chung-cheong' },
        { name: '제주도', value: 'jeju' },
        { name: '강원도', value: 'gang-won' },
      ],
    });
  }

  // 5. STT 모드
  let stt_mode: 'online' | 'offline';
  if (ai_model === 'openai') {
    stt_mode = await select({
      message: '음성 인식(STT) 모드를 선택하세요:',
      choices: [
        { name: '온라인 (OpenAI Whisper API) — 기본 추천', value: 'online' },
        { name: '오프라인 (whisper.cpp 로컬) — SoX 필요', value: 'offline' },
      ],
    });
  } else {
    console.log(
      `\n  ℹ️  ${ai_model === 'anthropic' ? 'Anthropic' : 'Moonshot'} 모델은 STT API를 제공하지 않습니다.`
    );
    console.log(`     음성 인식은 로컬 whisper.cpp(오프라인)로 자동 설정됩니다. (SoX 필요)\n`);
    stt_mode = 'offline';
  }

  // 6. 업무 툴
  const work_tool_type = await select<'redmine' | 'jira'>({
    message: '업무 툴을 선택하세요 (하나만 선택):',
    choices: [
      { name: 'Redmine', value: 'redmine' },
      { name: 'JIRA', value: 'jira' },
    ],
  });

  const work_tool = await promptWorkTool(work_tool_type);

  // 7. 관심사
  const interest_ids = await checkbox({
    message: '관심사를 선택하세요 (스페이스바로 선택, 엔터로 확인):',
    choices: [
      { name: '날씨', value: 'weather' },
      { name: '주식', value: 'stock' },
      { name: '사용자 지정', value: 'custom' },
    ],
  });

  const interests: Interest[] = await promptInterests(interest_ids);

  const config: ValetConfig = {
    agent_nickname: agent_nickname.trim(),
    ai_model: ai_model as ValetConfig['ai_model'],
    ai_api_key: ai_api_key.trim(),
    language: language as ValetConfig['language'],
    ...(dialect ? { dialect: dialect as ValetConfig['dialect'] } : {}),
    stt_mode,
    work_tool,
    interests,
    registered_apps: [],
  };

  saveConfig(config);

  console.log(`\n✅ 설정이 완료되었습니다.`);
  console.log(`   'valet-pilot start'로 에이전트를 시작하세요.\n`);
}

async function promptWorkTool(type: 'redmine' | 'jira'): Promise<WorkTool> {
  if (type === 'redmine') {
    const base_url = await input({
      message: 'Redmine 서버 URL (예: https://redmine.example.com):',
      validate: (v) => v.startsWith('http') || '유효한 URL을 입력해주세요.',
    });
    const api_key = await password({
      message: 'Redmine API Key:',
      mask: '*',
      validate: (v) => v.trim().length > 0 || 'API Key를 입력해주세요.',
    });
    return {
      type: 'redmine',
      base_url: base_url.trim(),
      auth_type: 'api_key',
      api_key: api_key.trim(),
    };
  }

  // JIRA
  const jira_type = await select<'cloud' | 'server_pat'>({
    message: 'JIRA 유형을 선택하세요:',
    choices: [
      { name: 'JIRA Cloud (Atlassian 계정)', value: 'cloud' },
      { name: 'JIRA Server / Data Center (Personal Access Token)', value: 'server_pat' },
    ],
  });

  const base_url = await input({
    message: 'JIRA 서버 URL (예: https://yourcompany.atlassian.net):',
    validate: (v) => v.startsWith('http') || '유효한 URL을 입력해주세요.',
  });

  if (jira_type === 'cloud') {
    const email = await input({
      message: 'Atlassian 계정 이메일:',
      validate: (v) => v.includes('@') || '유효한 이메일을 입력해주세요.',
    });
    const api_key = await password({
      message: 'JIRA API Token:',
      mask: '*',
      validate: (v) => v.trim().length > 0 || 'API Token을 입력해주세요.',
    });
    return {
      type: 'jira',
      base_url: base_url.trim(),
      auth_type: 'cloud',
      api_key: api_key.trim(),
      email: email.trim(),
    };
  }

  const api_key = await password({
    message: 'JIRA Personal Access Token:',
    mask: '*',
    validate: (v) => v.trim().length > 0 || 'Token을 입력해주세요.',
  });
  return {
    type: 'jira',
    base_url: base_url.trim(),
    auth_type: 'server_pat',
    api_key: api_key.trim(),
  };
}

async function promptInterests(ids: string[]): Promise<Interest[]> {
  const interests: Interest[] = [];

  if (ids.includes('weather')) {
    const api_key = await password({
      message: 'OpenWeatherMap API Key:',
      mask: '*',
      validate: (v) => v.trim().length > 0 || 'API Key를 입력해주세요.',
    });
    const location = await input({
      message: '날씨 조회 위치 (예: Seoul, KR):',
      default: 'Seoul, KR',
    });
    interests.push({
      id: 'weather',
      name: '날씨',
      auth: { api_key: api_key.trim(), location: location.trim() },
    });
  }

  if (ids.includes('stock')) {
    const api_key = await password({
      message: 'Finnhub API Key:',
      mask: '*',
      validate: (v) => v.trim().length > 0 || 'API Key를 입력해주세요.',
    });
    const tickers = await input({
      message: '조회할 주식 티커 목록 (쉼표 구분, 예: AAPL,TSLA,005930.KS):',
      validate: (v) => v.trim().length > 0 || '티커를 하나 이상 입력해주세요.',
    });
    interests.push({
      id: 'stock',
      name: '주식',
      auth: {
        api_key: api_key.trim(),
        tickers: tickers.split(',').map((t) => t.trim()).join(','),
      },
    });
  }

  if (ids.includes('custom')) {
    const endpoint = await input({
      message: '사용자 지정 API 엔드포인트 URL:',
      validate: (v) => v.startsWith('http') || '유효한 URL을 입력해주세요.',
    });
    const name = await input({
      message: '이 관심사의 이름 (예: 사내공지):',
      default: '사용자 지정',
    });
    interests.push({
      id: 'custom',
      name: name.trim(),
      auth: {},
      custom_config: { endpoint: endpoint.trim() },
    });
  }

  return interests;
}
