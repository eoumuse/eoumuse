import { useRef, useEffect, useCallback } from 'react'
import { audioEngine } from '../audio/AudioEngine'
import { useSynthStore } from '../store/synthStore'
import { getCachedPeaks, buildWaveformPeaks, drawPeaksStroke } from '../audio/waveformPeaks'

const HANDLE_HIT = 10   // px — click radius to grab a loop handle
const CANVAS_W = 240
const CANVAS_H = 60

export function WavePreview() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const dragRef    = useRef<'start' | 'end' | null>(null)

  const audioLoaded   = useSynthStore((s) => s.audioLoaded)
  const nodes         = useSynthStore((s) => s.nodes)
  const loopEnabled   = useSynthStore((s) => s.loopEnabled)
  const setLoopStart  = useSynthStore((s) => s.setLoopStart)
  const setLoopEnd    = useSynthStore((s) => s.setLoopEnd)
  const setLoopEnabled = useSynthStore((s) => s.setLoopEnabled)

  // Rebuild peaks when buffer becomes available / changes
  useEffect(() => {
    const buf = audioEngine.buffer
    if (buf && audioLoaded) buildWaveformPeaks(buf, CANVAS_W)
  }, [audioLoaded, nodes.length])

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    const buffer = audioEngine.buffer
    if (!buffer) {
      ctx.fillStyle = 'rgba(144, 152, 172, 0.35)'
      ctx.font = '700 10px "Courier New", monospace'
      ctx.letterSpacing = '0.15em'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('DROP A SAMPLE', width / 2, height / 2)
      rafRef.current = requestAnimationFrame(drawFrame)
      return
    }

    const peaks = getCachedPeaks() ?? buildWaveformPeaks(buffer, width)

    const st   = useSynthStore.getState()
    const ls   = st.loopStart
    const le   = st.loopEnd
    const loopOn = st.loopEnabled
    const lx   = ls * width
    const rx   = le * width

    if (loopOn) {
      const grad = ctx.createLinearGradient(lx, 0, rx, 0)
      grad.addColorStop(0, 'rgba(255,154,200,0.10)')
      grad.addColorStop(1, 'rgba(255,230,41,0.10)')
      ctx.fillStyle = grad
      ctx.fillRect(lx, 0, rx - lx, height)
    }

    drawPeaksStroke(ctx, peaks, height, 0, width, 'rgba(144,152,172,0.50)')
    if (loopOn) {
      drawPeaksStroke(
        ctx, peaks, height,
        Math.floor(lx), Math.ceil(rx),
        'rgba(212,160,32,0.65)',
      )
    }

    for (const node of nodes) {
      const x = (node.time / buffer.duration) * width
      ctx.beginPath()
      ctx.arc(x, height / 2, 2, 0, Math.PI * 2)
      ctx.fillStyle = '#FFB37C'
      ctx.shadowColor = '#FFB37C'; ctx.shadowBlur = 5
      ctx.fill(); ctx.shadowBlur = 0
    }

    if (loopOn) {
      const drawHandle = (x: number, color: string, flip: boolean) => {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height)
        ctx.strokeStyle = color; ctx.lineWidth = 1.5
        ctx.shadowColor = color; ctx.shadowBlur = 7
        ctx.stroke(); ctx.shadowBlur = 0
        ctx.beginPath()
        if (!flip) { ctx.moveTo(x, 0); ctx.lineTo(x + 9, 0); ctx.lineTo(x, 10) }
        else        { ctx.moveTo(x, 0); ctx.lineTo(x - 9, 0); ctx.lineTo(x, 10) }
        ctx.closePath(); ctx.fillStyle = color; ctx.fill()
      }
      drawHandle(lx, '#FF9AC8', false)
      drawHandle(rx, '#FFB37C', true)
    }

    const phx = audioEngine.position * width
    ctx.beginPath(); ctx.moveTo(phx, 0); ctx.lineTo(phx, height)
    ctx.strokeStyle = '#FF9AC8'; ctx.lineWidth = 1.5
    ctx.shadowColor = '#FF9AC8'; ctx.shadowBlur = 8
    ctx.stroke(); ctx.shadowBlur = 0

    rafRef.current = requestAnimationFrame(drawFrame)
  }, [nodes])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(drawFrame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [drawFrame])

  useEffect(() => {
    const onUp = () => { dragRef.current = null }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [])

  const toNorm = useCallback((clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  const toCanvasPx = useCallback((clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    return (clientX - rect.left) * (canvas.width / rect.width)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx  = toCanvasPx(e.clientX)
    const w   = canvas.width
    const st  = useSynthStore.getState()
    if (st.loopEnabled) {
      if (Math.abs(cx - st.loopStart * w) < HANDLE_HIT) { dragRef.current = 'start'; return }
      if (Math.abs(cx - st.loopEnd   * w) < HANDLE_HIT) { dragRef.current = 'end';   return }
    }
    if (audioEngine.buffer) audioEngine.position = toNorm(e.clientX)
  }, [toCanvasPx, toNorm])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    const nx = toNorm(e.clientX)
    const st = useSynthStore.getState()
    if (dragRef.current === 'start') setLoopStart(Math.min(nx, st.loopEnd - 0.02))
    else                              setLoopEnd(Math.max(nx, st.loopStart + 0.02))
  }, [toNorm, setLoopStart, setLoopEnd])

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span><span className="sparkle">✦</span> WAVEFORM</span>
        {audioLoaded && (
          <button
            onClick={() => setLoopEnabled(!loopEnabled)}
            style={{
              fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em',
              padding: '2px 7px', borderRadius: '5px',
              border: `1px solid ${loopEnabled ? '#FF9AC8' : 'rgba(245,240,230,0.15)'}`,
              background: loopEnabled ? 'rgba(255,154,200,0.15)' : 'transparent',
              color: loopEnabled ? '#FF9AC8' : 'rgba(245,240,230,0.35)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            LOOP {loopEnabled ? 'ON' : 'OFF'}
          </button>
        )}
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          style={{
            width: '100%', height: '60px', borderRadius: '6px',
            background: 'rgba(0,0,0,0.4)', display: 'block',
            cursor: audioLoaded ? 'crosshair' : 'default',
          }}
        />
        {audioLoaded && (
          <div style={{
            marginTop: '4px', fontSize: '8px',
            color: 'rgba(144,152,172,0.4)', textAlign: 'center', letterSpacing: '0.08em',
          }}>
            {loopEnabled
              ? 'drag ▶ start · ◀ end handles · click to scrub'
              : 'click to scrub · press LOOP ON to enable'}
          </div>
        )}
      </div>
    </div>
  )
}
