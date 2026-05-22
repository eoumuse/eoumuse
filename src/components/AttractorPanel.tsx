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
  const type        = useSynthStore((s) => s.attractorType)
  const linked      = useSynthStore((s) => s.attractorLinked)
  const speed       = useSynthStore((s) => s.attractorSpeed)
  const p1          = useSynthStore((s) => s.attractorP1)
  const p2          = useSynthStore((s) => s.attractorP2)
  const p3          = useSynthStore((s) => s.attractorP3)
  const nx          = useSynthStore((s) => s.attractorNX)
  const ny          = useSynthStore((s) => s.attractorNY)
  const nz          = useSynthStore((s) => s.attractorNZ)

  const setType     = useSynthStore((s) => s.setAttractorType)
  const setLinked   = useSynthStore((s) => s.setAttractorLinked)
  const setSpeed    = useSynthStore((s) => s.setAttractorSpeed)
  const setP1       = useSynthStore((s) => s.setAttractorP1)
  const setP2       = useSynthStore((s) => s.setAttractorP2)
  const setP3       = useSynthStore((s) => s.setAttractorP3)

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

        {/* Live XYZ readout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '4px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          padding: '6px',
        }}>
          {[
            { label: 'X → POS', val: nx, color: '#FF2D9B' },
            { label: 'Y → PITCH', val: ny, color: '#FFE629' },
            { label: 'Z → GRAIN', val: nz, color: '#00E5FF' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '8px',
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.06em',
                marginBottom: '2px',
              }}>
                {label}
              </div>
              {/* Mini bar */}
              <div style={{
                height: '3px',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
                marginBottom: '2px',
              }}>
                <div style={{
                  height: '100%',
                  width: `${val * 100}%`,
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                  transition: 'width 0.05s',
                }} />
              </div>
              <div style={{
                fontSize: '9px',
                color,
                fontVariantNumeric: 'tabular-nums',
                textShadow: `0 0 6px ${color}`,
              }}>
                {val.toFixed(2)}
              </div>
            </div>
          ))}
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
