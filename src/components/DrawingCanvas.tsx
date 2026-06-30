import { useEffect, useRef, useCallback } from 'react'
import { audioEngine } from '../audio/AudioEngine'
import { drawSynthEngine } from '../audio/DrawSynthEngine'
import { useSynthStore } from '../store/synthStore'
import type { DrawMode } from '../store/synthStore'

const MODE_COLORS: Record<DrawMode, string> = {
  fm:    '#00E5FF',
  pad:   '#FF6EC7',
  grain: '#FFD700',
  glitch:'#FF4444',
}

const MODE_LABELS: Record<DrawMode, string> = {
  fm:    'FM',
  pad:   'PAD',
  grain: 'GRAIN',
  glitch:'GLITCH',
}

const FADE_ALPHA = 0.018  // phosphor decay per frame (at 60fps ≈ 4s lifetime)
const MIN_DIST   = 10     // minimum pixels between sound triggers

export function DrawingCanvas() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const lastPt     = useRef<{ x: number; y: number } | null>(null)
  const lastSnd    = useRef<{ x: number; y: number } | null>(null)
  const drawing    = useRef(false)

  const drawMode   = useSynthStore(s => s.drawMode)
  const drawEnabled = useSynthStore(s => s.drawEnabled)
  const audioBuffer = audioEngine.buffer

  // Resize canvas to match display
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Phosphor fade loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const tick = () => {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.globalAlpha = FADE_ALPHA
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Sync mode to engine
  useEffect(() => {
    drawSynthEngine.mode = drawMode
  }, [drawMode])

  const paint = useCallback((
    x: number, y: number, pressure: number, isNewStroke: boolean
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const color = MODE_COLORS[drawMode]

    // Glow effect
    ctx.shadowBlur = 18
    ctx.shadowColor = color
    ctx.fillStyle   = color
    ctx.globalAlpha = 0.85

    const r = 3 + pressure * 5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()

    // Connect stroke with a line
    if (!isNewStroke && lastPt.current) {
      ctx.strokeStyle = color
      ctx.lineWidth   = 1.5 + pressure * 3
      ctx.globalAlpha = 0.6
      ctx.shadowBlur  = 12
      ctx.beginPath()
      ctx.moveTo(lastPt.current.x, lastPt.current.y)
      ctx.lineTo(x, y)
      ctx.stroke()
    }

    ctx.shadowBlur  = 0
    ctx.globalAlpha = 1

    lastPt.current = { x, y }

    // Sound trigger (throttled by distance)
    const ls = lastSnd.current
    const dx = ls ? x - ls.x : Infinity
    const dy = ls ? y - ls.y : Infinity
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist >= MIN_DIST || isNewStroke) {
      lastSnd.current = { x, y }

      // Ensure audio context is ready
      audioEngine.initContext()
      if (audioEngine.ctx?.state === 'suspended') {
        audioEngine.ctx.resume()
      }

      const nx = x / canvas.width
      const ny = y / canvas.height
      // Estimate velocity from distance (clamped 0..1)
      const vel = Math.min(1, dist / 60) * pressure
      drawSynthEngine.trigger(nx, ny, 0.3 + vel * 0.7, audioBuffer)
    }
  }, [drawMode, audioBuffer])

  const getXY = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number; pressure: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const t = e.touches[0]
      if (!t) return null
      return {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top,
        pressure: (t as PointerEvent & Touch).force ?? 0.5,
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: 0.5,
    }
  }

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!drawEnabled) return
    drawing.current = true
    lastSnd.current = null
    lastPt.current  = null
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    paint(e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5, true)
  }, [drawEnabled, paint])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing.current || !drawEnabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    paint(e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5, false)
  }, [drawEnabled, paint])

  const onPointerUp = useCallback(() => {
    drawing.current = false
    lastPt.current  = null
  }, [])

  // Expose getXY via touch events too
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!drawEnabled) return
    e.preventDefault()
    drawing.current = true
    lastSnd.current = null
    lastPt.current  = null
    const pt = getXY(e)
    if (pt) paint(pt.x, pt.y, pt.pressure, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawEnabled, paint])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!drawing.current || !drawEnabled) return
    e.preventDefault()
    const pt = getXY(e)
    if (pt) paint(pt.x, pt.y, pt.pressure, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawEnabled, paint])

  const onTouchEnd = useCallback(() => {
    drawing.current = false
    lastPt.current  = null
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:  'absolute',
        inset:     0,
        width:     '100%',
        height:    '100%',
        cursor:    drawEnabled ? 'crosshair' : 'default',
        touchAction: 'none',
        // UI panels are above this (z-index via DOM order + pointer-events)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    />
  )
}

// Floating mode selector toolbar
export function DrawModeBar() {
  const drawMode    = useSynthStore(s => s.drawMode)
  const setDrawMode = useSynthStore(s => s.setDrawMode)
  const drawEnabled = useSynthStore(s => s.drawEnabled)
  const setDrawEnabled = useSynthStore(s => s.setDrawEnabled)

  const modes: DrawMode[] = ['fm', 'pad', 'grain', 'glitch']

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      gap:            '6px',
      padding:        '6px 10px',
      background:     'rgba(20, 20, 28, 0.78)',
      border:         `1px solid ${MODE_COLORS[drawMode]}44`,
      borderRadius:   '20px',
      backdropFilter: 'blur(10px)',
      boxShadow:      `0 0 14px ${MODE_COLORS[drawMode]}33`,
      transition:     'border-color 0.2s, box-shadow 0.2s',
    }}>
      {/* Draw toggle */}
      <button
        onClick={() => setDrawEnabled(!drawEnabled)}
        title="Toggle draw mode (D)"
        style={{
          width: '24px', height: '24px',
          borderRadius: '50%',
          border: `1px solid ${drawEnabled ? '#FFF0FF88' : '#44444466'}`,
          background: drawEnabled ? 'rgba(255,240,255,0.15)' : 'transparent',
          color:  drawEnabled ? '#FFF0FF' : '#666',
          cursor: 'pointer',
          fontSize: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
      >✏</button>

      <div style={{ width: '1px', height: '16px', background: 'rgba(136,136,153,0.3)' }} />

      {modes.map(m => {
        const active = drawMode === m
        const color  = MODE_COLORS[m]
        return (
          <button
            key={m}
            onClick={() => { setDrawMode(m); setDrawEnabled(true) }}
            title={MODE_LABELS[m]}
            style={{
              padding:      '3px 8px',
              borderRadius: '10px',
              border:       `1px solid ${active ? color : color + '44'}`,
              background:   active ? color + '22' : 'transparent',
              color:        active ? color : color + '99',
              cursor:       'pointer',
              fontSize:     '9px',
              fontWeight:   '700',
              letterSpacing:'0.12em',
              transition:   'all 0.15s',
              textShadow:   active ? `0 0 8px ${color}` : 'none',
              boxShadow:    active ? `0 0 10px ${color}44` : 'none',
            }}
          >
            {MODE_LABELS[m]}
          </button>
        )
      })}
    </div>
  )
}
