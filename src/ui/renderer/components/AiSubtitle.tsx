import React, { useEffect, useRef } from 'react'

interface Props {
  text: string
}

export function AiSubtitle({ text }: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  // 새 텍스트가 오면 자동 스크롤 (최신 내용 유지)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [text])

  return (
    <div
      ref={containerRef}
      className="h-[20%] px-4 py-2 overflow-y-auto bg-black/60 backdrop-blur-sm border-t border-cyan-900/40"
      style={{ scrollbarWidth: 'none' }}
    >
      {text ? (
        <p
          className="text-sm leading-relaxed text-cyan-300 break-words"
          style={{ textShadow: '0 0 8px rgba(0,229,255,0.6)' }}
        >
          {text}
        </p>
      ) : (
        <p className="text-sm text-cyan-900/40 italic">대기 중...</p>
      )}
    </div>
  )
}
