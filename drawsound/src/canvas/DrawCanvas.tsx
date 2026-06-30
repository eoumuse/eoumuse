import { useEffect, useRef, useCallback } from 'react'
import { synth } from '../audio/Synth'
import type { BrushMode } from '../audio/Synth'

// Phosphor screen decay per animation frame (~5s lifetime at 60fps)
const FADE = 0.013

const MODE_COLOR: Record<BrushMode, string> = {
  tone:  '#7fffea',
  pad:   '#ffb3de',
  chord: '#c5a3ff',
  glitch:'#ff6b6b',
}

// Minimum pixel distance between sound trigger events
const MIN_DIST = 9

interface Props {
  mode: BrushMode
}

interface Pt { x: number; y: number; t: number }

export function DrawCanvas({ mode }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const pts        = useRef<Pt[]>([])   // current stroke buffer
  const drawing    = useRef(false)
  const lastSnd    = useRef<Pt | null>(null)
  const color      = MODE_COLOR[mode]

  // ── Resize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      // Preserve existing pixels on resize by copying
      const tmp = document.createElement('canvas')
      tmp.width  = canvas.width
      tmp.height = canvas.height
      tmp.getContext('2d')?.drawImage(canvas, 0, 0)
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      canvas.getContext('2d')?.drawImage(tmp, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // ── Phosphor fade loop ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const tick = () => {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.globalAlpha = FADE
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Rendering ────────────────────────────────────────────────────────────
  const paintPoint = useCallback((
    x: number, y: number, pressure: number, prevX?: number, prevY?: number
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const c = MODE_COLOR[mode]
    const r = 2.5 + pressure * 4.5

    // Glow halo
    ctx.save()
    ctx.shadowBlur  = 22
    ctx.shadowColor = c
    ctx.fillStyle   = c
    ctx.globalAlpha = 0.9

    // Dot
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()

    // Bezier segment to previous point
    if (prevX !== undefined && prevY !== undefined) {
      const mx = (prevX + x) / 2
      const my = (prevY + y) / 2
      ctx.strokeStyle = c
      ctx.lineWidth   = 1.5 + pressure * 3.5
      ctx.lineCap     = 'round'
      ctx.globalAlpha = 0.65
      ctx.shadowBlur  = 14
      ctx.beginPath()
      ctx.moveTo(prevX, prevY)
      ctx.quadraticCurveTo(prevX, prevY, mx, my)
      ctx.stroke()
    }

    ctx.restore()
  }, [mode])

  // ── Sound trigger ────────────────────────────────────────────────────────
  const maybeSound = useCallback((x: number, y: number, t: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ls = lastSnd.current
    const dx = ls ? x - ls.x : Infinity
    const dy = ls ? y - ls.y : Infinity
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < MIN_DIST && ls !== null) return

    const dt = ls ? (t - ls.t) / 1000 : 0.1  // seconds
    const speed = ls ? Math.min(1, dist / (dt * 600 + 1)) : 0.4

    lastSnd.current = { x, y, t }

    const nx = x / canvas.width
    const ny = y / canvas.height
    synth.trigger(nx, ny, speed, mode)
  }, [mode])

  // ── Pointer handling ─────────────────────────────────────────────────────
  const beginStroke = useCallback((x: number, y: number, pressure: number) => {
    drawing.current  = true
    lastSnd.current  = null
    pts.current      = [{ x, y, t: performance.now() }]
    paintPoint(x, y, pressure)
    maybeSound(x, y, performance.now())
  }, [paintPoint, maybeSound])

  const extendStroke = useCallback((x: number, y: number, pressure: number) => {
    if (!drawing.current) return
    const prev = pts.current[pts.current.length - 1]
    pts.current.push({ x, y, t: performance.now() })
    paintPoint(x, y, pressure, prev?.x, prev?.y)
    maybeSound(x, y, performance.now())
  }, [paintPoint, maybeSound])

  const endStroke = useCallback(() => {
    drawing.current = false
    pts.current     = []
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    beginStroke(e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5)
  }, [beginStroke])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing.current) return
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    extendStroke(e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5)
  }, [extendStroke])

  const onPointerUp = useCallback(() => endStroke(), [endStroke])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        cursor: 'crosshair',
        touchAction: 'none',
        // Subtle scanline effect via CSS repeating gradient overlay
        // applied as a sibling element — canvas itself is pure black
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  )
}

export { MODE_COLOR }
