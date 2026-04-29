// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 오디오 재생 (macOS 전용)
//  afplay: macOS 내장, 별도 설치 불필요
//  ffmpeg + sox play: 볼륨 필터 및 stdin 파이프 재생
//  BGM 과 TTS 는 별도 프로세스로 동시 재생합니다.
// ────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

// ── 상태 ────────────────────────────────────────────────────────

/** BGM 재생 프로세스 (afplay 또는 sox play) */
let bgmProcess: ChildProcess | null = null;

/** BGM에 연결된 ffmpeg 보조 프로세스 (파이프 사용 시) */
let bgmFfmpeg: ChildProcess | null = null;

/** TTS/효과음 재생 프로세스 */
let ttsProcess: ChildProcess | null = null;

// ── 내부 헬퍼 ────────────────────────────────────────────────────

function killProcess(proc: ChildProcess | null): void {
  if (!proc) return;
  try {
    proc.kill('SIGTERM');
  } catch {
    // 이미 종료된 경우 무시
  }
}

function spawnAfplay(audioPath: string, args: string[] = []): { proc: ChildProcess; promise: Promise<void> } {
  let proc!: ChildProcess;
  const promise = new Promise<void>((resolve, reject) => {
    proc = spawn('afplay', [...args, audioPath]);

    proc.on('error', (err: NodeJS.ErrnoException) => {
      reject(new Error(`afplay 실행 오류: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`afplay 종료 코드: ${code}`));
      }
    });
  });
  return { proc, promise };
}

/**
 * ffmpeg → sox play 파이프를 구성하는 내부 헬퍼.
 * ffmpeg ENOENT 시 일반 playBgm fallback.
 * EPIPE 에러를 안전하게 처리합니다.
 */
function spawnFfmpegPipe(
  ffmpegArgs: string[],
  audioPath: string,
  resolve: () => void,
  reject: (err: Error) => void,
): void {
  const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'ignore'] });
  const soxPlay = spawn('play', ['-t', 'mp3', '-', '-q']);

  bgmProcess = soxPlay;
  bgmFfmpeg = ffmpeg;

  ffmpeg.stdout.pipe(soxPlay.stdin);

  // EPIPE 방지: soxPlay가 먼저 종료되면 ffmpeg stdout 쓰기 실패
  soxPlay.stdin.on('error', () => { /* EPIPE 무시 */ });
  ffmpeg.stdout.on('error', () => { /* EPIPE 무시 */ });

  ffmpeg.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') {
      ffmpeg.kill();
      soxPlay.kill();
      bgmProcess = null;
      bgmFfmpeg = null;
      playBgm(audioPath).then(resolve).catch(reject);
    } else {
      reject(new Error(`ffmpeg 실행 오류: ${err.message}`));
    }
  });

  soxPlay.on('error', (err) => {
    bgmProcess = null;
    bgmFfmpeg = null;
    reject(new Error(`sox play 실행 오류: ${err.message}`));
  });

  soxPlay.on('close', (code) => {
    // soxPlay 종료 시 ffmpeg도 정리
    killProcess(bgmFfmpeg);
    if (bgmProcess === soxPlay) bgmProcess = null;
    bgmFfmpeg = null;

    if (code === 0 || code === null) {
      resolve();
    } else {
      reject(new Error(`sox play 종료 코드: ${code}`));
    }
  });
}

// ── BGM API ──────────────────────────────────────────────────────

/**
 * BGM 파일을 재생합니다. TTS 재생과 독립적으로 동작합니다.
 * 이전 BGM이 있으면 먼저 중지합니다.
 */
export async function playBgm(audioPath: string): Promise<void> {
  stopBgm();
  const { proc, promise } = spawnAfplay(audioPath);
  bgmProcess = proc;
  await promise;
  if (bgmProcess === proc) bgmProcess = null;
}

/**
 * BGM을 즉시 중지합니다.
 */
export function stopBgm(): void {
  killProcess(bgmFfmpeg);
  bgmFfmpeg = null;
  killProcess(bgmProcess);
  bgmProcess = null;
}

/**
 * BGM을 fade-out 후 재생합니다.
 * ffmpeg 가 설치되어 있지 않으면 일반 playBgm 으로 fallback 합니다.
 *
 * @param audioPath  재생할 오디오 파일 경로
 * @param durationMs fade-out 시작 시각 (ms)
 */
export async function playBgmWithFadeOut(audioPath: string, durationMs: number): Promise<void> {
  stopBgm();

  const fadeDurationSec = 1.5;
  const startSec = durationMs / 1000;
  const endSec = startSec + fadeDurationSec;

  const ffmpegArgs = [
    '-i', audioPath,
    '-af', `afade=t=out:st=${startSec}:d=${fadeDurationSec}`,
    '-t', String(endSec),
    '-f', 'mp3',
    'pipe:1',
  ];

  return new Promise((resolve, reject) => {
    spawnFfmpegPipe(ffmpegArgs, audioPath, resolve, reject);
  });
}

/**
 * BGM을 재생하되, duckAtSec 시점부터 rampSec에 걸쳐 duckVolume으로 볼륨을 낮춥니다.
 * ffmpeg volume 필터의 eval=frame으로 프레임마다 수식을 재평가하여 끊김 없이 전환합니다.
 * ffmpeg가 설치되어 있지 않으면 일반 playBgm으로 fallback합니다.
 *
 * @param audioPath   재생할 오디오 파일 경로
 * @param duckAtSec   볼륨 덕킹 시작 시각 (초, BGM 재생 시작 기준)
 * @param duckVolume  덕킹 후 목표 볼륨 (0.0 ~ 1.0, 기본값 0.35)
 * @param rampSec     볼륨 전환에 걸리는 시간 (초, 기본값 1.5)
 */
export async function playBgmDucked(
  audioPath: string,
  duckAtSec: number,
  duckVolume = 0.35,
  rampSec = 1.5,
): Promise<void> {
  stopBgm();

  const rampEnd = (duckAtSec + rampSec).toFixed(4);
  const duck = duckAtSec.toFixed(4);
  const vol = duckVolume.toFixed(4);
  const diff = (1.0 - duckVolume).toFixed(4);
  const ramp = rampSec.toFixed(4);

  // t < duck → 1.0
  // duck ≤ t < rampEnd → 선형 감소 (1.0 → duckVolume)
  // t ≥ rampEnd → duckVolume 고정
  const volExpr =
    `if(lt(t,${duck}),1.0,` +
    `if(lt(t,${rampEnd}),1.0-${diff}*(t-${duck})/${ramp},` +
    `${vol}))`;

  const ffmpegArgs = [
    '-i', audioPath,
    '-af', `volume='${volExpr}':eval=frame`,
    '-f', 'mp3',
    'pipe:1',
  ];

  return new Promise((resolve, reject) => {
    spawnFfmpegPipe(ffmpegArgs, audioPath, resolve, reject);
  });
}

// ── TTS / 효과음 API ─────────────────────────────────────────────

/**
 * TTS 오디오 파일을 재생합니다. BGM 재생에는 영향을 주지 않습니다.
 * 이전 TTS가 재생 중이면 먼저 중지합니다.
 */
export async function play(audioPath: string): Promise<void> {
  stopTts();
  const { proc, promise } = spawnAfplay(audioPath);
  ttsProcess = proc;
  await promise;
  if (ttsProcess === proc) ttsProcess = null;
}

/**
 * 현재 재생 중인 TTS 오디오를 즉시 중지합니다.
 */
export function stopTts(): void {
  killProcess(ttsProcess);
  ttsProcess = null;
}

/**
 * BGM과 TTS를 모두 중지합니다.
 */
export function stop(): void {
  stopBgm();
  stopTts();
}
