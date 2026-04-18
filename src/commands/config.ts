import { loadConfig, getConfigPath, configExists } from '../modules/config/index.js';
import type { ValetConfig } from '../types/config.js';

export function configCommand(): void {
  if (!configExists()) {
    console.error(`\n설정 파일이 없습니다. 먼저 'valet-pilot setup'을 실행하세요.\n`);
    process.exit(1);
  }

  const config = loadConfig();
  const masked = maskSensitive(config);

  console.log(`\n📋 현재 설정 (${getConfigPath()})\n`);
  console.log(JSON.stringify(masked, null, 2));
  console.log();
}

function maskSensitive(config: ValetConfig): Record<string, unknown> {
  const mask = (v: string) => (v ? `${v.slice(0, 4)}${'*'.repeat(Math.max(0, v.length - 4))}` : '');

  return {
    ...config,
    ai_api_key: mask(config.ai_api_key),
    work_tool: {
      ...config.work_tool,
      api_key: config.work_tool.api_key ? mask(config.work_tool.api_key) : undefined,
    },
    interests: config.interests.map((i) => ({
      ...i,
      auth: Object.fromEntries(
        Object.entries(i.auth).map(([k, v]) =>
          k.includes('key') || k.includes('token') ? [k, mask(v)] : [k, v]
        )
      ),
    })),
  };
}
