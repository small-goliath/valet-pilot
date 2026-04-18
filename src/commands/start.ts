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

  // Preflight 검증
  const { runPreflight } = await import('../modules/preflight/index.js');
  await runPreflight(config);

  const ai = createAIAdapter(config);

  console.log(`🎙️  음성 대기 중... ("${config.agent_nickname}, 시작하자"로 브리핑을 시작하세요.)`);
  console.log('    종료하려면 Ctrl+C 또는 "종료"라고 말씀하세요.\n');

  // 메인 음성 루프
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
        const { runOpeningBriefing } = await import('../modules/briefing/index.js');
        await runOpeningBriefing(config);
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
