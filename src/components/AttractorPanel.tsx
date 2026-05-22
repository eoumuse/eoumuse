import { useCallback } from 'react'
import { Knob } from './Knob'
import { useSynthStore } from '../store/synthStore'
import { ATTRACTOR_RANGES } from '../audio/AttractorEngine'
import type { AttractorType } from '../audio/AttractorEngine'

const ATTRACTOR_TYPES: { type: AttractorType; label: string; emoji: string; desc: string }[] = [
  { type: 'lorenz',  label: 'LORENZ',  emoji: '🦋', desc: 'Butterfly chaos' },
  { type: 'rossler', label: 'RÖSSLER', emoji: '🌀', desc: 'Smooth vortex'   },
  { type: 'thomas',  label: 'THOMAS',  emoji: '✦',  desc: 'Symmetric swirl' },
]

const TYPE_COLORS: Record<AttractorType, string> = {
  lorenz:  '#FF2D9B',
  rossler: '#BF5FFF',
  thomas:  '#00E5FF',
}

export function AttractorPanel() {
  const type             = useSynthStore((s) => s.attractorType)
  const linked           = useSynthStore((s) => s.attractorLinked)
  const speed            = useSynthStore((s) => s.attractorSpeed)
  const p1               = useSynthStore((s) => s.attractorP1)
  const p2               = useSynthStore((s) => s.attractorP2)
  const p3               = useSynthStore((s) => s.attractorP3)
  const nx               = useSynthStore((s) => s.attractorNX)
  const nz               = useSynthStore((s) => s.attractorNZ)
  const vortexPitch      = useSynthStore((s) => s.attractorVortexPitch)
  const semitonesPerOrbit = useSynthStore((s) => s.semitonesPerOrbit)
  const pitchWrap        = useSynthStore((s) => s.pitchWrap)

  const setType              = useSynthStore((s) => s.setAttractorType)
  const setLinked            = useSynthStore((s) => s.setAttractorLinked)
  const setSpeed             = useSynthStore((s) => s.setAttractorSpeed)
  const setP1                = useSynthStore((s) => s.setAttractorP1)
  const setP2                = useSynthStore((s) => s.setAttractorP2)
  const setP3                = useSynthStore((s) => s.setAttractorP3)
  const setSemitonesPerOrbit = useSynthStore((s) => s.setSemitonesPerOrbit)
  const setPitchWrap         = useSynthStore((s) => s.setPitchWrap)

  const ranges = ATTRACTOR_RANGES[type]
  const accent = TYPE_COLORS[type]

  const handleType = useCallback((t: AttractorType) => {
    setType(t)
    const r = ATTRACTOR_RANGES[t]
    setP1(r.p1.default)
    setP2(r.p2.default)
    setP3(r.p3.default)
  }, [setType, setP1, setP2, setP3])

  return (
    <div className="panel">
      <div className="panel-header" style={{ borderColor: `${accent}66` }}>
        <span className="sparkle">⊛</span> ATTRACTOR ENGINE{' '}
        <span style={{ fontSize: '9px', opacity: 0.6 }}>// chaos drives sound</span>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {ATTRACTOR_TYPES.map(({ type: t, label, emoji, desc }) => (
            <button
              key={t}
              onClick={() => handleType(t)}
              title={desc}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: '10px',
                border: `1px solid ${type === t ? TYPE_COLORS[t] : 'rgba(255,255,255,0.12)'}`,
                background: type === t
                  ? `${TYPE_COLORS[t]}22`
                  : 'rgba(255,255,255,0.03)',
                color: type === t ? TYPE_COLORS[t] : 'rgba(255,255,255,0.4)',
                fontSize: '9px',
                fontWeight: '700',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: type === t ? `0 0 12px ${TYPE_COLORS[t]}44` : 'none',
              }}
            >
              <div style={{ fontSize: '14px', marginBottom: '2px' }}>{emoji}</div>
              {label}
            </button>
          ))}
        </div>

        {/* Link toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setLinked(!linked)}
            style={{
              flex: 1,
              padding: '5px 8px',
              borderRadius: '8px',
              border: `1px solid ${linked ? accent : 'rgba(255,255,255,0.15)'}`,
              background: linked ? `${accent}18` : 'rgba(255,255,255,0.04)',
              color: linked ? accent : 'rgba(255,255,255,0.35)',
              fontSize: '9px',
              fontWeight: '700',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: linked ? `0 0 10px ${accent}44` : 'none',
            }}
          >
            {linked ? '⇌ LINKED TO AUDIO' : '⇌ LINK TO AUDIO'}
          </button>
        </div>

        {/* Live state readout: X / Vortex Pitch / Z */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '4px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          padding: '6px',
        }}>
          {/* X → buffer position */}
          {[
            { label: 'X → POS',   val: nx, norm: nx,                              color: '#FF2D9B' },
            { label: 'Z → GRAIN', val: nz, norm: nz,                              color: '#00E5FF' },
          ].map(({ label, val, norm, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', marginBottom: '2px' }}>
                {label}
              </div>
              <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '2px' }}>
                <div style={{ height: '100%', width: `${norm * 100}%`, background: color, boxShadow: `0 0 6px ${color}`, transition: 'width 0.05s' }} />
              </div>
              <div style={{ fontSize: '9px', color, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 6px ${color}` }}>
                {val.toFixed(2)}
              </div>
            </div>
          ))}

          {/* Vortex pitch meter — shows current semitone value */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', marginBottom: '2px' }}>
              ↑ VORTEX
            </div>
            {/* Centred bar: negative = left, positive = right */}
            <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative', marginBottom: '2px' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                height: '100%',
                width: `${Math.abs(vortexPitch) / 24 * 50}%`,
                left: vortexPitch >= 0 ? '50%' : `${50 - Math.abs(vortexPitch) / 24 * 50}%`,
                background: '#FFE629',
                boxShadow: '0 0 6px #FFE629',
                transition: 'all 0.05s',
              }} />
              {/* Centre tick */}
              <div style={{ position: 'absolute', top: 0, left: '50%', width: '1px', height: '100%', background: 'rgba(255,255,255,0.3)' }} />
            </div>
            <div style={{ fontSize: '9px', color: '#FFE629', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 6px #FFE629' }}>
              {vortexPitch >= 0 ? '+' : ''}{vortexPitch.toFixed(1)} st
            </div>
          </div>
        </div>

        {/* Vortex pitch controls */}
        <div style={{
          background: 'rgba(255,230,41,0.04)',
          border: '1px solid rgba(255,230,41,0.18)',
          borderRadius: '10px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ fontSize: '8px', color: '#FFE629', letterSpacing: '0.12em', fontWeight: 700, opacity: 0.8 }}>
            ↑ VORTEX PITCH  <span style={{ opacity: 0.5, fontWeight: 400 }}>// orbital angle → semitones</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Knob
              value={semitonesPerOrbit}
              min={1}
              max={24}
              label="ST/ORBIT"
              color="#FFE629"
              onChange={setSemitonesPerOrbit}
              defaultValue={7}
              formatValue={(v) => `+${v.toFixed(0)}`}
            />
            <div style={{ flex: 1 }}>
              {/* Wrap / Clamp toggle */}
              <button
                onClick={() => setPitchWrap(!pitchWrap)}
                style={{
                  width: '100%',
                  padding: '5px 6px',
                  borderRadius: '8px',
                  border: `1px solid ${pitchWrap ? '#FFE62966' : 'rgba(255,255,255,0.12)'}`,
                  background: pitchWrap ? 'rgba(255,230,41,0.1)' : 'rgba(255,255,255,0.03)',
                  color: pitchWrap ? '#FFE629' : 'rgba(255,255,255,0.3)',
                  fontSize: '8px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  display: 'block',
                  transition: 'all 0.15s',
                }}
              >
                {pitchWrap ? '∞ SHEPHERD WRAP' : '⊢ CLAMP ±24st'}
              </button>
              <div style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.25)', lineHeight: 1.4, padding: '0 2px' }}>
                {pitchWrap
                  ? 'Pitch loops endlessly upward like a sonic vortex'
                  : 'Pitch rises then freezes at ceiling'}
              </div>
            </div>
          </div>
        </div>

        {/* Speed + P1/P2/P3 knobs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
        }}>
          <Knob
            value={speed}
            min={0.1}
            max={4}
            label="SPEED"
            color={accent}
            onChange={setSpeed}
            defaultValue={1}
            formatValue={(v) => v.toFixed(2) + '×'}
          />
          <Knob
            value={p1}
            min={ranges.p1.min}
            max={ranges.p1.max}
            label={ranges.p1.label}
            color={accent}
            onChange={setP1}
            defaultValue={ranges.p1.default}
            formatValue={(v) => v.toFixed(2)}
          />
          {type !== 'thomas' && (
            <Knob
              value={p2}
              min={ranges.p2.min}
              max={ranges.p2.max}
              label={ranges.p2.label}
              color={accent}
              onChange={setP2}
              defaultValue={ranges.p2.default}
              formatValue={(v) => v.toFixed(2)}
            />
          )}
          {type !== 'thomas' && (
            <Knob
              value={p3}
              min={ranges.p3.min}
              max={ranges.p3.max}
              label={ranges.p3.label}
              color={accent}
              onChange={setP3}
              defaultValue={ranges.p3.default}
              formatValue={(v) => v.toFixed(2)}
            />
          )}
        </div>

        {/* Bifurcation hint (Lorenz only) */}
        {type === 'lorenz' && (
          <div style={{
            fontSize: '9px',
            color: p2 > 24 ? '#FF6B6B' : 'rgba(255,255,255,0.25)',
            textAlign: 'center',
            letterSpacing: '0.06em',
            transition: 'color 0.3s',
          }}>
            {p2 > 24.7
              ? '⚡ CHAOTIC REGIME — sound destabilizes'
              : p2 > 20
              ? '⚠ approaching bifurcation point (ρ≈24.7)'
              : 'ρ < 24.7 — stable orbit'}
          </div>
        )}
      </div>
    </div>
  )
}
