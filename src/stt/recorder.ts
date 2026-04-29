// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 마이크 입력 캡처 (node-record-lpcm16 기반)
// ────────────────────────────────────────────────────────────────
//
//  사전 요구 사항:
//    brew install sox
//
//  VAD(Voice Activity Detection):
//    1.5초 이상 침묵이 감지되면 녹음을 자동으로 멈춥니다.
//    thresholdStart / thresholdEnd 로 침묵 임계값을 조정할 수 있습니다.
// ────────────────────────────────────────────────────────────────

import recorder from 'node-record-lpcm16';
import { createWriteStream, existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Writable } from 'node:stream';

// ── 내부 상태 ───────────────────────────────────────────────────

interface RecorderState {
  recording: ReturnType<typeof recorder.record> | null;
  fileStream: Writable | null;
  tmpPath: string | null;
  /** VAD 자동 정지 타이머 */
  silenceTimer: ReturnType<typeof setTimeout> | null;
  /** 현재 녹음 완료를 기다리는 Promise resolver */
  resolveStop: ((path: string) => void) | null;
  rejectStop: ((err: Error) => void) | null;
}

const state: RecorderState = {
  recording: null,
  fileStream: null,
  tmpPath: null,
  silenceTimer: null,
  resolveStop: null,
  rejectStop: null,
};

// ── 상수 ────────────────────────────────────────────────────────

const SAMPLE_RATE = 16000; // Hz — Whisper 권장값
const CHANNELS = 1; // mono
const VAD_SILENCE_MS = 1500; // 1.5초 침묵 시 자동 정지

// ── 공개 API ────────────────────────────────────────────────────

/**
 * 마이크 녹음을 시작합니다.
 *
 * 임시 WAV 파일에 오디오 스트림을 기록하며,
 * 1.5초 침묵이 감지되면 자동으로 녹음을 종료합니다.
 *
 * @throws Error — 이미 녹음 중일 때
 */
export function startRecording(): void {
  if (state.recording !== null) {
    throw new Error('이미 녹음 중입니다. stopRecording()을 먼저 호출하세요.');
  }

  const tmpPath = join(tmpdir(), `valet-stt-${randomUUID()}.wav`);
  const fileStream = createWriteStream(tmpPath);

  const recording = recorder.record({
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    audioType: 'wav',
    recorder: 'sox',
    // VAD 옵션: SoX silence 필터 사용
    // silence 1 0.1 1% 1 1.5 1%  → 0.1초 이상 1% 이상 소음 후 1.5초 침묵 시 종료
    silence: '1.5',
  });

  state.recording = recording;
  state.fileStream = fileStream;
  state.tmpPath = tmpPath;

  const audioStream = recording.stream();

  // 데이터 수신 시 VAD 타이머를 리셋합니다
  audioStream.on('data', () => {
    resetSilenceTimer();
  });

  audioStream.on('error', (err: Error) => {
    cleanupSilenceTimer();
    state.rejectStop?.(err);
    resetState();
  });

  // 파이프: 오디오 스트림 → 임시 파일
  audioStream.pipe(fileStream);

  // 첫 VAD 타이머 시작
  resetSilenceTimer();
}

/**
 * 녹음을 수동으로 종료하고 WAV 파일 경로를 반환합니다.
 *
 * VAD에 의해 이미 자동 종료된 경우에도 안전하게 호출할 수 있습니다.
 *
 * @returns 녹음된 WAV 파일의 절대 경로
 * @throws  Error — 녹음이 시작되지 않은 상태에서 호출 시
 */
export function stopRecording(): Promise<string> {
  if (state.recording === null || state.tmpPath === null) {
    return Promise.reject(new Error('녹음이 시작되지 않았습니다. startRecording()을 먼저 호출하세요.'));
  }

  return new Promise<string>((resolve, reject) => {
    state.resolveStop = resolve;
    state.rejectStop = reject;

    flushAndStop();
  });
}

/**
 * 임시 녹음 파일을 삭제합니다.
 * 보안 원칙에 따라 오디오 처리 완료 직후 호출해야 합니다.
 */
export async function deleteRecording(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

// ── 내부 헬퍼 ───────────────────────────────────────────────────

function resetSilenceTimer(): void {
  cleanupSilenceTimer();
  state.silenceTimer = setTimeout(() => {
    // VAD: 침묵 감지 → 자동 정지
    flushAndStop();
  }, VAD_SILENCE_MS);
}

function cleanupSilenceTimer(): void {
  if (state.silenceTimer !== null) {
    clearTimeout(state.silenceTimer);
    state.silenceTimer = null;
  }
}

function flushAndStop(): void {
  cleanupSilenceTimer();

  const { recording, fileStream, tmpPath, resolveStop } = state;

  if (recording === null || tmpPath === null) return;

  try {
    recording.stop();
  } catch {
    // 이미 종료된 경우 무시
  }

  if (fileStream !== null) {
    fileStream.end(() => {
      resolveStop?.(tmpPath);
      resetState();
    });
  } else {
    resolveStop?.(tmpPath);
    resetState();
  }
}

function resetState(): void {
  state.recording = null;
  state.fileStream = null;
  state.tmpPath = null;
  state.silenceTimer = null;
  state.resolveStop = null;
  state.rejectStop = null;
}
