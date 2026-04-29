// ────────────────────────────────────────────────────────────────
//  Valet Pilot — ElevenLabs TTS 연동 (선택적 고품질 TTS)
//  ElevenLabs REST API 를 axios 로 호출합니다.
//  API 키는 macOS Keychain 에서 읽어옵니다.
// ────────────────────────────────────────────────────────────────

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import axios from 'axios';
import { getSecret } from '../config/keychain.js';
import type { TtsOptions, TtsResult, VoiceId } from '../types/tts.js';

// ── 상수 ────────────────────────────────────────────────────────

const BASE_URL = 'https://api.elevenlabs.io/v1';
const KEYCHAIN_SERVICE = 'valet-pilot';
const KEYCHAIN_ACCOUNT = 'elevenlabs-api-key';

/**
 * VoiceId → ElevenLabs Voice ID 매핑.
 * 실제 사용 시 ElevenLabs 콘솔에서 확인한 ID 로 교체하세요.
 */
const ELEVENLABS_VOICE_MAP: Record<VoiceId, string> = {
  'male-01': 'pNInz6obpgDQGcFmaJgB',   // Adam
  'male-02': 'VR6AewLTigWG4xSOukaG',   // Arnold
  'female-01': 'EXAVITQu4vr4xnSDxMaL', // Bella
  'female-02': '21m00Tcm4TlvDq8ikWAM', // Rachel
};

const DEFAULT_VOICE: VoiceId = 'female-01';

// ── 내부 헬퍼 ────────────────────────────────────────────────────

function makeTempPath(): string {
  const rand = randomBytes(8).toString('hex');
  return join(tmpdir(), `valet-elevenlabs-${rand}.mp3`);
}

async function getApiKey(): Promise<string> {
  const key = await getSecret(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  if (!key) {
    throw new Error(
      `ElevenLabs API 키가 Keychain에 없습니다 (account: ${KEYCHAIN_ACCOUNT}). ` +
      '`valet-pilot config set elevenlabs-api-key` 로 등록해주세요.',
    );
  }
  return key;
}

// ── 공개 API ─────────────────────────────────────────────────────

/**
 * ElevenLabs API 로 텍스트를 합성합니다.
 *
 * @param text       합성할 텍스트
 * @param outputPath 출력 mp3 파일 경로. 생략하면 임시 경로 자동 생성.
 * @param options    TTS 옵션
 */
export async function synthesize(
  text: string,
  outputPath?: string,
  options?: TtsOptions,
): Promise<TtsResult> {
  const apiKey = await getApiKey();
  const voiceId = (options?.voice ?? DEFAULT_VOICE) as VoiceId;
  const elevenVoiceId = ELEVENLABS_VOICE_MAP[voiceId] ?? ELEVENLABS_VOICE_MAP[DEFAULT_VOICE];
  const destPath = outputPath ?? makeTempPath();

  const response = await axios.post<ArrayBuffer>(
    `${BASE_URL}/text-to-speech/${elevenVoiceId}`,
    {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        speed: options?.speed ?? 1.0,
      },
    },
    {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
    },
  );

  await writeFile(destPath, Buffer.from(response.data));

  return {
    audioPath: destPath,
    cached: false,
  };
}
