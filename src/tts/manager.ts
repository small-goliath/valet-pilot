// ────────────────────────────────────────────────────────────────
//  Valet Pilot — TTS 오케스트레이터
//  캐시 확인 → Edge TTS → ElevenLabs fallback → 에러 시 console.log
// ────────────────────────────────────────────────────────────────

import { join } from 'node:path';
import { loadConfig } from '../config/manager.js';
import { ensureValetDirs, VALET_DIRS } from '../utils/dirs.js';
import { getCacheKey, getCachedAudio, setCachedAudio } from './cache.js';
import { synthesize as edgeSynthesize, EdgeTtsNotInstalledError } from './edge.js';
import { synthesize as elevenSynthesize } from './elevenlabs.js';
import { play } from './player.js';
import type { TtsOptions, TtsResult } from '../types/tts.js';
import type { VoiceId } from '../types/tts.js';

// ── TtsManager ──────────────────────────────────────────────────

export class TtsManager {
  private defaultVoice: VoiceId = 'female-01';
  private defaultLanguage: string = 'korean';
  private defaultDialect: string | undefined;

  /**
   * config.yaml 에서 voice, language, dialect 를 로드합니다.
   * 실패해도 기본값을 유지하므로 안전합니다.
   */
  async loadDefaults(): Promise<void> {
    try {
      const config = await loadConfig();
      const rawVoice = config.agent.voice as VoiceId;
      if (rawVoice) this.defaultVoice = rawVoice;
      if (config.agent.language) this.defaultLanguage = config.agent.language;
      if (config.agent.dialect) this.defaultDialect = config.agent.dialect;
    } catch {
      // config 읽기 실패 시 기본값 유지
    }
  }

  /**
   * 텍스트를 합성하고 재생합니다.
   * 우선순위: 캐시 → Edge TTS → ElevenLabs → 오류 시 console.log
   *
   * @param text    재생할 텍스트
   * @param options TTS 옵션 (생략 시 config 기본값 사용)
   */
  async speak(text: string, options?: TtsOptions): Promise<void> {
    try {
      const result = await this.synthesize(text, options);
      await play(result.audioPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[TTS 실패] ${text}`);
      console.error(`TTS 오류: ${message}`);
    }
  }

  /**
   * 텍스트를 백그라운드에서 사전 합성합니다 (브리핑 캐시 용).
   * 재생하지 않고 캐시에만 저장합니다.
   * 오류는 무시합니다.
   *
   * @param text    합성할 텍스트
   * @param options TTS 옵션
   */
  async presynthesize(text: string, options?: TtsOptions): Promise<void> {
    try {
      await this.synthesize(text, options);
    } catch {
      // 사전 합성 실패는 무시 (브리핑 캐시 최적화이므로 필수 아님)
    }
  }

  // ── 내부 메서드 ─────────────────────────────────────────────────

  /**
   * 캐시 확인 → Edge TTS → ElevenLabs 순서로 합성을 시도합니다.
   */
  private async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    await ensureValetDirs();

    const mergedOptions: TtsOptions = {
      voice: this.defaultVoice,
      language: this.defaultLanguage,
      dialect: this.defaultDialect,
      ...options,
    };

    const voice = mergedOptions.voice ?? this.defaultVoice;
    const language = mergedOptions.language ?? this.defaultLanguage;
    const cacheKey = getCacheKey(text, voice, language);

    // 1. 캐시 확인
    const cached = getCachedAudio(cacheKey);
    if (cached) {
      return { audioPath: cached, cached: true };
    }

    // 2. Edge TTS 시도
    const destPath = join(VALET_DIRS.cacheTts, `${cacheKey}.mp3`);

    try {
      const result = await edgeSynthesize(text, destPath, mergedOptions);
      await setCachedAudio(cacheKey, result.audioPath);
      return { ...result, audioPath: destPath, cached: false };
    } catch (edgeErr) {
      // EdgeTtsNotInstalledError 포함 모든 Edge TTS 오류 → ElevenLabs fallback
      const isExpectedError =
        edgeErr instanceof EdgeTtsNotInstalledError ||
        edgeErr instanceof Error;

      if (!isExpectedError) throw edgeErr;

      const errMsg = edgeErr instanceof Error ? edgeErr.message : String(edgeErr);
      console.error(`Edge TTS 실패 (ElevenLabs 로 전환): ${errMsg}`);
    }

    // 3. ElevenLabs fallback
    const result = await elevenSynthesize(text, destPath, mergedOptions);
    await setCachedAudio(cacheKey, result.audioPath);
    return { ...result, audioPath: destPath, cached: false };
  }
}

/** 싱글턴 인스턴스 (필요 시 import 하여 사용) */
export const ttsManager = new TtsManager();
