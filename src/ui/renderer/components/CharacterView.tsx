import React, { useEffect, useRef } from 'react'
import type { UIState } from '../../../uiserver/server.js'

interface Props {
  state: UIState
}

const STATE_COLOR: Record<UIState, string> = {
  idle: 'rgba(0, 180, 220, 0.6)',
  briefing: 'rgba(0, 229, 255, 1)',
  'session-listening': 'rgba(100, 255, 180, 1)',
  'session-speaking': 'rgba(0, 200, 255, 1)',
}

const STATE_GLOW: Record<UIState, string> = {
  idle: '0 0 30px rgba(0,180,220,0.15)',
  briefing: '0 0 80px rgba(0,229,255,0.5), 0 0 160px rgba(0,229,255,0.2)',
  'session-listening': '0 0 60px rgba(100,255,180,0.4), 0 0 120px rgba(100,255,180,0.15)',
  'session-speaking': '0 0 80px rgba(0,200,255,0.45), 0 0 150px rgba(0,200,255,0.2)',
}

const PARTICLE_COUNT = 18

export function CharacterView({ state }: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const isActive = state === 'briefing' || state === 'session-speaking'
  const isListening = state === 'session-listening'
  const accentColor = STATE_COLOR[state]

  // Canvas particle animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (i / PARTICLE_COUNT) * Math.PI * 2,
      radius: 80 + Math.random() * 80,
      speed: 0.002 + Math.random() * 0.003,
      size: 1 + Math.random() * 2,
      opacity: 0.2 + Math.random() * 0.6,
      orbitVariance: Math.random() * 20,
    }))

    let t = 0
    function draw() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      const s = stateRef.current

      const speedMul = s === 'idle' ? 0.4 : s === 'session-listening' ? 1.2 : 1.8
      t += 0.016 * speedMul

      const baseColor =
        s === 'session-listening' ? '100,255,180' : '0,229,255'

      // Draw orbit trail rings
      for (let ring = 0; ring < 3; ring++) {
        const r = 90 + ring * 40
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${baseColor},${0.04 + ring * 0.02})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Draw particles
      particles.forEach((p, i) => {
        p.angle += p.speed * speedMul
        const wobble = Math.sin(t * 1.5 + i) * p.orbitVariance * 0.3
        const r = p.radius + wobble
        const x = cx + Math.cos(p.angle) * r
        const y = cy + Math.sin(p.angle) * r * 0.55 // elliptical orbit

        const alpha = p.opacity * (0.5 + 0.5 * Math.sin(t * 2 + i))
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${baseColor},${alpha})`
        ctx.fill()

        // Occasionally draw connecting line to core
        if (i % 4 === 0) {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(x, y)
          ctx.strokeStyle = `rgba(${baseColor},${alpha * 0.08})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      })

      // Scan line
      if (s !== 'idle') {
        const scanY = cy - 100 + ((t * 40) % 200)
        const grad = ctx.createLinearGradient(cx - 120, 0, cx + 120, 0)
        grad.addColorStop(0, `rgba(${baseColor},0)`)
        grad.addColorStop(0.5, `rgba(${baseColor},0.15)`)
        grad.addColorStop(1, `rgba(${baseColor},0)`)
        ctx.fillStyle = grad
        ctx.fillRect(cx - 120, scanY, 240, 1.5)
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="relative flex-1 overflow-hidden" style={{ background: '#050810' }}>

      {/* ── 배경 격자 ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,229,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,229,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── 하단 페이드 아웃 ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #050810)' }}
      />

      {/* ── 파티클 캔버스 ── */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ── 메인 캐릭터 코어 ── */}
      <div className="absolute inset-0 flex items-center justify-center">

        {/* 외부 헥사곤 프레임 */}
        <svg
          className="absolute"
          width="280" height="280"
          viewBox="-140 -140 280 280"
          style={{ opacity: isActive ? 0.6 : 0.3, transition: 'opacity 0.7s' }}
        >
          <polygon
            points="0,-120 103.9,-60 103.9,60 0,120 -103.9,60 -103.9,-60"
            fill="none"
            stroke={accentColor}
            strokeWidth="1"
            strokeDasharray="6 4"
          />
          <polygon
            points="0,-98 84.9,-49 84.9,49 0,98 -84.9,49 -84.9,-49"
            fill="none"
            stroke={accentColor}
            strokeWidth="0.5"
            strokeOpacity="0.4"
          />
        </svg>

        {/* 회전 링 1 */}
        <div
          className="absolute w-52 h-52 rounded-full border border-cyan-400/20"
          style={{
            animation: `spin ${isActive ? '5s' : '14s'} linear infinite`,
            boxShadow: 'none',
          }}
        >
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,229,255,0.9)]" />
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full bg-cyan-400/60" />
        </div>

        {/* 회전 링 2 (역방향) */}
        <div
          className="absolute w-40 h-40 rounded-full border border-cyan-300/15"
          style={{
            animation: `spin-reverse ${isListening ? '3s' : '9s'} linear infinite`,
          }}
        >
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-green-400/80 shadow-[0_0_5px_rgba(100,255,180,0.8)]"
            style={{ display: isListening ? 'block' : 'none' }}
          />
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-cyan-400/60"
            style={{ display: isListening ? 'none' : 'block' }}
          />
        </div>

        {/* 펄스 링 (active 상태) */}
        {isActive && (
          <>
            <div className="absolute w-36 h-36 rounded-full border border-cyan-400/30" style={{ animation: 'ping 1.6s cubic-bezier(0,0,0.2,1) infinite' }} />
            <div className="absolute w-36 h-36 rounded-full border border-cyan-400/15" style={{ animation: 'ping 1.6s cubic-bezier(0,0,0.2,1) infinite', animationDelay: '0.6s' }} />
          </>
        )}

        {/* 청취 펄스 링 */}
        {isListening && (
          <div className="absolute w-36 h-36 rounded-full border border-green-400/30" style={{ animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite' }} />
        )}

        {/* ── AI 페이스 코어 ── */}
        <div
          className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-700"
          style={{
            background: 'radial-gradient(circle at 40% 35%, rgba(0,229,255,0.15) 0%, rgba(0,20,40,0.9) 60%, rgba(0,10,20,1) 100%)',
            border: `1px solid ${accentColor}`,
            boxShadow: STATE_GLOW[state],
          }}
        >
          {/* 이마 라인 */}
          <div
            className="absolute top-4 w-10 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
          />

          {/* 눈 영역 */}
          <div className="flex gap-4 mb-2 mt-1">
            <Eye state={state} />
            <Eye state={state} />
          </div>

          {/* 입 / 오디오 파형 */}
          <Mouth state={state} accentColor={accentColor} />

          {/* 하단 라인 */}
          <div
            className="absolute bottom-4 w-10 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
          />
        </div>
      </div>

      {/* ── 상태 텍스트 ── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
        <StateLabel state={state} />
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes eye-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.1); }
        }
        @keyframes eye-active {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px currentColor; }
          50% { opacity: 0.6; box-shadow: 0 0 12px currentColor; }
        }
        @keyframes mouth-talk {
          0%, 100% { height: 2px; }
          25% { height: 6px; }
          50% { height: 3px; }
          75% { height: 8px; }
        }
        @keyframes mouth-listen {
          0%, 100% { width: 20px; }
          50% { width: 28px; }
        }
        @keyframes bar1 { 0%,100%{height:3px} 50%{height:10px} }
        @keyframes bar2 { 0%,100%{height:6px} 50%{height:3px} }
        @keyframes bar3 { 0%,100%{height:9px} 50%{height:4px} }
        @keyframes bar4 { 0%,100%{height:4px} 50%{height:11px} }
        @keyframes bar5 { 0%,100%{height:7px} 50%{height:2px} }
      `}</style>
    </div>
  )
}

// ── Eye sub-component ──────────────────────────────────────────────

function Eye({ state }: { state: UIState }): React.ReactElement {
  const isListening = state === 'session-listening'
  const isActive = state === 'briefing' || state === 'session-speaking'
  const color = isListening ? '#64ffb4' : '#00e5ff'

  return (
    <div
      className="w-5 h-5 rounded-sm flex items-center justify-center overflow-hidden"
      style={{
        border: `1px solid ${color}`,
        background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
        animation: isActive ? 'eye-active 1.2s ease-in-out infinite' : 'eye-blink 4s ease-in-out infinite',
        color,
      }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: isActive ? 'eye-active 0.8s ease-in-out infinite' : undefined,
        }}
      />
    </div>
  )
}

// ── Mouth sub-component ───────────────────────────────────────────

function Mouth({ state, accentColor }: { state: UIState; accentColor: string }): React.ReactElement {
  const isSpeaking = state === 'briefing' || state === 'session-speaking'
  const isListening = state === 'session-listening'

  if (isSpeaking) {
    // 오디오 파형 바
    return (
      <div className="flex items-end gap-0.5 h-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="w-1 rounded-full"
            style={{
              background: accentColor,
              boxShadow: `0 0 4px ${accentColor}`,
              animation: `bar${i} ${0.3 + i * 0.07}s ease-in-out infinite`,
              animationDelay: `${i * 0.05}s`,
              height: '4px',
            }}
          />
        ))}
      </div>
    )
  }

  if (isListening) {
    // 늘어났다 줄어드는 가로선
    return (
      <div
        className="h-0.5 rounded-full"
        style={{
          background: '#64ffb4',
          boxShadow: '0 0 5px #64ffb4',
          animation: 'mouth-listen 1.2s ease-in-out infinite',
          width: '20px',
        }}
      />
    )
  }

  // Idle: 작은 가로선
  return (
    <div
      className="w-5 h-0.5 rounded-full"
      style={{
        background: `linear-gradient(90deg, transparent, ${accentColor}80, transparent)`,
      }}
    />
  )
}

// ── State label ───────────────────────────────────────────────────

const STATE_LABEL: Record<UIState, string> = {
  idle: 'STANDBY',
  briefing: 'BRIEFING',
  'session-listening': 'LISTENING',
  'session-speaking': 'SPEAKING',
}

const STATE_LABEL_COLOR: Record<UIState, string> = {
  idle: 'rgba(0,180,220,0.35)',
  briefing: 'rgba(0,229,255,0.8)',
  'session-listening': 'rgba(100,255,180,0.8)',
  'session-speaking': 'rgba(0,229,255,0.8)',
}

function StateLabel({ state }: { state: UIState }): React.ReactElement {
  return (
    <span
      className="text-[9px] tracking-[0.3em] font-mono font-light"
      style={{ color: STATE_LABEL_COLOR[state], transition: 'color 0.5s' }}
    >
      {STATE_LABEL[state]}
    </span>
  )
}
