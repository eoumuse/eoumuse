import { useCallback } from 'react'
import { Knob } from './Knob'
import { useSynthStore } from '../store/synthStore'
import { audioEngine } from '../audio/AudioEngine'

export function AgentPanel() {
  const grainSize = useSynthStore((s) => s.grainSize)
  const density = useSynthStore((s) => s.density)
  const position = useSynthStore((s) => s.position)
  const scatter = useSynthStore((s) => s.scatter)
  const pitch = useSynthStore((s) => s.pitch)
  const panSpread = useSynthStore((s) => s.panSpread)

  const setGrainSize = useSynthStore((s) => s.setGrainSize)
  const setDensity = useSynthStore((s) => s.setDensity)
  const setPosition = useSynthStore((s) => s.setPosition)
  const setScatter = useSynthStore((s) => s.setScatter)
  const setPitch = useSynthStore((s) => s.setPitch)
  const setPanSpread = useSynthStore((s) => s.setPanSpread)

  const handleGrainSize = useCallback((v: number) => {
    setGrainSize(v)
    audioEngine.grainSize = v
  }, [setGrainSize])

  const handleDensity = useCallback((v: number) => {
    setDensity(v)
    audioEngine.density = v
  }, [setDensity])

  const handlePosition = useCallback((v: number) => {
    setPosition(v)
    audioEngine.position = v
  }, [setPosition])

  const handleScatter = useCallback((v: number) => {
    setScatter(v)
    audioEngine.scatter = v
  }, [setScatter])

  const handlePitch = useCallback((v: number) => {
    setPitch(v)
    audioEngine.pitch = v
  }, [setPitch])

  const handlePanSpread = useCallback((v: number) => {
    setPanSpread(v)
    audioEngine.panSpread = v
  }, [setPanSpread])

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="sparkle">★</span> GRAIN ENGINE <span className="sparkle" style={{ animationDelay: '1s' }}>✦</span>
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
        }}>
          <Knob
            value={position}
            min={0}
            max={1}
            label="POS"
            color="#FF6B4A"
            onChange={handlePosition}
            defaultValue={0.5}
            formatValue={(v) => (v * 100).toFixed(0) + '%'}
          />
          <Knob
            value={grainSize}
            min={10}
            max={2000}
            label="GRAIN"
            color="#8FA084"
            onChange={handleGrainSize}
            defaultValue={150}
            formatValue={(v) => v.toFixed(0) + 'ms'}
          />
          <Knob
            value={density}
            min={1}
            max={100}
            label="DENS"
            color="#FFD24A"
            onChange={handleDensity}
            defaultValue={8}
            formatValue={(v) => v.toFixed(1)}
          />
          <Knob
            value={pitch}
            min={-24}
            max={24}
            label="PITCH"
            color="#FFD24A"
            onChange={handlePitch}
            defaultValue={0}
            formatValue={(v) => (v >= 0 ? '+' : '') + v.toFixed(1)}
          />
          <Knob
            value={scatter}
            min={0}
            max={1}
            label="SCATTER"
            color="#FF6B6B"
            onChange={handleScatter}
            defaultValue={0.2}
            formatValue={(v) => (v * 100).toFixed(0) + '%'}
          />
          <Knob
            value={panSpread}
            min={0}
            max={1}
            label="PAN"
            color="#8FA084"
            onChange={handlePanSpread}
            defaultValue={0.4}
            formatValue={(v) => (v * 100).toFixed(0) + '%'}
          />
        </div>
      </div>
    </div>
  )
}
