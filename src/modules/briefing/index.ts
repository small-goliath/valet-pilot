import path from 'path';
import { fileURLToPath } from 'url';
import { speak, playBGMBackground, waitMs, dialectSystemPrompt } from '../tts/index.js';
import { createAIAdapter } from '../../adapters/ai.js';
import type { AIAdapter } from '../../adapters/ai.js';
import type { InterestReport } from '../interests/index.js';
import type { ValetConfig } from '../../types/config.js';

// BGM 타임코드 (ms)
const TC_START_PHRASE = 51700;
const TC_REPORT_START = 53200;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BGM_PATH = path.resolve(__dirname, '../../../bgm/opening.mp3');

/**
 * 오프닝 브리핑 전체 실행
 *
 * @param config 사용자 설정
 * @param ai     호출자에서 생성한 AI 어댑터 (A: 조기 생성)
 * @param interestPromise 호출자에서 이미 시작된 관심사 수집 Promise (A: 조기 수집)
 */
export async function runOpeningBriefing(
  config: ValetConfig,
  ai: AIAdapter,
  interestPromise: Promise<InterestReport[]>
): Promise<void> {
  console.log('\n🎵 오프닝 브리핑을 시작합니다...\n');

  // ── BGM 시작
  const stopBGM = playBGMBackground(BGM_PATH, 0.35);
  const bgmStartTime = Date.now();

  try {
    // ── 환영 인사 생성 + TTS 재생
    const greetingScript = await generateGreeting(config, ai);
    console.log(`  ⏱  인사 생성 완료: ${((Date.now() - bgmStartTime) / 1000).toFixed(1)}s`);
    await speak(greetingScript, config, 1.0);
    console.log(`  ⏱  인사 TTS 완료: ${((Date.now() - bgmStartTime) / 1000).toFixed(1)}s (목표: ${TC_START_PHRASE / 1000}s)`);

    // ── 51.7초 타임코드까지 패딩
    const paddingBeforeStartPhrase = TC_START_PHRASE - (Date.now() - bgmStartTime);
    if (paddingBeforeStartPhrase > 0) await waitMs(paddingBeforeStartPhrase);
    console.log(`  ⏱  시작 멘트 시작: ${((Date.now() - bgmStartTime) / 1000).toFixed(1)}s`);

    // ── 시작 멘트 (1.3초 이내)
    await speak(buildStartPhrase(config), config, 1.0);

    // ── 53.2초 타임코드까지 패딩
    const paddingBeforeReport = TC_REPORT_START - (Date.now() - bgmStartTime);
    if (paddingBeforeReport > 0) await waitMs(paddingBeforeReport);
    console.log(`  ⏱  리포트 시작: ${((Date.now() - bgmStartTime) / 1000).toFixed(1)}s (목표: ${TC_REPORT_START / 1000}s)`);

    // ── B: 데드라인 기반 대기
    // 53.2초 도달 시점에 준비된 결과만 사용. 초과 시 빈 배열로 대행.
    const reports = await waitForReportsWithDeadline(interestPromise, bgmStartTime);

    if (reports.length === 0) {
      await speak(buildNoReportScript(config), config, 1.0);
    } else {
      for (const report of reports) {
        console.log(`  📋 [${report.section}] ${report.script}`);
        await speak(report.script, config, 1.0);
      }
    }
  } finally {
    stopBGM();
    console.log('\n✅ 브리핑 완료. 업무 지시를 말씀해주세요.\n');
  }
}

/**
 * B: 53.2초 데드라인 + 2초 유예를 초과하면 현재까지 완료된 결과만 반환.
 * interestPromise는 이미 병렬 실행 중이므로 대부분 즉시 resolve됨.
 */
async function waitForReportsWithDeadline(
  interestPromise: Promise<InterestReport[]>,
  bgmStartTime: number
): Promise<InterestReport[]> {
  const deadline = bgmStartTime + TC_REPORT_START + 2000; // 55.2초
  const remaining = deadline - Date.now();

  if (remaining <= 0) {
    // 이미 데드라인 초과 → 즉시 가져오기 시도
    return await Promise.race([
      interestPromise,
      Promise.resolve([]),
    ]);
  }

  return await Promise.race([
    interestPromise,
    new Promise<InterestReport[]>((resolve) => setTimeout(() => resolve([]), remaining)),
  ]);
}

const GREETING_TIMEOUT_MS = 10000;

async function generateGreeting(config: ValetConfig, ai: AIAdapter): Promise<string> {
  const dialectPrompt = dialectSystemPrompt(config);
  const systemPrompt = [
    '당신은 개인 AI 비서입니다.',
    '주인을 환영하는 아침 인사를 작성해주세요.',
    '조건: 소리 내어 읽었을 때 35~40초가 걸리는 분량으로 작성하세요 (약 400~450자).',
    '자연스럽고 따뜻하며 활기찬 톤으로 작성하세요.',
    dialectPrompt,
  ].filter(Boolean).join(' ');

  const userPrompt = `에이전트 이름: ${config.agent_nickname}. 언어: ${config.language}. 오늘 하루를 시작하는 환영 인사를 작성해주세요.`;

  try {
    const result = await Promise.race([
      ai.chat(userPrompt, systemPrompt),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), GREETING_TIMEOUT_MS)),
    ]);
    return result ?? buildFallbackGreeting(config);
  } catch {
    return buildFallbackGreeting(config);
  }
}

function buildStartPhrase(config: ValetConfig): string {
  const phrases: Record<string, string[]> = {
    korean: ['드가자!', 'Go!', '시작!', '달려!'],
    japanese: ['行くぞ!', 'Go!', 'スタート!'],
    english: ["Let's go!", 'Go!', 'Start!'],
  };
  const list = phrases[config.language] ?? phrases['korean'];
  return list[Math.floor(Math.random() * list.length)];
}

function buildFallbackGreeting(config: ValetConfig): string {
  const greetings: Record<string, string> = {
    korean: `안녕하세요! ${config.agent_nickname}입니다. 새로운 하루가 밝았습니다. 어제 하루도 정말 수고 많으셨습니다. 오늘도 힘차게 시작해볼까요? 오늘 하루는 어떤 멋진 일들이 기다리고 있을지 기대가 됩니다. 업무를 시작하기 전, 잠깐 심호흡 한 번 하시고 마음을 가다듬어 보세요. 작은 것 하나하나에 최선을 다하다 보면, 하루가 끝날 때 분명 뿌듯함을 느끼실 수 있을 거예요. ${config.agent_nickname}이 오늘 하루도 최선을 다해 도와드리겠습니다. 자, 이제 오늘의 브리핑을 시작하겠습니다.`,
    japanese: `おはようございます！${config.agent_nickname}です。新しい一日が始まりました。昨日も一日お疲れ様でした。今日も元気よくスタートしましょうか。今日はどんな素晴らしいことが待っているか、とても楽しみです。業務を始める前に、少し深呼吸をして、気持ちを整えてみてください。一つ一つのことに全力を尽くせば、一日の終わりに必ず充実感を感じることができると思います。${config.agent_nickname}が今日も全力でサポートいたします。では、本日のブリーフィングを始めます。`,
    english: `Good morning! I'm ${config.agent_nickname}. A brand new day has arrived. I hope you had a good rest yesterday. Are you ready to start today with full energy? I'm excited to see what wonderful things this day has in store for you. Before we dive into work, take a moment to breathe deeply and collect your thoughts. When you give your best to each task, big or small, you'll feel a great sense of accomplishment by the end of the day. I'm ${config.agent_nickname}, and I'll be here supporting you every step of the way. Now, let's begin today's briefing.`,
  };
  return greetings[config.language] ?? greetings['korean'];
}

function buildNoReportScript(config: ValetConfig): string {
  const scripts: Record<string, string> = {
    korean: '오늘의 관심사 리포트가 없습니다. 업무를 시작하세요.',
    japanese: '今日の関心事レポートはありません。仕事を始めましょう。',
    english: "No interest reports for today. Let's get to work.",
  };
  return scripts[config.language] ?? scripts['korean'];
}
