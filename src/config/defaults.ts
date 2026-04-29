// ────────────────────────────────────────────────────────────────
//  Valet Pilot — config.yaml 기본값 상수
// ────────────────────────────────────────────────────────────────

import type { ValetConfig } from '../types/config.js';

export const DEFAULT_CONFIG: ValetConfig = {
  agent: {
    nickname: '자비스',
    user_name: '주인님',
    model: 'kimi-k2.5',
    language: 'korean',
    dialect: undefined,
    voice: 'female-01',
    model_priority: ['kimi-k2.5', 'claude', 'gpt', 'gemini', 'llama'],
  },

  trigger: {
    clap: {
      enabled: true,
      threshold_db: -30,
      interval_ms: 800,
    },
    wake_word: {
      enabled: true,
      words: ['좋은 아침', '시작'],
    },
    keyboard: {
      enabled: true,
      shortcut: 'Ctrl+Shift+V',
    },
  },

  bgm: {
    file: 'bgm/opening.mp3',
    greeting_end: 51.6,
    shout_start: 51.7,
    shout_end: 53.0,
    report_start: 53.2,
    max_duration: 59,
  },

  session: {
    end_keywords: ['퇴근', '끝', '종료', '수고했어'],
    auto_end_minutes: 120,
    farewell_enabled: true,
  },

  stt: {
    whisper_model: 'large-v3',
    fallback_to_cloud: false,
  },

  cache: {
    refresh_interval_minutes: 30,
  },

  interests: [],
};
