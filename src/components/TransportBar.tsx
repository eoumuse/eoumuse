import { useCallback, useState } from 'react'
import { useSynthStore } from '../store/synthStore'
import { audioEngine } from '../audio/AudioEngine'

export function TransportBar() {
  const isPlaying   = useSynthStore((s) => s.isPlaying)
  const audioLoaded = useSynthStore((s) => s.audioLoaded)
  const masterGain  = useSynthStore((s) => s.masterGain)
  const setPlaying  = useSynthStore((s) => s.setPlaying)
  const setMasterGain = useSynthStore((s) => s.setMasterGain)
  const [isRecording, setIsRecording] = useState(false)

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

  const handleRecord = useCallback(() => {
    if (!isPlaying) return
    if (isRecording) {
      audioEngine.stopRecording()
      setIsRecording(false)
    } else {
      audioEngine.startRecording()
      setIsRecording(true)
    }
  }, [isPlaying, isRecording])

  const handleGainChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setMasterGain(v)
    audioEngine.setMasterGain(v)
  }, [setMasterGain])

  return (
    <div className="panel neon-glow-pink" style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px' }}>

        {/* Play/Stop */}
        <button
          onClick={handlePlayStop}
          disabled={!audioLoaded}
          style={{
            width: '44px', height: '44px',
            borderRadius: '50%',
            border: isPlaying ? '2px solid #FF2D9B' : '2px solid rgba(136,136,160,0.4)',
            background: isPlaying
              ? 'radial-gradient(circle, #FF2D9B33, #323240)'
              : 'radial-gradient(circle, #50505E55, #323240)',
            cursor: audioLoaded ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            boxShadow: isPlaying ? '0 0 18px #FF2D9B66, 0 0 36px #FF2D9B33' : 'none',
            opacity: audioLoaded ? 1 : 0.4,
            flexShrink: 0,
          }}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="1" fill="#FF2D9B" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 2L12 7L3 12V2Z" fill={audioLoaded ? '#FFE629' : 'rgba(255,230,41,0.3)'} />
            </svg>
          )}
        </button>

        {/* Status */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '10px', fontWeight: '700', letterSpacing: '0.12em',
            color: isPlaying ? '#FF2D9B' : 'rgba(136,136,160,0.7)',
            textShadow: isPlaying ? '0 0 10px #FF2D9B' : 'none',
            textTransform: 'uppercase',
          }}>
            {isPlaying ? <span className="pulse-glow">● PLAYING</span>
              : !audioLoaded ? 'LOAD SAMPLE'
              : '■ STOPPED'}
          </div>
          {isRecording && (
            <div style={{ fontSize: '8px', color: '#FF2D9B', letterSpacing: '0.1em', marginTop: '2px' }}>
              <span className="rec-pulse" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#FF2D9B', marginRight: 4 }} />
              REC
            </div>
          )}
        </div>

        {/* Record button */}
        <button
          onClick={handleRecord}
          disabled={!isPlaying}
          title={isRecording ? 'Stop recording & download' : 'Start recording'}
          style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            border: `2px solid ${isRecording ? '#FF2D9B' : 'rgba(136,136,160,0.35)'}`,
            background: isRecording ? '#FF2D9B22' : 'rgba(80,80,94,0.3)',
            cursor: isPlaying ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isPlaying ? 1 : 0.35,
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          className={isRecording ? 'rec-pulse' : ''}
        >
          <div style={{
            width: 10, height: 10,
            borderRadius: isRecording ? '2px' : '50%',
            background: isRecording ? '#FF2D9B' : 'rgba(255,45,155,0.6)',
            transition: 'border-radius 0.2s',
          }} />
        </button>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em',
            color: '#FFE629', textShadow: '0 0 6px #FFE62988', textTransform: 'uppercase',
          }}>
            VOL
          </span>
          <input
            type="range" min="0" max="1" step="0.01" value={masterGain}
            onChange={handleGainChange}
            style={{
              width: '60px', WebkitAppearance: 'none', appearance: 'none',
              height: '4px', borderRadius: '2px',
              background: `linear-gradient(to right, #FFE629 ${masterGain * 100}%, rgba(136,136,160,0.2) ${masterGain * 100}%)`,
              outline: 'none', cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '9px', color: 'rgba(192,192,204,0.7)', minWidth: '26px' }}>
            {Math.round(masterGain * 100)}%
          </span>
        </div>
      </div>
    </div>
  )
}
