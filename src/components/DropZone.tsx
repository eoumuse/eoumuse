import { useRef, useState, useCallback } from 'react'
import { audioEngine } from '../audio/AudioEngine'
import { detectOnsets } from '../audio/OnsetDetector'
import { harmonizerEngine } from '../audio/HarmonizerEngine'
import { detectKey } from '../audio/KeyDetector'
import { useSynthStore } from '../store/synthStore'

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setNodes = useSynthStore((s) => s.setNodes)
  const setAudioLoaded = useSynthStore((s) => s.setAudioLoaded)
  const setDetectedKey = useSynthStore((s) => s.setDetectedKey)
  const fileName = useSynthStore((s) => s.fileName)
  const audioLoaded = useSynthStore((s) => s.audioLoaded)

  const drawWaveform = useCallback((buffer: AudioBuffer) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const data = buffer.getChannelData(0)
    const { width, height } = canvas
    const step = Math.ceil(data.length / width)
    const amp = height / 2

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, width, height)

    // Draw waveform
    ctx.beginPath()
    ctx.strokeStyle = '#BF5FFF'
    ctx.lineWidth = 1

    for (let i = 0; i < width; i++) {
      let min = 1, max = -1
      for (let j = 0; j < step; j++) {
        const v = data[i * step + j] ?? 0
        if (v < min) min = v
        if (v > max) max = v
      }
      const x = i
      const y1 = (1 + min) * amp
      const y2 = (1 + max) * amp
      if (i === 0) ctx.moveTo(x, y1)
      else {
        ctx.lineTo(x, y1)
        ctx.lineTo(x, y2)
      }
    }
    ctx.stroke()

    // Glow layer
    ctx.beginPath()
    ctx.strokeStyle = '#FF2D9B'
    ctx.lineWidth = 0.5
    ctx.globalAlpha = 0.5

    for (let i = 0; i < width; i++) {
      let sum = 0
      for (let j = 0; j < step; j++) {
        sum += Math.abs(data[i * step + j] ?? 0)
      }
      const rms = sum / step
      const y = (1 - rms) * amp
      if (i === 0) ctx.moveTo(i, y)
      else ctx.lineTo(i, y)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }, [])

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(wav|mp3|ogg|flac|aiff|m4a)$/i)) {
      return
    }

    setIsLoading(true)
    try {
      await audioEngine.loadFile(file)
      const buf = audioEngine.buffer!
      const nodes = detectOnsets(buf, 200)
      setNodes(nodes)
      setAudioLoaded(true, file.name)

      // Wire harmonizer buffer
      harmonizerEngine.setBuffer(buf)

      // Run key detection (async-friendly but runs sync on PCM data)
      try {
        const keyResult = detectKey(buf)
        setDetectedKey(keyResult.name, keyResult.confidence)
      } catch (e) {
        console.warn('Key detection failed:', e)
      }

      // Draw waveform
      drawWaveform(buf)
    } catch (e) {
      console.error('Failed to load audio:', e)
    } finally {
      setIsLoading(false)
    }
  }, [setNodes, setAudioLoaded, setDetectedKey, drawWaveform])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  return (
    <div className="panel" style={{ width: '100%' }}>
      <div className="panel-header">
        <span className="sparkle">✦</span> SAMPLE LOADER <span className="sparkle" style={{ animationDelay: '0.5s' }}>✧</span>
      </div>

      <div style={{ padding: '12px' }}>
        {/* Drop Area */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragging
              ? '2px dashed #FF2D9B'
              : '2px dashed rgba(191, 95, 255, 0.4)',
            borderRadius: '12px',
            padding: '16px 12px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: isDragging ? 'rgba(255, 45, 155, 0.05)' : 'transparent',
            boxShadow: isDragging ? '0 0 20px #FF2D9B44' : 'none',
          }}
        >
          {isLoading ? (
            <div style={{ color: '#BF5FFF', fontSize: '12px' }}>
              <div className="sparkle" style={{ fontSize: '20px', marginBottom: '4px' }}>★</div>
              ANALYZING...
            </div>
          ) : audioLoaded ? (
            <div style={{ color: '#FFE629', fontSize: '11px' }}>
              <div style={{ color: '#00E5FF', marginBottom: '4px', fontSize: '10px' }}>✦ LOADED ✦</div>
              <div style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '200px',
                margin: '0 auto',
              }}>
                {fileName}
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(191, 95, 255, 0.7)', fontSize: '11px' }}>
              <div className="float" style={{ fontSize: '18px', marginBottom: '6px', color: '#FF2D9B' }}>✦</div>
              <div style={{ fontWeight: '700', letterSpacing: '0.1em', color: '#FFF0FF' }}>DROP SAMPLE</div>
              <div style={{ fontSize: '10px', marginTop: '2px', color: 'rgba(191, 95, 255, 0.5)' }}>or click to browse</div>
            </div>
          )}
        </div>

        {/* Waveform canvas */}
        {audioLoaded && (
          <canvas
            ref={canvasRef}
            width={220}
            height={40}
            style={{
              width: '100%',
              height: '40px',
              marginTop: '8px',
              borderRadius: '6px',
              background: 'rgba(0,0,0,0.3)',
            }}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={onFileInput}
        />
      </div>
    </div>
  )
}
