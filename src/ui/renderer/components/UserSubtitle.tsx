import React, { useState, useEffect } from 'react'

interface Props {
  text: string
  isFinal: boolean
}

export function UserSubtitle({ text, isFinal }: Props): React.ReactElement {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!text) {
      setVisible(false)
      return
    }

    setVisible(true)

    // 발화 완료 후 3초 뒤 fade-out
    if (isFinal) {
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [text, isFinal])

  return (
    <div
      className="h-[10%] px-4 py-1.5 flex items-center bg-black/80 border-t border-white/5 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {text && (
        <p
          className={`text-xs leading-relaxed break-words transition-colors duration-300 ${
            isFinal ? 'text-white' : 'text-gray-500'
          }`}
        >
          {!isFinal && (
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-500 animate-pulse mr-2 align-middle" />
          )}
          {text}
        </p>
      )}
    </div>
  )
}
