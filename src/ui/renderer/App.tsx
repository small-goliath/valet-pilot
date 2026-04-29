import React from 'react'
import { useValetState } from './hooks/useValetState.js'
import { CharacterView } from './components/CharacterView.js'
import { AiSubtitle } from './components/AiSubtitle.js'
import { UserSubtitle } from './components/UserSubtitle.js'

export default function App(): React.ReactElement {
  const { state, aiText, userText, userTextFinal } = useValetState()

  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden select-none"
      style={{ background: '#0a0a0f' }}
    >
      {/* AI 캐릭터 영역 — 상단 70% */}
      <CharacterView state={state} />

      {/* AI 자막 영역 — 20% */}
      <AiSubtitle text={aiText} />

      {/* 사용자 발화 영역 — 10% */}
      <UserSubtitle text={userText} isFinal={userTextFinal} />
    </div>
  )
}
