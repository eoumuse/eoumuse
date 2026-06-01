import { useEffect, useRef, useState, useCallback } from 'react'
import { Knob } from './Knob'
import { slinkGateEngine, type SlinkPreset, type MidiPortInfo } from '../audio/SlinkGateEngine'

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
  const [enabled,     setEnabled]     = useState(false)
  const [bpm,         setBpm]         = useState(120)
  const [steps,       setSteps]       = useState<number[]>(() => slinkGateEngine.loadPreset('trance'))
  const [smoothing,   setSmoothing]   = useState(0.35)
  const [depth,       setDepth]       = useState(0.65)
  const [baseFreq,    setBaseFreq]    = useState(2000)
  const [division,    setDivision]    = useState(0.25)
  const [curStep,     setCurStep]     = useState(-1)

  // MIDI state
  const [midiEnabled,  setMidiEnabled]  = useState(false)
  const [midiPorts,    setMidiPorts]    = useState<MidiPortInfo[]>([])
  const [midiPortId,   setMidiPortId]   = useState<string>('')
  const [midiCC,       setMidiCC]       = useState(74)
  const [midiChannel,  setMidiChannel]  = useState(1)
  const [midiReady,    setMidiReady]    = useState<boolean | null>(null) // null=unchecked

  const containerRef = useRef<HTMLDivElement>(null)
  const painting     = useRef(false)

  useEffect(() => {
    slinkGateEngine.start()
    slinkGateEngine.onStep = (s) => setCurStep(s)
    return () => {
      slinkGateEngine.stop()
      slinkGateEngine.onStep = null
    }
  }, [])

  useEffect(() => {
    slinkGateEngine.enabled     = enabled
    slinkGateEngine.bpm         = bpm
    slinkGateEngine.steps       = [...steps]
    slinkGateEngine.smoothing   = smoothing
    slinkGateEngine.depth       = depth
    slinkGateEngine.baseFreq    = baseFreq
    slinkGateEngine.division    = division
    slinkGateEngine.midiEnabled = midiEnabled
    slinkGateEngine.midiCC      = midiCC
    slinkGateEngine.midiChannel = midiChannel - 1
  }, [enabled, bpm, steps, smoothing, depth, baseFreq, division, midiEnabled, midiCC, midiChannel])

  const handleRequestMidi = useCallback(async () => {
    const ports = await slinkGateEngine.requestMidi()
    setMidiReady(ports.length >= 0)
    setMidiPorts(ports)
    if (ports.length > 0 && !midiPortId) {
      setMidiPortId(ports[0].id)
      slinkGateEngine.selectOutput(ports[0].id)
    }
  }, [midiPortId])

  const handlePortChange = useCallback((id: string) => {
    setMidiPortId(id)
    slinkGateEngine.selectOutput(id || null)
  }, [])

  const applyPaintAt = useCallback((e: React.MouseEvent) => {
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

  const stopPainting = useCallback(() => { painting.current = false }, [])

  const handlePreset = (key: SlinkPreset) => {
    const s = slinkGateEngine.loadPreset(key)
    setSteps(s)
    slinkGateEngine.steps = s
  }

  const panelStyle: React.CSSProperties = {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    opacity: enabled ? 1 : 0.55,
    transition: 'opacity 0.2s',
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header" style={{ borderColor: 'rgba(0, 229, 255, 0.4)' }}>
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
            boxShadow: enabled ? '0 0 10px rgba(0,229,255,0.4)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div style={panelStyle}>

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
                  boxShadow: isActive ? '0 0 10px rgba(0,229,255,0.55)' : 'none',
                  transition: 'box-shadow 0.04s, border-color 0.04s, background 0.04s',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    height: `${val * 100}%`,
                    background: isActive
                      ? `linear-gradient(to top, ${CYAN}, rgba(0,229,255,0.35))`
                      : 'linear-gradient(to top, rgba(0,229,255,0.65), rgba(0,229,255,0.12))',
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Step position dots */}
        <div style={{ display: 'flex', gap: '2px', height: '5px' }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderRadius: '2px',
                background: enabled && i === curStep
                  ? CYAN
                  : i % 4 === 0 ? 'rgba(0,229,255,0.3)' : 'rgba(0,229,255,0.1)',
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
              onClick={() => { setDivision(value); slinkGateEngine.division = value }}
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
                boxShadow: division === value ? '0 0 8px rgba(0,229,255,0.3)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Knobs */}
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <Knob value={bpm} min={40} max={240} label="BPM" color={CYAN}
            onChange={(v) => { setBpm(v); slinkGateEngine.bpm = v }}
            defaultValue={120} formatValue={(v) => v.toFixed(0)} />
          <Knob value={smoothing} min={0} max={1} label="SMOOTH" color={CYAN}
            onChange={(v) => { setSmoothing(v); slinkGateEngine.smoothing = v }}
            defaultValue={0.35} formatValue={(v) => `${Math.round(v * 100)}%`} />
          <Knob value={depth} min={0} max={1} label="DEPTH" color={CYAN}
            onChange={(v) => { setDepth(v); slinkGateEngine.depth = v }}
            defaultValue={0.65} formatValue={(v) => `${Math.round(v * 100)}%`} />
          <Knob value={baseFreq} min={80} max={18000} label="BASE" color={CYAN}
            onChange={(v) => { setBaseFreq(v); slinkGateEngine.baseFreq = v }}
            defaultValue={2000}
            formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`} />
        </div>

        {/* ── MIDI OUT section ── */}
        <div style={{
          background: 'rgba(0,229,255,0.04)',
          border: '1px solid rgba(0,229,255,0.15)',
          borderRadius: '10px',
          padding: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '7px', gap: '6px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: CYAN, letterSpacing: '0.14em', opacity: 0.85 }}>
              MIDI OUT
            </div>
            {/* Enable toggle */}
            <button
              onClick={() => setMidiEnabled(v => !v)}
              disabled={midiReady === null || midiPorts.length === 0}
              style={{
                padding: '1px 7px',
                borderRadius: '4px',
                border: `1px solid ${midiEnabled ? CYAN : 'rgba(255,255,255,0.12)'}`,
                background: midiEnabled ? 'rgba(0,229,255,0.18)' : 'transparent',
                color: midiEnabled ? CYAN : 'rgba(255,255,255,0.35)',
                fontSize: '7px',
                fontWeight: 700,
                cursor: midiReady !== null && midiPorts.length > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
                opacity: midiReady !== null ? 1 : 0.4,
              }}
            >
              {midiEnabled ? 'ON' : 'OFF'}
            </button>
            {/* Request MIDI button */}
            {midiReady === null && (
              <button
                onClick={handleRequestMidi}
                style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(0,229,255,0.4)',
                  background: 'rgba(0,229,255,0.1)',
                  color: CYAN,
                  fontSize: '7px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                CONNECT
              </button>
            )}
            {midiReady !== null && midiPorts.length === 0 && (
              <span style={{ marginLeft: 'auto', fontSize: '7px', color: 'rgba(255,80,80,0.8)' }}>
                no ports
              </span>
            )}
          </div>

          {/* Port selector */}
          {midiReady !== null && midiPorts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <select
                value={midiPortId}
                onChange={e => handlePortChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '3px 5px',
                  borderRadius: '5px',
                  border: '1px solid rgba(0,229,255,0.25)',
                  background: 'rgba(0,0,0,0.5)',
                  color: 'rgba(0,229,255,0.9)',
                  fontSize: '8px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {midiPorts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {/* CC / Ch row */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <label style={{ fontSize: '7px', color: 'rgba(0,229,255,0.6)', letterSpacing: '0.08em' }}>
                  CC
                </label>
                <input
                  type="number"
                  min={0}
                  max={127}
                  value={midiCC}
                  onChange={e => setMidiCC(Math.max(0, Math.min(127, parseInt(e.target.value) || 0)))}
                  style={{
                    width: '38px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    border: '1px solid rgba(0,229,255,0.2)',
                    background: 'rgba(0,0,0,0.4)',
                    color: CYAN,
                    fontSize: '9px',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
                <label style={{ fontSize: '7px', color: 'rgba(0,229,255,0.6)', letterSpacing: '0.08em', marginLeft: '4px' }}>
                  CH
                </label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={midiChannel}
                  onChange={e => setMidiChannel(Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))}
                  style={{
                    width: '32px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    border: '1px solid rgba(0,229,255,0.2)',
                    background: 'rgba(0,0,0,0.4)',
                    color: CYAN,
                    fontSize: '9px',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
                <span style={{ marginLeft: 'auto', fontSize: '7px', color: 'rgba(0,229,255,0.4)' }}>
                  → Ableton
                </span>
              </div>
            </div>
          )}

          {/* Setup hint */}
          <div style={{ marginTop: '5px', fontSize: '7px', color: 'rgba(0,229,255,0.35)', lineHeight: 1.5 }}>
            {midiReady === null
              ? 'Mac: IAC Driver  /  Win: loopMIDI'
              : midiEnabled
                ? `送出中 CC#${midiCC} ch${midiChannel} → MIDI Learn でマップ`
                : 'OFFにするとウェブ内蔵フィルターのみ'}
          </div>
        </div>

      </div>
    </div>
  )
}
