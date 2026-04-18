#!/usr/bin/env node
import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';
import { startCommand } from './commands/start.js';
import { configCommand } from './commands/config.js';
import { testVoiceCommand } from './commands/test-voice.js';

const program = new Command();

program
  .name('valet-pilot')
  .description('AI 기반 음성 제어 업무 자동화 에이전트')
  .version('0.1.0');

program
  .command('setup')
  .description('초기 설정 마법사 실행 (닉네임, AI 모델, 언어, 업무 툴, 관심사 설정)')
  .action(async () => {
    await setupCommand();
  });

program
  .command('start')
  .description('에이전트 시작 (음성 대기 상태 진입)')
  .action(async () => {
    await startCommand();
  });

program
  .command('config')
  .description('현재 설정 조회 (API 키는 마스킹 처리)')
  .action(() => {
    configCommand();
  });

program
  .command('test-voice')
  .description('마이크 녹음 및 STT 변환 테스트 (5초 고정 녹음)')
  .action(async () => {
    await testVoiceCommand();
  });

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(`\n오류: ${err.message}\n`);
  process.exit(1);
});
