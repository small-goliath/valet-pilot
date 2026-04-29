// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Wake Word 감지 (WakeWordDetector)
// ────────────────────────────────────────────────────────────────
//
//  @picovoice/porcupine-node 를 사용합니다.
//  AccessKey 는 macOS Keychain 에서 읽습니다:
//    security find-generic-password -s "valet-pilot" -a "porcupine-access-key" -w
//
//  config.trigger.wake_word.words 의 각 항목은
//    • BuiltinKeyword 열거값 (예: "jarvis", "porcupine") — 내장 키워드
//    • .ppn 파일의 절대 경로                             — 커스텀 키워드
//  중 하나입니다.
// ────────────────────────────────────────────────────────────────

import { EventEmitter } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import recorder from 'node-record-lpcm16';
import { Porcupine, BuiltinKeyword, getBuiltinKeywordPath } from '@picovoice/porcupine-node';
import type { ValetConfig } from '../types/config.js';

const execFileAsync = promisify(execFile);

// ── 상수 ────────────────────────────────────────────────────────

const DEFAULT_SENSITIVITY = 0.5;

// ── Keychain 헬퍼 ────────────────────────────────────────────────

/**
 * macOS Keychain 에서 Porcupine AccessKey 를 읽습니다.
 * 환경 변수 PORCUPINE_ACCESS_KEY 가 설정되어 있으면 우선 사용합니다.
 */
async function getPorcupineAccessKey(): Promise<string> {
  if (process.env.PORCUPINE_ACCESS_KEY) {
    return process.env.PORCUPINE_ACCESS_KEY;
  }

  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-s', 'valet-pilot',
      '-a', 'porcupine-access-key',
      '-w',
    ]);
    return stdout.trim();
  } catch {
    throw new Error(
      'Porcupine AccessKey 를 찾을 수 없습니다.\n' +
      '  security add-generic-password -s "valet-pilot" -a "porcupine-access-key" -w "<KEY>"\n' +
      '또는 PORCUPINE_ACCESS_KEY 환경 변수를 설정해 주세요.',
    );
  }
}

// ── 키워드 경로 해석 ─────────────────────────────────────────────

/**
 * 단어 문자열을 내장 키워드 경로 또는 커스텀 .ppn 경로로 변환합니다.
 */
function resolveKeywordPath(word: string): string {
  // .ppn 확장자가 있으면 커스텀 파일로 간주
  if (word.endsWith('.ppn')) {
    return word;
  }

  // BuiltinKeyword 열거값과 대소문자 무시 매칭
  const normalized = word.toLowerCase().replace(/_/g, ' ');
  const builtinValues = Object.values(BuiltinKeyword) as string[];
  const match = builtinValues.find((v) => v === normalized);

  if (match) {
    return getBuiltinKeywordPath(match as BuiltinKeyword);
  }

  // 매칭 실패 시 파일 경로로 그대로 사용 (사용자 책임)
  return word;
}

// ── WakeWordDetector ─────────────────────────────────────────────

export class WakeWordDetector extends EventEmitter {
  private porcupine: Porcupine | null = null;
  private recording: ReturnType<typeof recorder.record> | null = null;
  private pcmBuffer: Buffer = Buffer.alloc(0);

  constructor(private readonly config: ValetConfig) {
    super();
  }

  /** Porcupine 리스닝을 시작합니다. */
  async start(): Promise<void> {
    if (this.recording !== null) return;

    const words = this.config.trigger.wake_word.words;
    if (words.length === 0) {
      throw new Error('wake_word.words 가 비어 있습니다. config.yaml 을 확인하세요.');
    }

    const accessKey = await getPorcupineAccessKey();
    const keywordPaths = words.map(resolveKeywordPath);
    const sensitivities = keywordPaths.map(() => DEFAULT_SENSITIVITY);

    this.porcupine = new Porcupine(accessKey, keywordPaths, sensitivities);

    this.recording = recorder.record({
      sampleRate: this.porcupine.sampleRate,
      channels: 1,
      audioType: 'raw',
      recorder: 'sox',
    });

    this.pcmBuffer = Buffer.alloc(0);

    const frameBytes = this.porcupine.frameLength * 2; // Int16 → 2 bytes
    const stream = this.recording.stream();

    stream.on('data', (chunk: Buffer) => {
      this.pcmBuffer = Buffer.concat([this.pcmBuffer, chunk]);

      while (this.pcmBuffer.length >= frameBytes && this.porcupine !== null) {
        const frame = this.pcmBuffer.subarray(0, frameBytes);
        this.pcmBuffer = this.pcmBuffer.subarray(frameBytes);

        // Int16Array 변환 (Little-Endian)
        const int16 = new Int16Array(frame.buffer, frame.byteOffset, this.porcupine.frameLength);
        const keywordIndex = this.porcupine.process(int16);

        if (keywordIndex >= 0) {
          const detectedWord = words[keywordIndex] ?? 'unknown';
          this.emit('wakeword', detectedWord);
        }
      }
    });

    stream.on('error', () => {
      // 스트림 오류 시 조용히 무시
    });
  }

  /** 리스닝을 중지하고 Porcupine 리소스를 해제합니다. */
  stop(): void {
    if (this.recording !== null) {
      try {
        this.recording.stop();
      } catch {
        // 이미 종료된 경우 무시
      }
      this.recording = null;
    }

    if (this.porcupine !== null) {
      this.porcupine.release();
      this.porcupine = null;
    }

    this.pcmBuffer = Buffer.alloc(0);
  }
}
