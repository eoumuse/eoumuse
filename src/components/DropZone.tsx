import { useRef, useState, useCallback, useEffect } from 'react'
import { audioEngine } from '../audio/AudioEngine'
import { detectOnsets } from '../audio/OnsetDetector'
import { harmonizerEngine } from '../audio/HarmonizerEngine'
import { detectKey } from '../audio/KeyDetector'
import { useSynthStore } from '../store/synthStore'

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [durationLabel, setDurationLabel] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const keyAnalysisTimerRef = useRef<number | null>(null)
  const loadSequenceRef = useRef(0)

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
    const sampleStride = Math.max(1, Math.ceil(step / 256))
    const amp = height / 2

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, width, height)

    // Draw waveform
    ctx.beginPath()
    ctx.strokeStyle = '#888899'
    ctx.lineWidth = 1

    for (let i = 0; i < width; i++) {
      let min = 1, max = -1
      for (let j = 0; j < step; j += sampleStride) {
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
      let sampleCount = 0
      for (let j = 0; j < step; j += sampleStride) {
        sum += Math.abs(data[i * step + j] ?? 0)
        sampleCount++
      }
      const rms = sum / Math.max(1, sampleCount)
      const y = (1 - rms) * amp
      if (i === 0) ctx.moveTo(i, y)
      else ctx.lineTo(i, y)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }, [])

  const makeOverviewBuffer = useCallback((source: AudioBuffer) => {
    const overviewRate = Math.min(source.sampleRate, 8000)
    if (source.sampleRate <= overviewRate) return source

    const overview = new AudioBuffer({
      length: Math.max(1, Math.ceil(source.duration * overviewRate)),
      numberOfChannels: 1,
      sampleRate: overviewRate,
    })
    const input = source.getChannelData(0)
    const output = overview.getChannelData(0)
    const ratio = source.sampleRate / overviewRate

    for (let i = 0; i < output.length; i++) {
      output[i] = input[Math.min(input.length - 1, Math.floor(i * ratio))]
    }
    return overview
  }, [])

  const makeKeySnippet = useCallback((source: AudioBuffer) => {
    const snippetSeconds = Math.min(5, source.duration)
    const snippetLength = Math.max(1, Math.floor(snippetSeconds * source.sampleRate))
    if (snippetLength >= source.length) return source

    const snippet = new AudioBuffer({
      length: snippetLength,
      numberOfChannels: source.numberOfChannels,
      sampleRate: source.sampleRate,
    })
    const start = Math.max(0, Math.floor((source.length - snippetLength) / 2))
    for (let channel = 0; channel < source.numberOfChannels; channel++) {
      snippet.copyToChannel(source.getChannelData(channel).subarray(start, start + snippetLength), channel)
    }
    return snippet
  }, [])

  const formatDuration = useCallback((seconds: number) => {
    const totalSeconds = Math.round(seconds)
    const minutes = Math.floor(totalSeconds / 60)
    const remainder = String(totalSeconds % 60).padStart(2, '0')
    return `${minutes}:${remainder}`
  }, [])

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(wav|mp3|ogg|flac|aiff|m4a)$/i)) {
      setLoadError('SUPPORTED AUDIO FILE REQUIRED')
      return
    }

    const loadSequence = ++loadSequenceRef.current
    if (keyAnalysisTimerRef.current !== null) {
      window.clearTimeout(keyAnalysisTimerRef.current)
      keyAnalysisTimerRef.current = null
    }
    setLoadError('')
    setDurationLabel('')
    setIsLoading(true)
    try {
      await audioEngine.loadFile(file)
      const buf = audioEngine.buffer!
      if (loadSequence !== loadSequenceRef.current) return

      // Analyze a lightweight, duration-preserving overview instead of scanning
      // every PCM sample from a long recording.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const overview = makeOverviewBuffer(buf)
      const nodes = detectOnsets(overview, 200)
      setNodes(nodes)
      setAudioLoaded(true, file.name)
      setDurationLabel(formatDuration(buf.duration))

      // Wire harmonizer buffer
      harmonizerEngine.setBuffer(buf)

      // Key detection is intentionally deferred and limited to a representative
      // five-second section so a ten-minute file does not freeze the interface.
      keyAnalysisTimerRef.current = window.setTimeout(() => {
        if (loadSequence !== loadSequenceRef.current) return
        try {
          const keyResult = detectKey(makeKeySnippet(overview))
          if (loadSequence === loadSequenceRef.current) {
            setDetectedKey(keyResult.name, keyResult.confidence)
          }
        } catch (e) {
          console.warn('Key detection failed:', e)
        }
      }, 80)
    } catch (e) {
      console.error('Failed to load audio:', e)
      setLoadError('COULD NOT LOAD THIS AUDIO FILE')
    } finally {
      if (loadSequence === loadSequenceRef.current) setIsLoading(false)
    }
  }, [setNodes, setAudioLoaded, setDetectedKey, makeOverviewBuffer, makeKeySnippet, formatDuration])

  useEffect(() => {
    if (!audioLoaded || !audioEngine.buffer) return
    const frameId = requestAnimationFrame(() => drawWaveform(audioEngine.buffer!))
    return () => cancelAnimationFrame(frameId)
  }, [audioLoaded, fileName, drawWaveform])

  useEffect(() => () => {
    loadSequenceRef.current++
    if (keyAnalysisTimerRef.current !== null) window.clearTimeout(keyAnalysisTimerRef.current)
  }, [])

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
              : '2px dashed rgba(136, 136, 153, 0.4)',
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
            <div style={{ color: '#888899', fontSize: '12px' }}>
              <div className="sparkle" style={{ fontSize: '20px', marginBottom: '4px' }}>★</div>
              ANALYZING...
            </div>
          ) : audioLoaded ? (
            <div style={{ color: '#FFE629', fontSize: '11px' }}>
              <div style={{ color: '#FFE629', marginBottom: '4px', fontSize: '10px' }}>✦ LOADED ✦</div>
              <div style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '200px',
                margin: '0 auto',
              }}>
                {fileName}
              </div>
              {durationLabel && (
                <div style={{ marginTop: '4px', fontSize: '9px', color: 'rgba(255,240,255,0.45)' }}>
                  {durationLabel} · LONG SAMPLE READY
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'rgba(136, 136, 153, 0.7)', fontSize: '11px' }}>
              <div className="float" style={{ fontSize: '18px', marginBottom: '6px', color: '#FF2D9B' }}>✦</div>
              <div style={{ fontWeight: '700', letterSpacing: '0.1em', color: '#FFF0FF' }}>DROP SAMPLE</div>
              <div style={{ fontSize: '10px', marginTop: '2px', color: 'rgba(136, 136, 153, 0.5)' }}>or click to browse</div>
              <div style={{ fontSize: '8px', marginTop: '6px', color: 'rgba(255,230,41,0.55)', letterSpacing: '0.08em' }}>
                LONG FILES · ABOUT 10 MIN
              </div>
            </div>
          )}
        </div>

        {loadError && (
          <div style={{ marginTop: '7px', color: '#FF2D9B', fontSize: '9px', textAlign: 'center' }}>
            {loadError}
          </div>
        )}

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
