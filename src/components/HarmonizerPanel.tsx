import { useCallback } from 'react'
import { Knob } from './Knob'
import { useSynthStore } from '../store/synthStore'
import { harmonizerEngine } from '../audio/HarmonizerEngine'
import { CHORD_MODES } from '../audio/HarmonizerEngine'

const CHORD_MODE_KEYS = Object.keys(CHORD_MODES)

export function HarmonizerPanel() {
  const enabled     = useSynthStore((s) => s.harmonizerEnabled)
  const chordMode   = useSynthStore((s) => s.harmonizerChordMode)
  const voiceGain   = useSynthStore((s) => s.harmonizerVoiceGain)
  const detune      = useSynthStore((s) => s.harmonizerDetune)
  const spread      = useSynthStore((s) => s.harmonizerSpread)
  const detectedKey = useSynthStore((s) => s.detectedKey)
  const confidence  = useSynthStore((s) => s.detectedKeyConfidence)

  const setEnabled   = useSynthStore((s) => s.setHarmonizerEnabled)
  const setChordMode = useSynthStore((s) => s.setHarmonizerChordMode)
  const setVoiceGain = useSynthStore((s) => s.setHarmonizerVoiceGain)
  const setDetune    = useSynthStore((s) => s.setHarmonizerDetune)
  const setSpread    = useSynthStore((s) => s.setHarmonizerSpread)

  const handleEnabled = useCallback(() => {
    const next = !enabled
    setEnabled(next)
    harmonizerEngine.enabled = next
    if (next) harmonizerEngine.start()
    else      harmonizerEngine.stop()
  }, [enabled, setEnabled])

  const handleChordMode = useCallback((mode: string) => {
    setChordMode(mode)
    harmonizerEngine.setChordMode(mode)
  }, [setChordMode])

  const handleVoiceGain = useCallback((v: number) => {
    setVoiceGain(v)
    harmonizerEngine.setVoiceGain(v)
  }, [setVoiceGain])

  const handleDetune = useCallback((v: number) => {
    setDetune(v)
    harmonizerEngine.setDetune(v)
  }, [setDetune])

  const handleSpread = useCallback((v: number) => {
    setSpread(v)
    harmonizerEngine.setSpread(v)
  }, [setSpread])

  const confPct = Math.round(confidence * 100)

  return (
    <div className="panel">
      <div className="panel-header" style={{ borderColor: 'rgba(255, 230, 41, 0.4)' }}>
        <span className="sparkle">✦</span> HARMONIZER{' '}
        <span style={{ fontSize: '9px', opacity: 0.5 }}>// chord voices</span>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Enable toggle */}
        <button
          onClick={handleEnabled}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '10px',
            border: `1px solid ${enabled ? '#FFE629' : 'rgba(255,255,255,0.15)'}`,
            background: enabled ? 'rgba(255, 230, 41, 0.12)' : 'rgba(255,255,255,0.04)',
            color: enabled ? '#FFE629' : 'rgba(255,255,255,0.35)',
            fontSize: '10px', fontWeight: 800, letterSpacing: '0.15em',
            cursor: 'pointer', transition: 'all 0.15s', textTransform: 'uppercase',
            boxShadow: enabled ? '0 0 16px rgba(255,230,41,0.3)' : 'none',
          }}
        >
          {enabled ? '✦ HARMONIZER ON ✦' : '○ HARMONIZER OFF'}
        </button>

        {/* Chord mode grid */}
        <div style={{
          background: 'rgba(255, 230, 41, 0.03)',
          border: '1px solid rgba(255, 230, 41, 0.12)',
          borderRadius: '10px', padding: '8px',
        }}>
          <div style={{
            fontSize: '8px', fontWeight: 700, color: '#FFE629',
            letterSpacing: '0.14em', marginBottom: '6px', opacity: 0.7,
          }}>
            CHORD MODE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {CHORD_MODE_KEYS.map((mode) => (
              <button
                key={mode}
                onClick={() => handleChordMode(mode)}
                style={{
                  padding: '5px 2px', borderRadius: '7px',
                  border: `1px solid ${chordMode === mode ? '#FFE629' : 'rgba(255,255,255,0.1)'}`,
                  background: chordMode === mode ? 'rgba(255,230,41,0.18)' : 'rgba(255,255,255,0.03)',
                  color: chordMode === mode ? '#FFE629' : 'rgba(255,255,255,0.35)',
                  fontSize: '8px', fontWeight: 700, letterSpacing: '0.04em',
                  cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: chordMode === mode ? '0 0 8px rgba(255,230,41,0.25)' : 'none',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Knob row: V.GAIN · DETUNE · SPREAD */}
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <Knob
            value={voiceGain} min={0} max={1}
            label="V.GAIN" color="#FFE629"
            onChange={handleVoiceGain} defaultValue={0.35}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
          <Knob
            value={detune} min={0} max={60}
            label="DRIFT" color="#FFE629"
            onChange={handleDetune} defaultValue={12}
            formatValue={(v) => `${v.toFixed(0)}c`}
          />
          <Knob
            value={spread} min={0} max={1}
            label="SPREAD" color="#FFE629"
            onChange={handleSpread} defaultValue={0.85}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
        </div>

        {/* Detected key badge */}
        {detectedKey ? (
          <div style={{
            background: 'rgba(255, 230, 41, 0.06)',
            border: '1px solid rgba(255, 230, 41, 0.2)',
            borderRadius: '10px', padding: '8px 10px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: '5px',
            }}>
              <div style={{
                fontSize: '11px', fontWeight: 800, color: '#FFE629',
                letterSpacing: '0.1em', textShadow: '0 0 10px #FFE629',
              }}>
                {detectedKey}
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(255, 230, 41, 0.7)', fontVariantNumeric: 'tabular-nums' }}>
                {confPct}%
              </div>
            </div>
            <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${confPct}%`,
                background: 'linear-gradient(90deg, #FFE629, #888899)',
                boxShadow: '0 0 6px #FFE629', transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px', padding: '8px 10px', textAlign: 'center',
            fontSize: '8px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em',
          }}>
            load a sample to detect key
          </div>
        )}

      </div>
    </div>
  )
}
