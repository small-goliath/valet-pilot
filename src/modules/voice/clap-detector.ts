import fs from 'fs';

const SAMPLE_RATE = 16000;
const WAV_HEADER_BYTES = 44;
const WINDOW_MS = 20;
const WINDOW_SAMPLES = Math.floor((SAMPLE_RATE * WINDOW_MS) / 1000); // 320 samples
const CLAP_RMS_THRESHOLD = 2500;     // 16-bit 범위(0~32767) 기준
const MAX_CLAP_DURATION_WINDOWS = 15; // 300ms 이하 버스트만 박수로 인정
const MIN_CLAP_GAP_MS = 150;
const MAX_CLAP_GAP_MS = 2000;

function windowRMS(samples: Int16Array, offset: number, length: number): number {
  const end = Math.min(offset + length, samples.length);
  const actual = end - offset;
  let sum = 0;
  for (let i = offset; i < end; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / actual);
}

function readPCM(filePath: string): Int16Array {
  const buf = fs.readFileSync(filePath);
  const numSamples = Math.floor((buf.length - WAV_HEADER_BYTES) / 2);
  const samples = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = buf.readInt16LE(WAV_HEADER_BYTES + i * 2);
  }
  return samples;
}

/**
 * WAV 파일에서 박수 두 번 패턴을 감지합니다.
 * - 짧은 고진폭 버스트(≤300ms) 두 개가 150ms~2000ms 간격으로 존재하면 true.
 */
export function detectClapsInFile(filePath: string): boolean {
  const samples = readPCM(filePath);
  const totalWindows = Math.floor(samples.length / WINDOW_SAMPLES);

  const claps: number[] = []; // 각 박수의 시작 시각(ms)
  let inClap = false;
  let clapStartWindow = 0;

  for (let w = 0; w < totalWindows; w++) {
    const rms = windowRMS(samples, w * WINDOW_SAMPLES, WINDOW_SAMPLES);

    if (rms > CLAP_RMS_THRESHOLD) {
      if (!inClap) {
        inClap = true;
        clapStartWindow = w;
      }
    } else {
      if (inClap) {
        const durationWindows = w - clapStartWindow;
        if (durationWindows <= MAX_CLAP_DURATION_WINDOWS) {
          claps.push(clapStartWindow * WINDOW_MS);
        }
        inClap = false;
      }
    }
  }

  if (claps.length < 2) return false;

  for (let i = 0; i < claps.length - 1; i++) {
    const gap = claps[i + 1] - claps[i];
    if (gap >= MIN_CLAP_GAP_MS && gap <= MAX_CLAP_GAP_MS) return true;
  }

  return false;
}
