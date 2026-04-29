// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Whisper 로컬 STT 실행
// ────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, extname } from 'node:path';
import { loadConfig } from '../config/manager.js';
import type { TranscriptionResult, TranscriptionSegment, SttOptions } from '../types/stt.js';

// ── 오류 클래스 ─────────────────────────────────────────────────

/** whisper CLI가 설치되어 있지 않을 때 발생하는 오류 */
export class WhisperNotInstalledError extends Error {
  constructor() {
    super(
      'whisper CLI를 찾을 수 없습니다. "pip install openai-whisper" 또는 ' +
        '"brew install openai-whisper" 로 설치해 주세요.',
    );
    this.name = 'WhisperNotInstalledError';
  }
}

// ── 내부 타입 ───────────────────────────────────────────────────

interface WhisperJsonSegment {
  start: number;
  end: number;
  text: string;
  avg_logprob: number;
  no_speech_prob: number;
}

interface WhisperJsonOutput {
  text: string;
  language: string;
  segments: WhisperJsonSegment[];
}

// ── 헬퍼 ────────────────────────────────────────────────────────

/**
 * whisper CLI가 PATH에 존재하는지 확인합니다.
 * `whisper --help` 를 통해 실행 가능 여부를 빠르게 검증합니다.
 */
async function isWhisperInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('whisper', ['--help'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', () => resolve(true));
  });
}

/**
 * 현재 아키텍처와 config를 기반으로 사용할 Whisper 모델을 결정합니다.
 * 우선 순위: options.whisperModel > config.stt.whisper_model > 아키텍처 자동 감지
 */
async function resolveModel(options?: SttOptions): Promise<string> {
  if (options?.whisperModel) return options.whisperModel;

  const config = await loadConfig();
  if (config.stt.whisper_model) return config.stt.whisper_model;

  // Apple Silicon(arm64)은 medium, Intel은 small
  return process.arch === 'arm64' ? 'medium' : 'small';
}

/**
 * avg_logprob 배열로부터 전체 발화 신뢰도(0~1)를 계산합니다.
 *
 * 변환 공식: confidence = clamp((avg_logprob + 1) / 1, 0, 1)
 * avg_logprob <= -0.5 또는 no_speech_prob > 0.6 이면 신뢰도를 0으로 강제합니다.
 */
function computeConfidence(segments: WhisperJsonSegment[]): number {
  if (segments.length === 0) return 0;

  const avgLogprob = segments.reduce((sum, s) => sum + s.avg_logprob, 0) / segments.length;
  const maxNoSpeech = Math.max(...segments.map((s) => s.no_speech_prob));

  // 저신뢰 조건
  if (avgLogprob <= -0.5 || maxNoSpeech > 0.6) {
    return Math.min(1, Math.max(0, (avgLogprob + 1) / 1));
  }

  return Math.min(1, Math.max(0, (avgLogprob + 1) / 1));
}

// ── 공개 API ────────────────────────────────────────────────────

/**
 * 지정한 오디오 파일을 Whisper CLI로 변환합니다.
 *
 * @param audioFilePath 변환할 오디오 파일의 절대 경로
 * @param options       모델·언어 재정의 옵션 (선택)
 * @returns             TranscriptionResult
 * @throws              WhisperNotInstalledError — whisper CLI 없을 때
 * @throws              Error — 변환 실패 시
 */
export async function transcribe(
  audioFilePath: string,
  options?: SttOptions,
): Promise<TranscriptionResult> {
  if (!(await isWhisperInstalled())) {
    throw new WhisperNotInstalledError();
  }

  const model = await resolveModel(options);

  // Whisper JSON 출력을 저장할 임시 디렉토리
  const outDir = tmpdir();

  // whisper는 입력 파일명 기반으로 <name>.json 을 생성함
  const audioBasename = basename(audioFilePath, extname(audioFilePath));
  const jsonOutputPath = join(outDir, `${audioBasename}.json`);

  const args: string[] = [
    audioFilePath,
    '--model', model,
    '--output_format', 'json',
    '--output_dir', outDir,
  ];

  if (options?.language) {
    args.push('--language', options.language);
  }

  await runWhisperProcess(args);

  // JSON 결과 파싱
  const raw = await readFile(jsonOutputPath, 'utf-8');
  const parsed: WhisperJsonOutput = JSON.parse(raw) as WhisperJsonOutput;

  // 임시 JSON 파일 즉시 삭제
  if (existsSync(jsonOutputPath)) {
    await unlink(jsonOutputPath);
  }

  const segments: TranscriptionSegment[] = parsed.segments.map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
    avg_logprob: s.avg_logprob,
    no_speech_prob: s.no_speech_prob,
  }));

  const confidence = computeConfidence(parsed.segments);

  return {
    text: parsed.text.trim(),
    confidence,
    segments,
    language: parsed.language,
  };
}

// ── 내부 프로세스 실행 ────────────────────────────────────────

function runWhisperProcess(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('whisper', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const stderrChunks: Buffer[] = [];
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new WhisperNotInstalledError());
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');
        reject(new Error(`whisper 프로세스가 코드 ${code}로 종료되었습니다.\n${stderr}`));
      }
    });
  });
}
