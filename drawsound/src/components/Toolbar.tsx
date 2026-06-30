import type { BrushMode, ScaleName } from '../audio/Synth'
import { synth } from '../audio/Synth'
import { MODE_COLOR } from '../canvas/DrawCanvas'

const MODES: { id: BrushMode; label: string; hint: string }[] = [
  { id: 'tone',  label: 'TONE',  hint: 'FM bell — OPN' },
  { id: 'pad',   label: 'PAD',   hint: 'slow sine — iku sakan' },
  { id: 'chord', label: 'CHORD', hint: 'quartal FM stack' },
  { id: 'glitch',label: 'GLITCH',hint: 'stutter IDM' },
]

const SCALES: { id: ScaleName; label: string }[] = [
  { id: 'pentatonic', label: 'PENTA' },
  { id: 'wholetone',  label: 'WHOLE' },
  { id: 'minor',      label: 'MINOR' },
  { id: 'phrygian',   label: 'PHRYG' },
  { id: 'chromatic',  label: 'CHROM' },
]

interface Props {
  mode: BrushMode
  scale: ScaleName
  reverbWet: number
  onMode: (m: BrushMode) => void
  onScale: (s: ScaleName) => void
  onReverb: (v: number) => void
}

const BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.12em',
  fontSize: '10px',
  fontWeight: '700',
  padding: '5px 9px',
  borderRadius: '8px',
  transition: 'all 0.15s',
}

const SEP: React.CSSProperties = {
  width: '1px',
  height: '16px',
  background: 'rgba(255,255,255,0.1)',
  flexShrink: 0,
}

export function Toolbar({ mode, scale, reverbWet, onMode, onScale, onReverb }: Props) {
  const activeColor = MODE_COLOR[mode]

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      gap:            '4px',
      padding:        '7px 12px',
      background:     'rgba(8, 8, 18, 0.82)',
      border:         `1px solid ${activeColor}33`,
      borderRadius:   '24px',
      backdropFilter: 'blur(16px)',
      boxShadow:      `0 0 24px ${activeColor}22, 0 2px 8px rgba(0,0,0,0.6)`,
      transition:     'border-color 0.25s, box-shadow 0.25s',
      userSelect:     'none',
    }}>

      {/* Mode buttons */}
      {MODES.map(m => {
        const active = mode === m.id
        const c = MODE_COLOR[m.id]
        return (
          <button
            key={m.id}
            title={m.hint}
            onClick={() => onMode(m.id)}
            style={{
              ...BTN,
              color:     active ? c : c + '66',
              background: active ? c + '18' : 'transparent',
              border:    `1px solid ${active ? c + '66' : 'transparent'}`,
              textShadow: active ? `0 0 10px ${c}` : 'none',
              boxShadow:  active ? `0 0 12px ${c}33` : 'none',
            }}
          >
            {m.label}
          </button>
        )
      })}

      <div style={SEP} />

      {/* Scale buttons */}
      {SCALES.map(s => {
        const active = scale === s.id
        return (
          <button
            key={s.id}
            onClick={() => { onScale(s.id); synth.scale = s.id }}
            style={{
              ...BTN,
              color:      active ? '#fff' : 'rgba(255,255,255,0.3)',
              background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
              border:     `1px solid ${active ? 'rgba(255,255,255,0.3)' : 'transparent'}`,
              fontSize:   '9px',
            }}
          >
            {s.label}
          </button>
        )
      })}

      <div style={SEP} />

      {/* Reverb slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>REV</span>
        <input
          type="range"
          min={0} max={1} step={0.01}
          value={reverbWet}
          onChange={e => { onReverb(Number(e.target.value)); synth.setReverbWet(Number(e.target.value)) }}
          style={{
            width: '56px',
            height: '3px',
            accentColor: activeColor,
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  )
}
