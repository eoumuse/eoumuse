import { useCallback } from 'react'
import { useSynthStore } from '../store/synthStore'
import { audioEngine } from '../audio/AudioEngine'

export function TransportBar() {
  const isPlaying = useSynthStore((s) => s.isPlaying)
  const audioLoaded = useSynthStore((s) => s.audioLoaded)
  const masterGain = useSynthStore((s) => s.masterGain)
  const setPlaying = useSynthStore((s) => s.setPlaying)
  const setMasterGain = useSynthStore((s) => s.setMasterGain)

  const handlePlayStop = useCallback(() => {
    if (!audioLoaded) return

    if (isPlaying) {
      audioEngine.stop()
      setPlaying(false)
    } else {
      audioEngine.start()
      setPlaying(true)
    }
  }, [isPlaying, audioLoaded, setPlaying])

  const handleGainChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setMasterGain(v)
    audioEngine.setMasterGain(v)
  }, [setMasterGain])

  const canPlay = audioLoaded

  return (
    <div className="panel neon-glow-purple" style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
      }}>
        {/* Play/Stop button */}
        <button
          onClick={handlePlayStop}
          disabled={!canPlay}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: isPlaying ? '2px solid #FF2D9B' : '2px solid rgba(191, 95, 255, 0.5)',
            background: isPlaying
              ? 'radial-gradient(circle, #FF2D9B33, #1A0028)'
              : 'radial-gradient(circle, #BF5FFF22, #1A0028)',
            cursor: canPlay ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            boxShadow: isPlaying ? '0 0 20px #FF2D9B66, 0 0 40px #FF2D9B33' : 'none',
            opacity: canPlay ? 1 : 0.4,
            flexShrink: 0,
          }}
        >
          {isPlaying ? (
            // Stop icon
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="1" fill="#FF2D9B" />
            </svg>
          ) : (
            // Play icon
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 2L12 7L3 12V2Z" fill={canPlay ? '#BF5FFF' : 'rgba(191,95,255,0.3)'} />
            </svg>
          )}
        </button>

        {/* Status text */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '0.12em',
            color: isPlaying ? '#FF2D9B' : 'rgba(191,95,255,0.6)',
            textShadow: isPlaying ? '0 0 10px #FF2D9B' : 'none',
            textTransform: 'uppercase',
          }}>
            {isPlaying ? (
              <span className="pulse-glow">● PLAYING</span>
            ) : !audioLoaded ? (
              'LOAD SAMPLE'
            ) : (
              '■ STOPPED'
            )}
          </div>
        </div>

        {/* Master gain slider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{
            fontSize: '9px',
            fontWeight: '700',
            letterSpacing: '0.1em',
            color: '#00E5FF',
            textShadow: '0 0 8px #00E5FF',
            textTransform: 'uppercase',
          }}>
            VOL
          </span>
          <div style={{ position: 'relative', width: '70px' }}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterGain}
              onChange={handleGainChange}
              style={{
                width: '100%',
                WebkitAppearance: 'none',
                appearance: 'none',
                height: '4px',
                borderRadius: '2px',
                background: `linear-gradient(to right, #00E5FF ${masterGain * 100}%, rgba(255,255,255,0.1) ${masterGain * 100}%)`,
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>
          <span style={{
            fontSize: '9px',
            color: 'rgba(255,240,255,0.6)',
            minWidth: '26px',
          }}>
            {Math.round(masterGain * 100)}%
          </span>
        </div>
      </div>
    </div>
  )
}
