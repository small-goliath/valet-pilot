import chalk from 'chalk';
import { briefingRunner } from '../briefing/runner.js';

export interface BriefingOptions {
  dry?: boolean;
  noTts?: boolean;
  noBgm?: boolean;
}

export type BriefingMode = 'morning' | 'manual';

/**
 * `valet-pilot briefing` 커맨드 핸들러
 * 출근 브리핑 파이프라인을 수동으로 실행합니다.
 */
export async function runBriefing(
  mode: BriefingMode = 'manual',
  options: BriefingOptions = {},
): Promise<void> {
  if (briefingRunner.isRunning()) {
    console.log(chalk.yellow('브리핑이 이미 진행 중입니다.'));
    return;
  }

  console.log(chalk.bold(`\n브리핑을 시작합니다 (${mode} 모드)...\n`));

  if (options.dry) {
    console.log(chalk.dim('[dry 모드] 실제 오디오 재생 없이 스크립트만 출력합니다.\n'));
  }

  try {
    await briefingRunner.run({ dry: options.dry, noTts: options.noTts, noBgm: options.noBgm });
    console.log(chalk.green('\n브리핑이 완료되었습니다.'));
  } catch (err) {
    console.error(chalk.red('브리핑 중 오류가 발생했습니다:'), err);
    process.exit(1);
  }
}
