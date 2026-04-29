/// <reference types="vite/client" />

import type { UIEvent } from '../../uiserver/server.js'

declare global {
  interface Window {
    valetBridge: {
      onUiEvent(callback: (event: UIEvent) => void): () => void
      quit(): void
    }
  }
}
