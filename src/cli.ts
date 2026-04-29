#!/usr/bin/env node

import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runStart } from './commands/start.js';
import { runStop } from './commands/stop.js';
import { runBriefing } from './commands/briefing.js';
import { runConfig } from './commands/config.js';
import { runStatus } from './commands/status.js';

const program = new Command();

program
  .name('valet-pilot')
  .description('AI 기반 출근 준비 도우미 CLI')
  .version('0.1.0');

// valet-pilot init
program
  .command('init')
  .description('Valet Pilot 초기 설정 및 디렉토리 구조 생성')
  .option('-f, --force', '확인 없이 강제 초기화')
  .action(async (options) => {
    await runInit(options);
  });

// valet-pilot start
program
  .command('start')
  .description('Valet Pilot 데몬 시작')
  .option('-c, --config <path>', '설정 파일 경로')
  .option('-d, --daemon', '백그라운드 데몬 모드로 시작')
  .option('--no-ui', 'UI 창 없이 CLI 전용 모드로 시작')
  .action(async (options) => {
    await runStart({ ...options, noUi: !options.ui });
  });

// valet-pilot stop
program
  .command('stop')
  .description('실행 중인 Valet Pilot 데몬 종료')
  .option('-f, --force', '강제 종료')
  .action(async (options) => {
    await runStop(options);
  });

// valet-pilot briefing
program
  .command('briefing')
  .description('출근 브리핑 수동 실행')
  .argument('[mode]', '브리핑 모드 (morning | manual)', 'manual')
  .option('--dry', '실제 재생 없이 스크립트만 출력')
  .option('--no-tts', 'TTS 음성 출력 비활성화')
  .option('--no-bgm', 'BGM 재생 비활성화')
  .action(async (mode, options) => {
    await runBriefing(mode, {
      dry: options.dry,
      noTts: !options.tts,
      noBgm: !options.bgm,
    });
  });

// valet-pilot config
const configCmd = program
  .command('config')
  .description('설정 파일 조회 및 편집')
  .option('--list', '현재 설정 전체 출력')
  .option('--get <key>', '특정 설정 값 조회')
  .option('--set <key=value>', '특정 설정 값 변경 (key=value 형식)')
  .action(async (options) => {
    await runConfig(options);
  });

// valet-pilot config set <key> <value>
configCmd
  .command('set <key> <value>')
  .description('특정 설정 값 변경')
  .action(async (key: string, value: string) => {
    await runConfig({ set: `${key}=${value}` });
  });

// valet-pilot config get <key>
configCmd
  .command('get <key>')
  .description('특정 설정 값 조회')
  .action(async (key: string) => {
    await runConfig({ get: key });
  });

// valet-pilot config list
configCmd
  .command('list')
  .description('현재 설정 전체 출력')
  .action(async () => {
    await runConfig({ list: true });
  });

// valet-pilot status
program
  .command('status')
  .description('Valet Pilot 현재 상태 확인')
  .option('--json', 'JSON 형식으로 출력')
  .action(async (options) => {
    await runStatus(options);
  });

program.parse(process.argv);
