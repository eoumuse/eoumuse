import { useEffect, useRef, useState, useCallback } from 'react'
import { Knob } from './Knob'
import { slinkGateEngine, type SlinkPreset } from '../audio/SlinkGateEngine'

const CYAN = '#00E5FF'
const BAR_H = 80

const DIVISIONS = [
  { label: '1/4',  value: 1     },
  { label: '1/8',  value: 0.5   },
  { label: '1/16', value: 0.25  },
  { label: '1/32', value: 0.125 },
]

const PRESETS: { label: string; key: SlinkPreset }[] = [
  { label: 'TRANCE', key: 'trance' },
  { label: 'WOBBLE', key: 'wobble' },
  { label: 'SWEEP',  key: 'sweep'  },
  { label: 'SNAKE',  key: 'snake'  },
  { label: 'RAND',   key: 'random' },
]

export function SlinkGatePanel() {
  const [enabled,   setEnabled]   = useState(false)
  const [bpm,       setBpm]       = useState(120)
  const [steps,     setSteps]     = useState<number[]>(() => slinkGateEngine.loadPreset('trance'))
  const [smoothing, setSmoothing] = useState(0.35)
  const [depth,     setDepth]     = useState(0.65)
  const [baseFreq,  setBaseFreq]  = useState(2000)
  const [division,  setDivision]  = useState(0.25)
  const [curStep,   setCurStep]   = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const painting     = useRef(false)

  // Start/stop the engine on mount/unmount
  useEffect(() => {
    slinkGateEngine.start()
    slinkGateEngine.onStep = (s) => setCurStep(s)
    return () => {
      slinkGateEngine.stop()
      slinkGateEngine.onStep = null
    }
  }, [])

  // Keep engine in sync with all state
  useEffect(() => {
    slinkGateEngine.enabled  = enabled
    slinkGateEngine.bpm      = bpm
    slinkGateEngine.steps    = [...steps]
    slinkGateEngine.smoothing = smoothing
    slinkGateEngine.depth    = depth
    slinkGateEngine.baseFreq = baseFreq
    slinkGateEngine.division = division
  }, [enabled, bpm, steps, smoothing, depth, baseFreq, division])

  const applyPaintAt = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const idx = Math.floor((x / rect.width) * 16)
    if (idx < 0 || idx >= 16) return
    const val = Math.max(0, Math.min(1, 1 - y / rect.height))
    setSteps(prev => {
      const next = [...prev]
      next[idx] = val
      slinkGateEngine.steps = next
      return next
    })
  }, [])

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    painting.current = true
    applyPaintAt(e)
  }, [applyPaintAt])

  const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
    if (!painting.current) return
    applyPaintAt(e)
  }, [applyPaintAt])

  const stopPainting = useCallback(() => {
    painting.current = false
  }, [])

  const handlePreset = (key: SlinkPreset) => {
    const s = slinkGateEngine.loadPreset(key)
    setSteps(s)
    slinkGateEngine.steps = s
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header" style={{ borderColor: `rgba(0, 229, 255, 0.4)` }}>
        <span style={{ color: CYAN, fontWeight: 900, marginRight: 4 }}>⟁</span>
        SLINK GATE{' '}
        <span style={{ fontSize: '9px', opacity: 0.5 }}>// filter step seq</span>
        <button
          onClick={() => setEnabled(v => !v)}
          style={{
            marginLeft: 'auto',
            padding: '2px 9px',
            borderRadius: '5px',
            border: `1px solid ${enabled ? CYAN : 'rgba(255,255,255,0.15)'}`,
            background: enabled ? 'rgba(0,229,255,0.18)' : 'transparent',
            color: enabled ? CYAN : 'rgba(255,255,255,0.4)',
            fontSize: '8px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            boxShadow: enabled ? `0 0 10px rgba(0,229,255,0.4)` : 'none',
            transition: 'all 0.15s',
          }}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div style={{
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        opacity: enabled ? 1 : 0.55,
        transition: 'opacity 0.2s',
      }}>

        {/* Preset buttons */}
        <div style={{ display: 'flex', gap: '3px' }}>
          {PRESETS.map(({ label, key }) => (
            <button
              key={key}
              onClick={() => handlePreset(key)}
              style={{
                flex: 1,
                padding: '3px 0',
                borderRadius: '5px',
                border: '1px solid rgba(0,229,255,0.22)',
                background: 'rgba(0,229,255,0.06)',
                color: 'rgba(0,229,255,0.75)',
                fontSize: '7px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.16)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.06)')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Step bar sequencer */}
        <div
          ref={containerRef}
          onMouseDown={handleContainerMouseDown}
          onMouseMove={handleContainerMouseMove}
          onMouseUp={stopPainting}
          onMouseLeave={stopPainting}
          style={{
            display: 'flex',
            gap: '2px',
            height: `${BAR_H}px`,
            userSelect: 'none',
            cursor: 'crosshair',
            padding: '1px',
            borderRadius: '6px',
            background: 'rgba(0,229,255,0.03)',
            border: '1px solid rgba(0,229,255,0.1)',
          }}
        >
          {steps.map((val, i) => {
            const isActive = enabled && i === curStep
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  position: 'relative',
                  borderRadius: '3px',
                  background: isActive ? 'rgba(0,229,255,0.12)' : 'rgba(0,229,255,0.03)',
                  border: `1px solid rgba(0,229,255,${isActive ? 0.55 : 0.1})`,
                  overflow: 'hidden',
                  boxShadow: isActive ? `0 0 10px rgba(0,229,255,0.55)` : 'none',
                  transition: 'box-shadow 0.04s, border-color 0.04s, background 0.04s',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${val * 100}%`,
                    background: isActive
                      ? `linear-gradient(to top, ${CYAN}, rgba(0,229,255,0.35))`
                      : `linear-gradient(to top, rgba(0,229,255,0.65), rgba(0,229,255,0.12))`,
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Step index dots */}
        <div style={{ display: 'flex', gap: '2px', height: '5px' }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderRadius: '2px',
                background: enabled && i === curStep
                  ? CYAN
                  : i % 4 === 0
                    ? 'rgba(0,229,255,0.3)'
                    : 'rgba(0,229,255,0.1)',
                boxShadow: enabled && i === curStep ? `0 0 6px ${CYAN}` : 'none',
                transition: 'background 0.04s, box-shadow 0.04s',
              }}
            />
          ))}
        </div>

        {/* Division selector */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {DIVISIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => {
                setDivision(value)
                slinkGateEngine.division = value
              }}
              style={{
                flex: 1,
                padding: '4px 0',
                borderRadius: '6px',
                border: `1px solid ${division === value ? CYAN : 'rgba(255,255,255,0.1)'}`,
                background: division === value ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.03)',
                color: division === value ? CYAN : 'rgba(255,255,255,0.35)',
                fontSize: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: division === value ? `0 0 8px rgba(0,229,255,0.3)` : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Knobs */}
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <Knob
            value={bpm}
            min={40}
            max={240}
            label="BPM"
            color={CYAN}
            onChange={(v) => { setBpm(v); slinkGateEngine.bpm = v }}
            defaultValue={120}
            formatValue={(v) => v.toFixed(0)}
          />
          <Knob
            value={smoothing}
            min={0}
            max={1}
            label="SMOOTH"
            color={CYAN}
            onChange={(v) => { setSmoothing(v); slinkGateEngine.smoothing = v }}
            defaultValue={0.35}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
          <Knob
            value={depth}
            min={0}
            max={1}
            label="DEPTH"
            color={CYAN}
            onChange={(v) => { setDepth(v); slinkGateEngine.depth = v }}
            defaultValue={0.65}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
          <Knob
            value={baseFreq}
            min={80}
            max={18000}
            label="BASE"
            color={CYAN}
            onChange={(v) => { setBaseFreq(v); slinkGateEngine.baseFreq = v }}
            defaultValue={2000}
            formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
          />
        </div>

      </div>
    </div>
  )
}
