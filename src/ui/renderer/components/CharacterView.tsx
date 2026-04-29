import React from 'react'
import type { UIState } from '../../../uiserver/server.js'
import backgroundImg from '../assets/background.png'

interface Props {
  state: UIState
}

const stateAnimationClass: Record<UIState, string> = {
  idle: 'animate-idle',
  briefing: 'animate-active',
  'session-listening': 'animate-listening',
  'session-speaking': 'animate-active',
}

export function CharacterView({ state }: Props): React.ReactElement {
  return (
    <div className="relative flex-1 overflow-hidden">
      {/* 배경 이미지 */}
      <img
        src={backgroundImg}
        alt="AI Agent"
        className="w-full h-full object-cover"
      />

      {/* 상태별 오버레이 글로우 */}
      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-700 ${stateAnimationClass[state]}`}
      />

      {/* 상태 인디케이터 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {(['idle', 'briefing', 'session-listening', 'session-speaking'] as UIState[]).map((s) => (
          <div
            key={s}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              state === s ? 'bg-cyan-400 scale-150' : 'bg-cyan-900'
            }`}
          />
        ))}
      </div>

      <style>{`
        @keyframes idle-pulse {
          0%, 100% { box-shadow: inset 0 0 20px rgba(0, 229, 255, 0.05); }
          50% { box-shadow: inset 0 0 40px rgba(0, 229, 255, 0.15); }
        }
        @keyframes active-glow {
          0%, 100% { box-shadow: inset 0 0 60px rgba(0, 229, 255, 0.25); }
          50% { box-shadow: inset 0 0 100px rgba(0, 229, 255, 0.45); }
        }
        @keyframes listening-pulse {
          0%, 100% { box-shadow: inset 0 0 30px rgba(0, 229, 255, 0.1); }
          50% { box-shadow: inset 0 0 60px rgba(0, 229, 255, 0.2); }
        }

        .animate-idle {
          animation: idle-pulse 3s ease-in-out infinite;
        }
        .animate-active {
          animation: active-glow 1s ease-in-out infinite;
        }
        .animate-listening {
          animation: listening-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
