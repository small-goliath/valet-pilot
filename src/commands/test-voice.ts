import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig, configExists } from '../modules/config/index.js';
import { transcribe } from '../modules/voice/transcriber.js';

/**
 * 음성 캡처 디버그 명령
 * - 5초간 녹음 후 파일 크기 및 STT 결과를 출력
 */
export async function testVoiceCommand(): Promise<void> {
  console.log('\n🎙️  음성 테스트를 시작합니다.');
  console.log('   5초간 말씀해주세요...\n');

  const tmpFile = path.join(os.tmpdir(), `valet-test-${Date.now()}.wav`);

  // 5초 고정 녹음 (silence 감지 없이)
  await new Promise<void>((resolve, reject) => {
    const sox = spawn('sox', [
      '-t', 'coreaudio', 'default',
      '-r', '16000',
      '-c', '1',
      '-b', '16',
      tmpFile,
      'trim', '0', '5',
    ]);

    const lines: string[] = [];
    sox.stderr?.on('data', (d: Buffer) => {
      const line = d.toString().trim();
      if (line) {
        lines.push(line);
        // 진행 상황 출력 (In: 줄만)
        if (line.includes('In:')) {
          process.stdout.write(`\r   녹음 중: ${line.split(']')[0].split('[')[0].trim()}`);
        }
      }
    });

    sox.on('close', (code) => {
      console.log('\n');
      if (code === 0) resolve();
      else reject(new Error(`SoX 종료 코드: ${code}\n${lines.slice(-3).join('\n')}`));
    });

    sox.on('error', (err) => reject(new Error(`SoX 실행 오류: ${err.message}`)));
  });

  // 파일 크기 확인
  if (!fs.existsSync(tmpFile)) {
    console.error('❌ 녹음 파일이 생성되지 않았습니다. 마이크 권한을 확인해주세요.\n');
    return;
  }

  const size = fs.statSync(tmpFile).size;
  console.log(`✅ 녹음 파일 생성됨: ${tmpFile}`);
  console.log(`   크기: ${(size / 1024).toFixed(1)} KB`);

  if (size < 1000) {
    console.error('\n❌ 파일 크기가 너무 작습니다. 마이크가 오디오를 캡처하지 못하고 있습니다.\n');
    fs.unlinkSync(tmpFile);
    return;
  }

  // STT 변환
  if (!configExists()) {
    console.log('\n⚠️  설정 파일이 없어 STT 변환을 건너뜁니다.');
    console.log(`   녹음 파일: ${tmpFile}\n`);
    return;
  }

  const config = loadConfig();
  console.log(`\n🔄 STT 변환 중 (모드: ${config.ai_model === 'openai' && config.stt_mode === 'online' ? 'OpenAI Whisper API' : 'whisper.cpp 로컬'})...`);

  try {
    const text = await transcribe(tmpFile, config);
    console.log(`\n📝 인식된 텍스트: "${text}"\n`);
  } catch (err) {
    console.error(`\n❌ STT 오류: ${err instanceof Error ? err.message : err}\n`);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}
