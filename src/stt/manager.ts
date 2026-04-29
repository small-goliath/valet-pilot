// ────────────────────────────────────────────────────────────────
//  Valet Pilot — STT 오케스트레이터
// ────────────────────────────────────────────────────────────────

import { loadConfig } from '../config/manager.js';
import { transcribe as whisperTranscribe, WhisperNotInstalledError } from './whisper.js';
import { transcribe as googleTranscribe } from './google.js';
import { startRecording, stopRecording, deleteRecording } from './recorder.js';
import type { TranscriptionResult, SttOptions } from '../types/stt.js';

// ── 신뢰도 임계값 ────────────────────────────────────────────────

/** 이 값 미만이면 lowConfidence 플래그를 세웁니다 */
const LOW_CONFIDENCE_THRESHOLD = 0.5;

// ── 결과 타입 ────────────────────────────────────────────────────

export interface SttResult {
  text: string;
  confidence: number;
  language: string;
  /** 신뢰도가 낮아 재확인이 필요한 경우 true */
  lowConfidence?: true;
}

// ── SttManager ───────────────────────────────────────────────────

export class SttManager {
  /**
   * 지정한 오디오 파일을 변환합니다.
   *
   * config.stt 에 따라 Whisper를 우선 시도하고,
   * 실패하거나 WhisperNotInstalledError가 발생하면
   * config.stt.fallback_to_cloud === true 일 때 Google STT로 재시도합니다.
   *
   * @param filePath 변환할 오디오 파일의 절대 경로
   * @param options  언어·모델 재정의 옵션 (선택)
   * @returns        SttResult (처리 완료 후 임시 파일은 삭제되지 않음 — 호출자 책임)
   */
  async transcribeFile(filePath: string, options?: SttOptions): Promise<SttResult> {
    const config = await loadConfig();
    let result: TranscriptionResult;

    try {
      result = await whisperTranscribe(filePath, options);
    } catch (err) {
      const isWhisperMissing = err instanceof WhisperNotInstalledError;
      const isOtherError = !isWhisperMissing;

      if ((isWhisperMissing || isOtherError) && config.stt.fallback_to_cloud) {
        // Google STT fallback
        result = await googleTranscribe(filePath, options);
      } else {
        throw err;
      }
    }

    return this.toSttResult(result);
  }

  /**
   * 마이크로 녹음한 뒤 변환합니다.
   *
   * 내부적으로 startRecording → stopRecording → transcribeFile 순서로
   * 실행되며, 처리가 완료되면 임시 오디오 파일을 즉시 삭제합니다.
   *
   * @param options 언어·모델 재정의 옵션 (선택)
   * @returns       SttResult
   */
  async transcribeMic(options?: SttOptions): Promise<SttResult> {
    startRecording();

    let audioPath: string;
    try {
      audioPath = await stopRecording();
    } catch (err) {
      throw new Error(`마이크 녹음 실패: ${(err as Error).message}`);
    }

    try {
      const result = await this.transcribeFile(audioPath, options);
      return result;
    } finally {
      // 보안 원칙: 처리 완료 후 임시 오디오 파일 즉시 삭제
      await deleteRecording(audioPath);
    }
  }

  // ── 내부 헬퍼 ──────────────────────────────────────────────────

  private toSttResult(result: TranscriptionResult): SttResult {
    const sttResult: SttResult = {
      text: result.text,
      confidence: result.confidence,
      language: result.language,
    };

    if (result.confidence < LOW_CONFIDENCE_THRESHOLD) {
      sttResult.lowConfidence = true;
    }

    return sttResult;
  }
}
