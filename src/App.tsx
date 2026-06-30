import { useEffect } from 'react'
import { GeometryView3D } from './components/GeometryView3D'
import { DropZone } from './components/DropZone'
import { AgentPanel } from './components/AgentPanel'
import { AttractorPanel } from './components/AttractorPanel'
import { TransportBar } from './components/TransportBar'
import { WavePreview } from './components/WavePreview'
import { EffectsPanel } from './components/EffectsPanel'
import { HarmonizerPanel } from './components/HarmonizerPanel'
import { DrawingCanvas, DrawModeBar } from './components/DrawingCanvas'
import { useSynthStore } from './store/synthStore'
import type { DrawMode } from './store/synthStore'

function App() {
  const setDrawMode    = useSynthStore(s => s.setDrawMode)
  const setDrawEnabled = useSynthStore(s => s.setDrawEnabled)
  const drawEnabled    = useSynthStore(s => s.drawEnabled)

  // Keyboard shortcuts: F=fm, P=pad, G=grain, X=glitch, D=toggle draw
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const map: Record<string, DrawMode> = { f: 'fm', p: 'pad', g: 'grain', x: 'glitch' }
      if (map[e.key]) { setDrawMode(map[e.key]); setDrawEnabled(true) }
      if (e.key === 'd') setDrawEnabled(!drawEnabled)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawEnabled, setDrawMode, setDrawEnabled])

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#28282F',
    }}>
      {/* Layer 0: 3D background */}
      <GeometryView3D />

      {/* Layer 1: Drawing canvas (pointer-events in center, UI panels block from above) */}
      <DrawingCanvas />

      {/* Layer 2: UI Overlay — pointer-events: none on container, auto on panels */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        gap: '10px',
        zIndex: 10,
      }}>
        {/* Header */}
        <header style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="sparkle" style={{ color: '#FF2D9B', fontSize: '20px' }}>✦</span>
            <h1 style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: '900',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              background: 'linear-gradient(90deg, #FF2D9B, #888899, #FFE629)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 12px #888899)',
            }}>
              GrainWeaver
            </h1>
            <span className="sparkle" style={{ color: '#FFE629', fontSize: '16px', animationDelay: '0.7s' }}>✧</span>
          </div>
          <div style={{
            fontSize: '9px',
            fontWeight: '700',
            letterSpacing: '0.15em',
            color: 'rgba(136, 136, 153, 0.5)',
            textTransform: 'uppercase',
          }}>
            Draw · Sound
          </div>
        </header>

        {/* Main content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          gap: '10px',
          alignItems: 'flex-start',
        }}>
          {/* Left column — blocks draw canvas below */}
          <div style={{
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '260px',
            flexShrink: 0,
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 120px)',
            paddingRight: '2px',
          }}>
            <DropZone />
            <WavePreview />
            <EffectsPanel />
            <HarmonizerPanel />
            <AttractorPanel />
            <AgentPanel />
          </div>

          {/* Center — draw canvas is active here (no pointer-events from this div) */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: '8px',
            pointerEvents: 'none',
            height: '100%',
          }}>
            {/* Mode toolbar floats at bottom-center */}
            <div style={{ pointerEvents: 'auto' }}>
              <DrawModeBar />
            </div>
          </div>

          {/* Right column */}
          <div style={{
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '180px',
            flexShrink: 0,
          }}>
            <InfoPanel />
          </div>
        </div>

        {/* Bottom transport bar */}
        <div style={{ pointerEvents: 'auto', width: '260px' }}>
          <TransportBar />
        </div>
      </div>
    </div>
  )
}

function InfoPanel() {
  return (
    <div className="panel" style={{ padding: '0' }}>
      <div className="panel-header">
        <span className="sparkle">✦</span> INFO <span className="sparkle" style={{ animationDelay: '1.2s' }}>★</span>
      </div>
      <div style={{ padding: '12px', fontSize: '10px', color: 'rgba(136, 136, 153, 0.7)', lineHeight: '1.6' }}>
        <div style={{ marginBottom: '8px', color: '#FFE629', fontWeight: '700', letterSpacing: '0.1em' }}>
          DRAW → SOUND
        </div>
        <div style={{ color: 'rgba(255,240,255,0.5)', marginBottom: '8px' }}>
          Draw in the center to generate sound. X = pitch · Y = octave
        </div>

        <div style={{ marginBottom: '4px', color: '#00E5FF', fontWeight: '600' }}>FM</div>
        <div style={{ color: 'rgba(255,240,255,0.4)', fontSize: '9px', marginBottom: '6px' }}>
          2-operator FM synthesis — OPN metallic textures
        </div>

        <div style={{ marginBottom: '4px', color: '#FF6EC7', fontWeight: '600' }}>PAD</div>
        <div style={{ color: 'rgba(255,240,255,0.4)', fontSize: '9px', marginBottom: '6px' }}>
          Slow attack pads — iku sakan shimmer
        </div>

        <div style={{ marginBottom: '4px', color: '#FFD700', fontWeight: '600' }}>GRAIN</div>
        <div style={{ color: 'rgba(255,240,255,0.4)', fontSize: '9px', marginBottom: '6px' }}>
          Granular from loaded sample
        </div>

        <div style={{ marginBottom: '4px', color: '#FF4444', fontWeight: '600' }}>GLITCH</div>
        <div style={{ color: 'rgba(255,240,255,0.4)', fontSize: '9px', marginBottom: '10px' }}>
          Stutter + bitcrush — IDM noise
        </div>

        <div style={{
          padding: '6px 8px',
          borderRadius: '6px',
          background: 'rgba(255,45,155,0.06)',
          border: '1px solid rgba(255,45,155,0.2)',
          color: 'rgba(255,240,255,0.4)',
          fontSize: '9px',
          letterSpacing: '0.05em',
        }}>
          Keys: F P G X = modes · D = toggle draw
        </div>

        <div style={{ marginTop: '12px', color: '#FFE629', fontWeight: '700', letterSpacing: '0.1em' }}>
          LORENZ ATTRACTOR
        </div>
        <div style={{ color: 'rgba(255,240,255,0.5)', marginTop: '4px' }}>
          σ = 10 · ρ = 28 · β = 8/3
        </div>
        <div style={{ marginTop: '4px', color: '#FF2D9B', fontWeight: '600', fontSize: '9px' }}>
          dx/dt = σ(y−x)
        </div>
        <div style={{ color: '#888899', fontWeight: '600', fontSize: '9px' }}>
          dy/dt = x(ρ−z)−y
        </div>
        <div style={{ color: '#FFE629', fontWeight: '600', fontSize: '9px' }}>
          dz/dt = xy − βz
        </div>
      </div>
    </div>
  )
}

export default App
