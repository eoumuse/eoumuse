import { useRef, useEffect, useCallback } from 'react'
import { audioEngine } from '../audio/AudioEngine'
import { useSynthStore } from '../store/synthStore'

export function WavePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const audioLoaded = useSynthStore((s) => s.audioLoaded)
  const nodes = useSynthStore((s) => s.nodes)

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    const buffer = audioEngine.buffer
    if (!buffer) {
      // Draw placeholder text
      ctx.fillStyle = 'rgba(136, 136, 153, 0.35)'
      ctx.font = '700 10px "Courier New", monospace'
      ctx.letterSpacing = '0.15em'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('DROP A SAMPLE', width / 2, height / 2)
      return
    }

    // Average all channels to mono
    const nChannels = buffer.numberOfChannels
    const length = buffer.length
    const step = Math.ceil(length / width)

    // Draw waveform
    ctx.beginPath()
    ctx.strokeStyle = '#888899'
    ctx.lineWidth = 1

    for (let i = 0; i < width; i++) {
      let min = 1
      let max = -1
      for (let j = 0; j < step; j++) {
        let sampleSum = 0
        for (let ch = 0; ch < nChannels; ch++) {
          sampleSum += buffer.getChannelData(ch)[i * step + j] ?? 0
        }
        const v = sampleSum / nChannels
        if (v < min) min = v
        if (v > max) max = v
      }
      const amp = height / 2
      const y1 = (1 + min) * amp
      const y2 = (1 + max) * amp
      if (i === 0) ctx.moveTo(i, y1)
      else {
        ctx.lineTo(i, y1)
        ctx.lineTo(i, y2)
      }
    }
    ctx.stroke()

    // Draw onset node dots (gold)
    if (nodes.length > 0) {
      for (const node of nodes) {
        const x = (node.time / buffer.duration) * width
        ctx.beginPath()
        ctx.arc(x, height / 2, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = '#FFE629'
        ctx.shadowColor = '#FFE629'
        ctx.shadowBlur = 6
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    // Draw playhead (hot pink vertical line)
    const playheadX = audioEngine.position * width
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, height)
    ctx.strokeStyle = '#FF2D9B'
    ctx.lineWidth = 1.5
    ctx.shadowColor = '#FF2D9B'
    ctx.shadowBlur = 8
    ctx.stroke()
    ctx.shadowBlur = 0

    rafRef.current = requestAnimationFrame(drawFrame)
  }, [nodes])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(drawFrame)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [drawFrame])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !audioEngine.buffer) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const newPos = x / rect.width
    audioEngine.position = Math.max(0, Math.min(1, newPos))
  }, [])

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div className="panel-header">
        <span className="sparkle">✦</span> WAVEFORM <span className="sparkle" style={{ animationDelay: '0.8s' }}>✧</span>
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <canvas
          ref={canvasRef}
          width={240}
          height={60}
          onClick={handleClick}
          style={{
            width: '100%',
            height: '60px',
            borderRadius: '6px',
            background: 'rgba(0,0,0,0.4)',
            cursor: audioLoaded ? 'crosshair' : 'default',
            display: 'block',
          }}
        />
        {audioLoaded && (
          <div style={{
            marginTop: '4px',
            fontSize: '8px',
            color: 'rgba(136, 136, 153, 0.45)',
            textAlign: 'center',
            letterSpacing: '0.08em',
          }}>
            click to scrub position
          </div>
        )}
      </div>
    </div>
  )
}
