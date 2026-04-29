// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Google Cloud STT fallback
// ────────────────────────────────────────────────────────────────

import { readFile } from 'node:fs/promises';
import SpeechClient from '@google-cloud/speech';
import type { TranscriptionResult, SttOptions } from '../types/stt.js';

// ── 언어 코드 매핑 ──────────────────────────────────────────────

const LANGUAGE_CODE_MAP: Record<string, string> = {
  korean: 'ko-KR',
  english: 'en-US',
  japanese: 'ja-JP',
};

/**
 * 자연어 언어명을 BCP-47 언어 코드로 변환합니다.
 * 이미 BCP-47 형식인 경우(예: "ko-KR") 그대로 반환합니다.
 */
function toBcp47(language?: string): string {
  if (!language) return 'ko-KR'; // 기본값: 한국어
  return LANGUAGE_CODE_MAP[language.toLowerCase()] ?? language;
}

// ── 공개 API ────────────────────────────────────────────────────

/**
 * Google Cloud Speech-to-Text API로 오디오 파일을 변환합니다.
 *
 * 환경 변수 GOOGLE_APPLICATION_CREDENTIALS 에 서비스 계정 JSON 경로가
 * 설정되어 있어야 합니다.
 *
 * @param audioFilePath 변환할 오디오 파일의 절대 경로 (LINEAR16 WAV 권장)
 * @param options       언어 재정의 옵션 (선택)
 * @returns             TranscriptionResult
 * @throws              Error — API 호출 실패 또는 결과 없음
 */
export async function transcribe(
  audioFilePath: string,
  options?: SttOptions,
): Promise<TranscriptionResult> {
  const client = new SpeechClient.SpeechClient();

  const audioBytes = await readFile(audioFilePath);
  const languageCode = toBcp47(options?.language);

  const [response] = await client.recognize({
    audio: { content: audioBytes.toString('base64') },
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode,
      enableWordTimeOffsets: false,
      enableAutomaticPunctuation: true,
    },
  });

  const results = response.results ?? [];

  if (results.length === 0) {
    throw new Error('Google STT: 인식 결과가 없습니다.');
  }

  // 모든 대안 중 가장 신뢰도 높은 첫 번째 대안을 사용
  const fullText = results
    .map((r) => r.alternatives?.[0]?.transcript ?? '')
    .join(' ')
    .trim();

  // 첫 번째 결과의 신뢰도를 대표값으로 사용 (없으면 1.0)
  const confidence = results[0]?.alternatives?.[0]?.confidence ?? 1.0;

  // Google STT는 세그먼트 개념이 없으므로 단일 요소로 구성
  const segments = results.map((r) => {
    const alt = r.alternatives?.[0];
    return {
      start: 0,
      end: 0,
      text: alt?.transcript?.trim() ?? '',
      avg_logprob: 0,
      no_speech_prob: 0,
    };
  });

  // ISO 639-1 코드 추출 (예: "ko-KR" → "ko")
  const langCode = languageCode.split('-')[0];

  return {
    text: fullText,
    confidence,
    segments,
    language: langCode,
  };
}
