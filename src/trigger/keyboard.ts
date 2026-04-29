// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 전역 키보드 단축키 트리거 (KeyboardTrigger)
// ────────────────────────────────────────────────────────────────
//
//  uiohook-napi 를 사용해 전역 키 이벤트를 감지합니다.
//  (node-global-key-listener 는 아카이브되어 사용하지 않습니다)
//
//  단축키 파싱 예시:
//    "Ctrl+Shift+V"  → ctrlKey=true, shiftKey=true, keycode=V
//    "Meta+Space"    → metaKey=true, keycode=Space
// ────────────────────────────────────────────────────────────────

import { EventEmitter } from 'node:events';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import type { UiohookKeyboardEvent } from 'uiohook-napi';
import type { ValetConfig } from '../types/config.js';

// ── 수식어 집합 ──────────────────────────────────────────────────

type ModifierFlags = {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
};

// ── 단축키 파서 ──────────────────────────────────────────────────

/**
 * "Ctrl+Shift+V" 형태의 문자열을 수식어 플래그 + 키코드로 분해합니다.
 *
 * 지원 수식어: Ctrl, Shift, Alt, Meta (대소문자 무시)
 * 지원 키: UiohookKey 에 정의된 모든 키
 */
function parseShortcut(shortcut: string): { modifiers: ModifierFlags; keycode: number } {
  const parts = shortcut.split('+').map((p) => p.trim());

  const modifiers: ModifierFlags = { ctrl: false, shift: false, alt: false, meta: false };
  let mainKey = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') {
      modifiers.ctrl = true;
    } else if (lower === 'shift') {
      modifiers.shift = true;
    } else if (lower === 'alt' || lower === 'option') {
      modifiers.alt = true;
    } else if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'win') {
      modifiers.meta = true;
    } else {
      mainKey = part;
    }
  }

  if (!mainKey) {
    throw new Error(`단축키에서 메인 키를 찾을 수 없습니다: "${shortcut}"`);
  }

  // UiohookKey 에서 키코드 검색 (대소문자 무시)
  const keyMap = UiohookKey as Record<string, number>;
  // 단일 알파벳은 대문자로 정규화
  const normalizedKey = mainKey.length === 1 ? mainKey.toUpperCase() : mainKey;
  const keycode = keyMap[normalizedKey];

  if (keycode === undefined) {
    throw new Error(`지원하지 않는 키입니다: "${mainKey}" (단축키: "${shortcut}")`);
  }

  return { modifiers, keycode };
}

// ── KeyboardTrigger ──────────────────────────────────────────────

export class KeyboardTrigger extends EventEmitter {
  private active = false;
  private parsedShortcut: { modifiers: ModifierFlags; keycode: number } | null = null;
  private readonly boundHandler: (e: UiohookKeyboardEvent) => void;

  constructor(private readonly config: ValetConfig) {
    super();
    this.boundHandler = this.handleKeydown.bind(this);
  }

  /** 전역 키보드 리스닝을 시작합니다. */
  start(): void {
    if (this.active) return;

    const { shortcut } = this.config.trigger.keyboard;
    this.parsedShortcut = parseShortcut(shortcut);
    this.active = true;

    uIOhook.on('keydown', this.boundHandler);

    // uIOhook 이 이미 실행 중이 아닌 경우에만 start() 호출
    // (다른 모듈이 공유할 수 있으므로 에러를 무시)
    try {
      uIOhook.start();
    } catch {
      // 이미 시작된 경우 무시
    }
  }

  /** 전역 키보드 리스닝을 중지합니다. */
  stop(): void {
    if (!this.active) return;

    this.active = false;
    uIOhook.off('keydown', this.boundHandler);

    // uIOhook 정지 — 리스너가 모두 제거된 경우에만 의미 있음
    // 다른 모듈이 공유 중일 수 있어 에러 무시
    try {
      uIOhook.stop();
    } catch {
      // 이미 정지된 경우 무시
    }
  }

  // ── 내부 처리 ──────────────────────────────────────────────────

  private handleKeydown(e: UiohookKeyboardEvent): void {
    if (!this.active || this.parsedShortcut === null) return;

    const { modifiers, keycode } = this.parsedShortcut;

    const match =
      e.keycode === keycode &&
      e.ctrlKey === modifiers.ctrl &&
      e.shiftKey === modifiers.shift &&
      e.altKey === modifiers.alt &&
      e.metaKey === modifiers.meta;

    if (match) {
      this.emit('keyboard');
    }
  }
}
