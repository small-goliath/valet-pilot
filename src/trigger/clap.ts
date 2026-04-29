// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 박수 감지 (ClapDetector)
// ────────────────────────────────────────────────────────────────
//
//  알고리즘:
//    1. node-record-lpcm16 으로 16kHz / 16-bit PCM 스트림 수신
//    2. 512 샘플 프레임 단위로 RMS 볼륨(dB) 계산
//    3. threshold_db 초과 시 주파수 에너지 비율 검사 (2kHz~4kHz 대역)
//       → 전체 에너지 대비 해당 대역 에너지 ≥ CLAP_FREQ_RATIO 이면 박수로 판정
//    4. interval_ms 내에 두 번 감지되면 'clap' 이벤트 emit
//    5. 연속 잡음 억제: 첫 번째 감지 이후 MIN_QUIET_MS 동안 소음이 없어야 두 번째 감지 허용
// ────────────────────────────────────────────────────────────────

import { EventEmitter } from 'node:events';
import recorder from 'node-record-lpcm16';
import type { ValetConfig } from '../types/config.js';

// ── 상수 ────────────────────────────────────────────────────────

const SAMPLE_RATE = 16_000;           // Hz
const FRAME_SAMPLES = 512;            // 32ms 프레임
const BYTES_PER_SAMPLE = 2;           // 16-bit PCM
const FRAME_BYTES = FRAME_SAMPLES * BYTES_PER_SAMPLE;

/** 박수 판정 주파수 대역 비율 임계값 (2kHz~4kHz 에너지 / 전체 에너지) */
const CLAP_FREQ_RATIO = 0.25;

/** 첫 번째 감지 이후 다음 감지를 허용하기 전 최소 조용한 시간 (ms) */
const MIN_QUIET_MS = 80;

// ── 내부 상태 ────────────────────────────────────────────────────

interface ClapState {
  firstClapAt: number | null;
  lastLoudAt: number | null;
  frameBuffer: Buffer;
  frameOffset: number;
}

// ── 유틸리티 ─────────────────────────────────────────────────────

/**
 * 16-bit LE PCM 버퍼에서 RMS 에너지를 dBFS로 반환합니다.
 * 무음이면 -Infinity를 반환합니다.
 */
function rmsDb(buf: Buffer): number {
  const samples = buf.length / BYTES_PER_SAMPLE;
  let sum = 0;
  for (let i = 0; i < buf.length; i += BYTES_PER_SAMPLE) {
    const s = buf.readInt16LE(i) / 32768;
    sum += s * s;
  }
  const rms = Math.sqrt(sum / samples);
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

/**
 * 간단한 에너지 기반 주파수 대역 비율 검사.
 *
 * DFT 계수를 직접 계산하여 2kHz~4kHz 대역 에너지 비율을 반환합니다.
 * 고속 FFT 라이브러리 없이도 동작하지만, 512 샘플 이하의 짧은 프레임에서만 사용됩니다.
 */
function clapFreqRatio(buf: Buffer): number {
  const n = buf.length / BYTES_PER_SAMPLE;
  const samples: number[] = [];
  for (let i = 0; i < buf.length; i += BYTES_PER_SAMPLE) {
    samples.push(buf.readInt16LE(i));
  }

  // 관심 주파수 대역 인덱스 범위 계산
  // freq = k * SAMPLE_RATE / N  →  k = freq * N / SAMPLE_RATE
  const kLow = Math.floor(2000 * n / SAMPLE_RATE);
  const kHigh = Math.ceil(4000 * n / SAMPLE_RATE);

  let totalEnergy = 0;
  let bandEnergy = 0;

  // 실수 DFT (cos 성분만 사용 — 에너지 비율 추정 목적)
  for (let k = 1; k <= n / 2; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * k * i) / n;
      re += samples[i] * Math.cos(angle);
      im -= samples[i] * Math.sin(angle);
    }
    const energy = re * re + im * im;
    totalEnergy += energy;
    if (k >= kLow && k <= kHigh) {
      bandEnergy += energy;
    }
  }

  return totalEnergy > 0 ? bandEnergy / totalEnergy : 0;
}

// ── ClapDetector ─────────────────────────────────────────────────

export class ClapDetector extends EventEmitter {
  private recording: ReturnType<typeof recorder.record> | null = null;
  private state: ClapState = {
    firstClapAt: null,
    lastLoudAt: null,
    frameBuffer: Buffer.alloc(FRAME_BYTES),
    frameOffset: 0,
  };

  constructor(private readonly config: ValetConfig) {
    super();
  }

  /** 마이크 스트림 리스닝을 시작합니다. */
  start(): void {
    if (this.recording !== null) return;

    this.recording = recorder.record({
      sampleRate: SAMPLE_RATE,
      channels: 1,
      audioType: 'raw',
      recorder: 'sox',
    });

    this.state = {
      firstClapAt: null,
      lastLoudAt: null,
      frameBuffer: Buffer.alloc(FRAME_BYTES),
      frameOffset: 0,
    };

    const stream = this.recording.stream();

    stream.on('data', (chunk: Buffer) => {
      this.processChunk(chunk);
    });

    stream.on('error', () => {
      // 스트림 오류 시 조용히 무시 (데몬 계속 실행)
    });
  }

  /** 리스닝을 중지합니다. */
  stop(): void {
    if (this.recording === null) return;
    try {
      this.recording.stop();
    } catch {
      // 이미 종료된 경우 무시
    }
    this.recording = null;
  }

  // ── 내부 처리 ──────────────────────────────────────────────────

  private processChunk(chunk: Buffer): void {
    let chunkOffset = 0;

    while (chunkOffset < chunk.length) {
      const remaining = FRAME_BYTES - this.state.frameOffset;
      const toCopy = Math.min(remaining, chunk.length - chunkOffset);

      chunk.copy(this.state.frameBuffer, this.state.frameOffset, chunkOffset, chunkOffset + toCopy);
      this.state.frameOffset += toCopy;
      chunkOffset += toCopy;

      if (this.state.frameOffset >= FRAME_BYTES) {
        this.processFrame(Buffer.from(this.state.frameBuffer));
        this.state.frameOffset = 0;
      }
    }
  }

  private processFrame(frame: Buffer): void {
    const { threshold_db, interval_ms } = this.config.trigger.clap;
    const now = Date.now();
    const db = rmsDb(frame);

    if (db >= threshold_db) {
      // 주파수 필터: 박수 특성(2kHz~4kHz) 에너지 비율 확인
      const ratio = clapFreqRatio(frame);
      if (ratio < CLAP_FREQ_RATIO) {
        this.state.lastLoudAt = now;
        return; // 박수 특성 미충족 → 무시
      }

      this.state.lastLoudAt = now;

      if (this.state.firstClapAt === null) {
        // 첫 번째 박수
        this.state.firstClapAt = now;
      } else {
        // 두 번째 박수 판정
        const elapsed = now - this.state.firstClapAt;
        const quietSince = this.state.lastLoudAt !== null
          ? now - this.state.lastLoudAt
          : Infinity;

        if (elapsed <= interval_ms && quietSince >= MIN_QUIET_MS) {
          // 박수 2번 감지 성공
          this.state.firstClapAt = null;
          this.state.lastLoudAt = null;
          this.emit('clap');
        } else if (elapsed > interval_ms) {
          // 간격 초과 → 현재를 새로운 첫 번째로 갱신
          this.state.firstClapAt = now;
        }
      }
    } else {
      // 조용한 프레임: 첫 번째 감지 후 interval_ms 초과 시 리셋
      if (
        this.state.firstClapAt !== null &&
        now - this.state.firstClapAt > interval_ms
      ) {
        this.state.firstClapAt = null;
      }
    }
  }
}
