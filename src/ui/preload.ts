// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Electron Preload Script
//  contextBridge로 렌더러에 안전한 IPC API를 노출합니다.
// ────────────────────────────────────────────────────────────────

import { contextBridge, ipcRenderer } from 'electron'
import type { UIEvent } from '../uiserver/server.js'

contextBridge.exposeInMainWorld('valetBridge', {
  /**
   * UI 이벤트 구독 핸들러를 등록합니다.
   * @param callback 이벤트 수신 시 호출될 콜백
   * @returns 구독 해제 함수
   */
  onUiEvent(callback: (event: UIEvent) => void): () => void {
    const handler = (_: Electron.IpcRendererEvent, event: UIEvent) => callback(event)
    ipcRenderer.on('ui-event', handler)
    return () => ipcRenderer.off('ui-event', handler)
  },

  /** 앱 종료 요청 */
  quit(): void {
    ipcRenderer.send('quit')
  },
})
