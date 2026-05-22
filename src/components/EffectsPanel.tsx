import { useCallback } from 'react'
import { Knob } from './Knob'
import { useSynthStore } from '../store/synthStore'
import { audioEngine } from '../audio/AudioEngine'

const FILTER_TYPES = [
  { label: 'LP', value: 'lowpass'  as BiquadFilterType },
  { label: 'HP', value: 'highpass' as BiquadFilterType },
  { label: 'BP', value: 'bandpass' as BiquadFilterType },
]

export function EffectsPanel() {
  const filterCutoff    = useSynthStore((s) => s.filterCutoff)
  const filterResonance = useSynthStore((s) => s.filterResonance)
  const filterType      = useSynthStore((s) => s.filterType)
  const delayTime       = useSynthStore((s) => s.delayTime)
  const delayFeedback   = useSynthStore((s) => s.delayFeedback)
  const delayWet        = useSynthStore((s) => s.delayWet)
  const reverbWet       = useSynthStore((s) => s.reverbWet)

  const setFilterCutoff    = useSynthStore((s) => s.setFilterCutoff)
  const setFilterResonance = useSynthStore((s) => s.setFilterResonance)
  const setFilterType      = useSynthStore((s) => s.setFilterType)
  const setDelayTime       = useSynthStore((s) => s.setDelayTime)
  const setDelayFeedback   = useSynthStore((s) => s.setDelayFeedback)
  const setDelayWet        = useSynthStore((s) => s.setDelayWet)
  const setReverbWet       = useSynthStore((s) => s.setReverbWet)

  const handleFilterCutoff = useCallback((v: number) => {
    setFilterCutoff(v)
    audioEngine.setFilterCutoff(v)
  }, [setFilterCutoff])

  const handleFilterResonance = useCallback((v: number) => {
    setFilterResonance(v)
    audioEngine.setFilterResonance(v)
  }, [setFilterResonance])

  const handleFilterType = useCallback((t: string) => {
    setFilterType(t)
    audioEngine.setFilterType(t as BiquadFilterType)
  }, [setFilterType])

  const handleDelayTime = useCallback((v: number) => {
    setDelayTime(v)
    audioEngine.setDelayTime(v)
  }, [setDelayTime])

  const handleDelayFeedback = useCallback((v: number) => {
    setDelayFeedback(v)
    audioEngine.setDelayFeedback(v)
  }, [setDelayFeedback])

  const handleDelayWet = useCallback((v: number) => {
    setDelayWet(v)
    audioEngine.setDelayWet(v)
  }, [setDelayWet])

  const handleReverbWet = useCallback((v: number) => {
    setReverbWet(v)
    audioEngine.setReverbWet(v)
  }, [setReverbWet])

  return (
    <div className="panel">
      <div className="panel-header" style={{ borderColor: 'rgba(0, 229, 255, 0.4)' }}>
        <span className="sparkle">⊛</span> FX CHAIN{' '}
        <span style={{ fontSize: '9px', opacity: 0.5 }}>// filter · delay · reverb</span>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Filter section */}
        <div style={{
          background: 'rgba(0, 229, 255, 0.04)',
          border: '1px solid rgba(0, 229, 255, 0.15)',
          borderRadius: '10px',
          padding: '8px',
        }}>
          <div style={{
            fontSize: '8px',
            fontWeight: 700,
            color: '#00E5FF',
            letterSpacing: '0.14em',
            marginBottom: '8px',
            opacity: 0.8,
          }}>
            FILTER
          </div>

          {/* Type toggle buttons */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            {FILTER_TYPES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handleFilterType(value)}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  borderRadius: '7px',
                  border: `1px solid ${filterType === value ? '#00E5FF' : 'rgba(255,255,255,0.1)'}`,
                  background: filterType === value ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255,255,255,0.03)',
                  color: filterType === value ? '#00E5FF' : 'rgba(255,255,255,0.35)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: filterType === value ? '0 0 10px rgba(0,229,255,0.3)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Cutoff + Resonance knobs */}
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <Knob
              value={filterCutoff}
              min={80}
              max={18000}
              label="CUTOFF"
              color="#00E5FF"
              onChange={handleFilterCutoff}
              defaultValue={8000}
              formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
            />
            <Knob
              value={filterResonance}
              min={0.1}
              max={20}
              label="RESO"
              color="#00E5FF"
              onChange={handleFilterResonance}
              defaultValue={1}
              formatValue={(v) => v.toFixed(1)}
            />
          </div>
        </div>

        {/* Delay section */}
        <div style={{
          background: 'rgba(191, 95, 255, 0.04)',
          border: '1px solid rgba(191, 95, 255, 0.15)',
          borderRadius: '10px',
          padding: '8px',
        }}>
          <div style={{
            fontSize: '8px',
            fontWeight: 700,
            color: '#BF5FFF',
            letterSpacing: '0.14em',
            marginBottom: '8px',
            opacity: 0.8,
          }}>
            DELAY
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <Knob
              value={delayTime}
              min={0}
              max={2}
              label="TIME"
              color="#BF5FFF"
              onChange={handleDelayTime}
              defaultValue={0.25}
              formatValue={(v) => `${v.toFixed(2)}s`}
            />
            <Knob
              value={delayFeedback}
              min={0}
              max={0.95}
              label="FDBK"
              color="#BF5FFF"
              onChange={handleDelayFeedback}
              defaultValue={0.3}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />
            <Knob
              value={delayWet}
              min={0}
              max={1}
              label="WET"
              color="#BF5FFF"
              onChange={handleDelayWet}
              defaultValue={0}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>

        {/* Reverb section */}
        <div style={{
          background: 'rgba(255, 45, 155, 0.04)',
          border: '1px solid rgba(255, 45, 155, 0.15)',
          borderRadius: '10px',
          padding: '8px',
        }}>
          <div style={{
            fontSize: '8px',
            fontWeight: 700,
            color: '#FF2D9B',
            letterSpacing: '0.14em',
            marginBottom: '8px',
            opacity: 0.8,
          }}>
            REVERB
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Knob
              value={reverbWet}
              min={0}
              max={1}
              label="WET"
              color="#FF2D9B"
              onChange={handleReverbWet}
              defaultValue={0}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
