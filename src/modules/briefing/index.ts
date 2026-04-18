import path from 'path';
import { fileURLToPath } from 'url';
import { speak, playBGMBackground, waitMs, dialectSystemPrompt } from '../tts/index.js';
import { collectInterests } from '../interests/index.js';
import { createAIAdapter } from '../../adapters/ai.js';
import type { ValetConfig } from '../../types/config.js';

// BGM 타임코드 (ms)
const TC_GREETING_END = 51600;   // 환영 인사 구간 종료
const TC_START_PHRASE = 51700;   // 시작 멘트 시작
const TC_START_PHRASE_END = 53000; // 시작 멘트 종료
const TC_REPORT_START = 53200;   // 관심사 리포트 시작

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BGM_PATH = path.resolve(__dirname, '../../../bgm/opening.mp3');

/**
 * 오프닝 브리핑 전체 실행
 *
 * 흐름:
 * [0s] BGM 시작 + 환영 인사 TTS (0~51.6s 구간)
 * [51.7s] 시작 멘트 TTS (1.3s 이내)
 * [53.2s~] 관심사 리포트 TTS 순차 출력
 * [완료] BGM 종료 → 업무 지시 대기로 복귀
 */
export async function runOpeningBriefing(config: ValetConfig): Promise<void> {
  const ai = createAIAdapter(config);

  console.log('\n🎵 오프닝 브리핑을 시작합니다...\n');

  // ── 사전 준비: 관심사 데이터 수집 (BGM 시작 전 병렬 시작)
  const interestPromise = collectInterests(config, ai).catch((err) => {
    console.warn(`  ⚠️  관심사 수집 오류: ${err instanceof Error ? err.message : err}`);
    return [];
  });

  // ── BGM 시작
  const stopBGM = playBGMBackground(BGM_PATH, 0.35);
  const bgmStartTime = Date.now();

  try {
    // ── 환영 인사 생성 (AI 추천 멘트, 51.6초 이내 발화 조건)
    const greetingScript = await generateGreeting(config, ai);

    // ── 환영 인사 TTS 재생
    const greetingDuration = await speak(greetingScript, config, 1.0);

    // ── 51.6초 타임코드까지 남은 시간 패딩
    const elapsed = Date.now() - bgmStartTime;
    const paddingBeforeStartPhrase = TC_START_PHRASE - elapsed;
    if (paddingBeforeStartPhrase > 0) {
      await waitMs(paddingBeforeStartPhrase);
    }

    // ── 시작 멘트 TTS (1.3초 이내의 짧고 강렬한 멘트)
    const startPhrase = buildStartPhrase(config);
    await speak(startPhrase, config, 1.0);

    // ── 53.2초 타임코드까지 남은 시간 패딩
    const elapsed2 = Date.now() - bgmStartTime;
    const paddingBeforeReport = TC_REPORT_START - elapsed2;
    if (paddingBeforeReport > 0) {
      await waitMs(paddingBeforeReport);
    }

    // ── 관심사 리포트 순차 출력
    const reports = await interestPromise;
    for (const report of reports) {
      console.log(`  📋 [${report.section}] ${report.script}`);
      await speak(report.script, config, 1.0);
    }

    if (reports.length === 0) {
      const noReport = buildNoReportScript(config);
      await speak(noReport, config, 1.0);
    }
  } finally {
    // ── BGM 종료
    stopBGM();
    console.log('\n✅ 브리핑 완료. 업무 지시를 말씀해주세요.\n');
  }
}

/**
 * AI 추천 환영 인사 생성
 * 조건: 51.6초 이내 발화 완료 가능한 길이 (한국어 약 350자 이내)
 */
async function generateGreeting(config: ValetConfig, ai: ReturnType<typeof createAIAdapter>): Promise<string> {
  const dialectPrompt = dialectSystemPrompt(config);
  const systemPrompt = [
    '당신은 개인 AI 비서입니다.',
    '주인을 환영하는 아침 인사를 작성해주세요.',
    '조건: 소리 내어 읽었을 때 51초 이내에 완료될 분량 (약 300자 이내).',
    '자연스럽고 따뜻하며 활기찬 톤으로 작성하세요.',
    dialectPrompt,
  ].filter(Boolean).join(' ');

  const userPrompt = `에이전트 이름: ${config.agent_nickname}. 언어: ${config.language}. 오늘 하루를 시작하는 환영 인사를 작성해주세요.`;

  try {
    return await ai.chat(userPrompt, systemPrompt);
  } catch {
    return buildFallbackGreeting(config);
  }
}

/**
 * 시작 멘트 (강렬하고 짧은, 1.3초 이내)
 */
function buildStartPhrase(config: ValetConfig): string {
  const phrases: Record<string, string[]> = {
    korean: ['드가자!', 'Go!', '시작!', '달려!'],
    japanese: ['行くぞ!', 'Go!', 'スタート!'],
    english: ['Let\'s go!', 'Go!', 'Start!'],
  };
  const list = phrases[config.language] ?? phrases['korean'];
  return list[Math.floor(Math.random() * list.length)];
}

function buildFallbackGreeting(config: ValetConfig): string {
  const greetings: Record<string, string> = {
    korean: `안녕하세요! ${config.agent_nickname}입니다. 오늘도 좋은 하루 시작하겠습니다.`,
    japanese: `おはようございます！${config.agent_nickname}です。今日も良い一日を始めましょう。`,
    english: `Good morning! I'm ${config.agent_nickname}. Let's have a great day today.`,
  };
  return greetings[config.language] ?? greetings['korean'];
}

function buildNoReportScript(config: ValetConfig): string {
  const scripts: Record<string, string> = {
    korean: '오늘의 관심사 리포트가 없습니다. 업무를 시작하세요.',
    japanese: '今日の関心事レポートはありません。仕事を始めましょう。',
    english: 'No interest reports for today. Let\'s get to work.',
  };
  return scripts[config.language] ?? scripts['korean'];
}
