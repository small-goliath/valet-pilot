import { useState, useEffect } from 'react'
import type { UIEvent, UIState } from '../../../uiserver/server.js'

export interface ValetState {
  state: UIState
  aiText: string
  userText: string
  userTextFinal: boolean
}

const initialState: ValetState = {
  state: 'idle',
  aiText: '',
  userText: '',
  userTextFinal: false,
}

export function useValetState(): ValetState {
  const [valetState, setValetState] = useState<ValetState>(initialState)

  useEffect(() => {
    const unsubscribe = window.valetBridge.onUiEvent((event: UIEvent) => {
      setValetState((prev) => applyEvent(prev, event))
    })

    return unsubscribe
  }, [])

  return valetState
}

function applyEvent(prev: ValetState, event: UIEvent): ValetState {
  switch (event.type) {
    case 'state-change': {
      const newState = event.payload as UIState
      const isNewSession =
        (newState === 'briefing' || newState === 'session-listening') &&
        prev.state === 'idle'

      return {
        ...prev,
        state: newState,
        // 새 브리핑/세션 시작 시 텍스트 초기화 (F111)
        aiText: isNewSession ? '' : prev.aiText,
        userText: isNewSession ? '' : prev.userText,
        userTextFinal: isNewSession ? false : prev.userTextFinal,
      }
    }

    case 'ai-text':
      return { ...prev, aiText: event.payload }

    case 'user-text':
      return { ...prev, userText: event.payload, userTextFinal: false }

    case 'user-text-final':
      return { ...prev, userText: event.payload, userTextFinal: true }

    default:
      return prev
  }
}
