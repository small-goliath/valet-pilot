// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 오디오 재생 (macOS 전용)
//  afplay: macOS 내장, 별도 설치 불필요
//  ffmpeg: fade-out 처리용 (선택적)
//  성능 목표: 텍스트 수신 후 500ms 이내 음성 출력 시작
// ────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

// ── 상태 ────────────────────────────────────────────────────────

/** 현재 재생 중인 프로세스 */
let currentProcess: ChildProcess | null = null;

// ── 내부 헬퍼 ────────────────────────────────────────────────────

function spawnAfplay(audioPath: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('afplay', [audioPath, ...args]);
    currentProcess = proc;

    proc.on('error', (err: NodeJS.ErrnoException) => {
      currentProcess = null;
      reject(new Error(`afplay 실행 오류: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (currentProcess === proc) {
        currentProcess = null;
      }
      // afplay 는 SIGTERM 으로 종료되면 code null 을 반환 — 정상 종료로 처리
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`afplay 종료 코드: ${code}`));
      }
    });
  });
}

// ── 공개 API ─────────────────────────────────────────────────────

/**
 * 오디오 파일을 afplay 로 재생합니다.
 * 이전에 재생 중인 오디오가 있으면 먼저 중지합니다.
 *
 * @param audioPath 재생할 mp3/aiff/wav 파일의 절대 경로
 */
export async function play(audioPath: string): Promise<void> {
  stop();
  await spawnAfplay(audioPath);
}

/**
 * 오디오 파일을 재생하다가 durationMs 시점에 fade-out 합니다.
 * ffmpeg 가 설치되어 있지 않으면 일반 play 로 fallback 합니다.
 *
 * @param audioPath  재생할 오디오 파일 경로
 * @param durationMs fade-out 시작 시각 (ms)
 */
export async function playWithFadeOut(audioPath: string, durationMs: number): Promise<void> {
  stop();

  const fadeDurationSec = 1.5;
  const startSec = durationMs / 1000;
  const endSec = startSec + fadeDurationSec;

  return new Promise((resolve, reject) => {
    // ffmpeg 로 fade-out 처리 후 afplay 로 재생
    const ffmpegArgs = [
      '-i', audioPath,
      '-af', `afade=t=out:st=${startSec}:d=${fadeDurationSec}`,
      '-t', String(endSec),
      '-f', 'mp3',
      'pipe:1',
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'ignore'] });
    const afplay = spawn('afplay', ['-']);
    currentProcess = afplay;

    ffmpeg.stdout.pipe(afplay.stdin);

    ffmpeg.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        // ffmpeg 없으면 단순 재생으로 fallback
        ffmpeg.kill();
        afplay.kill();
        currentProcess = null;
        play(audioPath).then(resolve).catch(reject);
      } else {
        reject(new Error(`ffmpeg 실행 오류: ${err.message}`));
      }
    });

    afplay.on('error', (err) => {
      currentProcess = null;
      reject(new Error(`afplay 실행 오류: ${err.message}`));
    });

    afplay.on('close', (code) => {
      if (currentProcess === afplay) {
        currentProcess = null;
      }
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`afplay 종료 코드: ${code}`));
      }
    });
  });
}

/**
 * 현재 재생 중인 오디오를 즉시 중지합니다.
 * 재생 중인 프로세스가 없으면 아무 동작도 하지 않습니다.
 */
export function stop(): void {
  if (currentProcess) {
    try {
      currentProcess.kill('SIGTERM');
    } catch {
      // 이미 종료된 경우 무시
    }
    currentProcess = null;
  }
}
