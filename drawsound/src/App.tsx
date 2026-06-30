import { useState, useEffect, useCallback } from 'react'
import { DrawCanvas, MODE_COLOR } from './canvas/DrawCanvas'
import { Toolbar } from './components/Toolbar'
import type { BrushMode, ScaleName } from './audio/Synth'

const KEY_MAP: Record<string, BrushMode> = {
  t: 'tone', p: 'pad', c: 'chord', g: 'glitch',
  '1': 'tone', '2': 'pad', '3': 'chord', '4': 'glitch',
}

export default function App() {
  const [mode,      setMode]      = useState<BrushMode>('tone')
  const [scale,     setScale]     = useState<ScaleName>('pentatonic')
  const [reverbWet, setReverbWet] = useState(0.45)
  const [showHint,  setShowHint]  = useState(true)

  // Keyboard shortcuts
  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return
    if (KEY_MAP[e.key]) setMode(KEY_MAP[e.key])
    // Hide hint on any key
    setShowHint(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  const handlePointerDown = useCallback(() => setShowHint(false), [])

  const color = MODE_COLOR[mode]

  return (
    <div
      style={{
        position:   'relative',
        width:      '100vw',
        height:     '100vh',
        overflow:   'hidden',
        background: '#080810',
        fontFamily: '"SF Mono", "Fira Code", monospace',
      }}
      onPointerDown={handlePointerDown}
    >
      {/* Subtle scanline overlay */}
      <div style={{
        position:         'absolute',
        inset:            0,
        backgroundImage:  'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        pointerEvents:    'none',
        zIndex:           5,
      }} />

      {/* Main drawing canvas */}
      <DrawCanvas mode={mode} />

      {/* Title — top left */}
      <div style={{
        position:  'absolute',
        top:       '20px',
        left:      '24px',
        zIndex:    20,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize:      '11px',
          fontWeight:    '700',
          letterSpacing: '0.25em',
          color:         color,
          textShadow:    `0 0 12px ${color}`,
          transition:    'color 0.25s, text-shadow 0.25s',
          textTransform: 'uppercase',
        }}>
          draw.sound
        </div>
        <div style={{
          fontSize:      '9px',
          color:         'rgba(255,255,255,0.2)',
          letterSpacing: '0.15em',
          marginTop:     '3px',
        }}>
          {mode} · {scale}
        </div>
      </div>

      {/* Key hints — top right */}
      <div style={{
        position:  'absolute',
        top:       '20px',
        right:     '24px',
        zIndex:    20,
        pointerEvents: 'none',
        textAlign: 'right',
      }}>
        {([
          ['T', 'TONE — FM bell'],
          ['P', 'PAD — sine shimmer'],
          ['C', 'CHORD — quartal FM'],
          ['G', 'GLITCH — IDM stutter'],
        ] as [string, string][]).map(([key, label]) => (
          <div key={key} style={{
            fontSize:      '9px',
            color:         'rgba(255,255,255,0.18)',
            letterSpacing: '0.1em',
            marginBottom:  '4px',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'flex-end',
            gap:           '6px',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            <span style={{
              background:    'rgba(255,255,255,0.08)',
              border:        '1px solid rgba(255,255,255,0.15)',
              borderRadius:  '4px',
              padding:       '1px 5px',
              fontSize:      '8px',
            }}>{key}</span>
          </div>
        ))}
      </div>

      {/* First-use hint — center */}
      {showHint && (
        <div style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          zIndex:         15,
          pointerEvents:  'none',
        }}>
          <div style={{
            textAlign:  'center',
            animation:  'pulse 2.8s ease-in-out infinite',
          }}>
            <div style={{
              fontSize:      '13px',
              color:         'rgba(255,255,255,0.22)',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom:  '10px',
            }}>
              draw to generate sound
            </div>
            <div style={{
              fontSize:      '10px',
              color:         'rgba(255,255,255,0.1)',
              letterSpacing: '0.2em',
            }}>
              Y axis = pitch · X axis = pan · speed = amplitude
            </div>
          </div>
        </div>
      )}

      {/* Floating toolbar — bottom center */}
      <div style={{
        position:       'absolute',
        bottom:         '24px',
        left:           '50%',
        transform:      'translateX(-50%)',
        zIndex:         20,
      }}>
        <Toolbar
          mode={mode}
          scale={scale}
          reverbWet={reverbWet}
          onMode={setMode}
          onScale={setScale}
          onReverb={setReverbWet}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
