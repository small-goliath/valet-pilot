import { configExists, loadConfig } from '../modules/config/index.js';
import { setupCommand } from './setup.js';
import { listenOnce } from '../modules/voice/index.js';
import { createAIAdapter } from '../adapters/ai.js';

export async function startCommand(): Promise<void> {
  if (!configExists()) {
    console.log('\n설정 파일이 없습니다. Setup Wizard를 시작합니다...\n');
    await setupCommand();
    return;
  }

  const config = loadConfig();
  console.log(`\n🤵 ${config.agent_nickname}, 준비 중입니다...\n`);

  const { runPreflight } = await import('../modules/preflight/index.js');
  await runPreflight(config);

  const ai = createAIAdapter(config);

  console.log(`🎙️  대기 중... (박수 두 번으로 브리핑을 시작하세요.)`);
  console.log('    종료하려면 Ctrl+C 또는 "종료"라고 말씀하세요.\n');

  while (true) {
    try {
      const event = await listenOnce(config);

      if (event.type === 'stop') {
        const { speak } = await import('../modules/tts/index.js');
        await speak(`수고하셨습니다. ${config.agent_nickname}를 종료합니다.`, config);
        console.log(`\n👋 ${config.agent_nickname}를 종료합니다.\n`);
        process.exit(0);
      }

      if (event.type === 'trigger') {
        // A: 트리거 감지 즉시 관심사 수집 시작
        // STT 인식 → 여기까지 오는 동안 이미 ~5-8초 경과.
        // BGM + 환영 인사(~30-40초) 동안 병렬로 수집 완료 가능.
        const { collectInterests } = await import('../modules/interests/index.js');
        const interestPromise = collectInterests(config, ai).catch((err) => {
          console.warn(`  ⚠️  관심사 수집 오류: ${err instanceof Error ? err.message : err}`);
          return [];
        });

        const { runOpeningBriefing } = await import('../modules/briefing/index.js');
        await runOpeningBriefing(config, ai, interestPromise);
        continue;
      }

      if (event.type === 'command') {
        const { runAgentLoop } = await import('../modules/agent/index.js');
        await runAgentLoop(event.text, config, ai);
        continue;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('유효한 음성')) continue;
      console.error(`\n⚠️  ${msg}\n`);
    }
  }
}
