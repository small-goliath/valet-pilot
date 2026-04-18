import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import type { ValetConfig } from '../../types/config.js';

const execFileAsync = promisify(execFile);

const LANGUAGE_CODE: Record<string, string> = {
  korean: 'ko',
  japanese: 'ja',
  english: 'en',
};

// whisper-cpp 모델 저장 위치
const MODEL_DIR = path.join(os.homedir(), '.valet-pilot', 'models');
const MODEL_PATH = path.join(MODEL_DIR, 'ggml-base.bin');

// Homebrew whisper-cpp 모델 기본 위치 (brew install whisper-cpp 시)
const BREW_MODEL_PATH = '/opt/homebrew/share/whisper-cpp/ggml-base.bin';

/**
 * OpenAI Whisper API로 음성 파일을 텍스트로 변환
 */
export async function transcribeWithOpenAI(
  filePath: string,
  config: ValetConfig
): Promise<string> {
  const client = new OpenAI({ apiKey: config.ai_api_key });

  const transcription = await client.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-1',
    language: LANGUAGE_CODE[config.language] ?? 'ko',
  });

  return transcription.text.trim();
}

/**
 * whisper-cpp 바이너리로 음성 파일을 텍스트로 변환
 * brew install whisper-cpp 로 설치된 바이너리 사용
 */
export async function transcribeWithWhisperBinary(
  filePath: string,
  config: ValetConfig
): Promise<string> {
  // 바이너리 경로 확인 (brew 설치 위치)
  const binaryPath = await findWhisperBinary();
  if (!binaryPath) {
    throw new Error(
      'whisper-cpp 바이너리를 찾을 수 없습니다.\n' +
      '다음 명령으로 설치해주세요: brew install whisper-cpp'
    );
  }

  // 모델 파일 경로 결정
  const modelPath = resolveModelPath();
  if (!modelPath) {
    throw new Error(
      'whisper-cpp 모델 파일을 찾을 수 없습니다.\n' +
      `다음 위치에 모델을 다운로드해주세요:\n` +
      `  brew install whisper-cpp 후 자동 설치, 또는\n` +
      `  mkdir -p ${MODEL_DIR} && curl -L -o ${MODEL_PATH} ` +
      `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin`
    );
  }

  const langCode = LANGUAGE_CODE[config.language] ?? 'ko';

  // 출력 텍스트 파일 경로 (whisper-cpp는 파일로 결과 출력)
  const outBase = filePath.replace(/\.wav$/, '');

  const { stdout, stderr } = await execFileAsync(
    binaryPath,
    [
      '--model', modelPath,
      '--language', langCode,
      '--output-txt',
      '--output-file', outBase,
      '--no-prints',
      filePath,
    ],
    { timeout: 60000 }
  ).catch((err) => {
    // whisper-cpp는 stderr에 로그를 출력하고 exit 0으로 끝나기도 함
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  });

  // 결과 파일 읽기 (whisper-cpp는 .txt 파일로 저장)
  const txtFile = `${outBase}.txt`;
  if (fs.existsSync(txtFile)) {
    const text = fs.readFileSync(txtFile, 'utf-8').trim();
    fs.unlinkSync(txtFile);
    return cleanWhisperOutput(text);
  }

  // 파일이 없으면 stdout에서 직접 파싱
  if (stdout.trim()) {
    return cleanWhisperOutput(stdout);
  }

  throw new Error(`whisper-cpp 출력 없음.\nstderr: ${stderr.slice(0, 200)}`);
}

/**
 * [00:00.000 --> 00:02.000] 텍스트 형태의 타임스탬프 제거
 */
function cleanWhisperOutput(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\[[\d:.]+\s*-->\s*[\d:.]+\]\s*/, '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function findWhisperBinary(): Promise<string | null> {
  // 일반적인 brew 설치 위치들
  const candidates = [
    '/opt/homebrew/bin/whisper-cli',   // whisper-cpp >= 1.7.x
    '/opt/homebrew/bin/whisper',
    '/usr/local/bin/whisper-cli',
    '/usr/local/bin/whisper',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  // which 명령으로 추가 탐색
  try {
    const { stdout } = await execFileAsync('which', ['whisper-cli']);
    const p = stdout.trim();
    if (p && fs.existsSync(p)) return p;
  } catch {}

  try {
    const { stdout } = await execFileAsync('which', ['whisper']);
    const p = stdout.trim();
    if (p && fs.existsSync(p)) return p;
  } catch {}

  return null;
}

function resolveModelPath(): string | null {
  if (fs.existsSync(MODEL_PATH)) return MODEL_PATH;
  if (fs.existsSync(BREW_MODEL_PATH)) return BREW_MODEL_PATH;

  // Intel Mac brew 위치
  const intelPath = '/usr/local/share/whisper-cpp/ggml-base.bin';
  if (fs.existsSync(intelPath)) return intelPath;

  return null;
}

/**
 * 설정에 따라 적합한 STT 엔진으로 변환
 */
export async function transcribe(filePath: string, config: ValetConfig): Promise<string> {
  if (config.ai_model === 'openai' && config.stt_mode === 'online') {
    return transcribeWithOpenAI(filePath, config);
  }
  return transcribeWithWhisperBinary(filePath, config);
}
