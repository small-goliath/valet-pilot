import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface RecordingResult {
  filePath: string;
  cleanup: () => void;
}

/**
 * 고정 시간(durationSec초) 녹음 후 파일 반환.
 * silence 감지 필터는 CoreAudio와 조합 시 불안정하므로 사용하지 않음.
 * 녹음 후 STT에서 빈 결과면 voice/index.ts 루프에서 재시도.
 */
export async function recordUntilSilence(durationSec = 8): Promise<RecordingResult> {
  const tmpFile = path.join(os.tmpdir(), `valet-${Date.now()}.wav`);

  return new Promise((resolve, reject) => {
    const sox: ChildProcess = spawn('sox', [
      '-t', 'coreaudio', 'default',
      '-r', '16000',
      '-c', '1',
      '-b', '16',
      tmpFile,
      'trim', '0', String(durationSec),
    ]);

    sox.on('close', (code) => {
      if (fs.existsSync(tmpFile) && fs.statSync(tmpFile).size > 5000) {
        resolve({
          filePath: tmpFile,
          cleanup: () => {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
          },
        });
      } else {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        reject(new Error('유효한 음성이 감지되지 않았습니다.'));
      }
    });

    sox.on('error', (err) => {
      reject(new Error(`SoX 오류: ${err.message}`));
    });
  });
}
