import { lazy, Suspense, useEffect, useState } from 'react'
import { DropZone } from './components/DropZone'
import { AgentPanel } from './components/AgentPanel'
import { AttractorPanel } from './components/AttractorPanel'
import { TransportBar } from './components/TransportBar'
import { WavePreview } from './components/WavePreview'
import { EffectsPanel } from './components/EffectsPanel'
import { HarmonizerPanel } from './components/HarmonizerPanel'

const GeometryView3D = lazy(() =>
  import('./components/GeometryView3D').then((module) => ({ default: module.GeometryView3D })),
)

function App() {
  const [show3D, setShow3D] = useState(false)

  useEffect(() => {
    // Let the controls become interactive before loading Three.js and starting WebGL.
    const timerId = window.setTimeout(() => setShow3D(true), 120)
    return () => window.clearTimeout(timerId)
  }, [])

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#28282F',
    }}>
      {/* Full screen 3D background */}
      {show3D && (
        <Suspense fallback={null}>
          <GeometryView3D />
        </Suspense>
      )}

      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        gap: '10px',
      }}>
        {/* Header */}
        <header style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
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
            Granular Synthesizer
          </div>
        </header>

        {/* Main content area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          gap: '10px',
          alignItems: 'flex-start',
        }}>
          {/* Left column */}
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

          {/* Center spacer — 3D view shows through */}
          <div style={{ flex: 1 }} />

          {/* Right column: info overlay */}
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
        <div style={{
          pointerEvents: 'auto',
          width: '260px',
        }}>
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
          LORENZ ATTRACTOR
        </div>
        <div style={{ color: 'rgba(255,240,255,0.5)' }}>
          σ = 10 · ρ = 28 · β = 8/3
        </div>
        <div style={{ marginTop: '8px', color: '#FF2D9B', fontWeight: '600' }}>
          dx/dt = σ(y−x)
        </div>
        <div style={{ color: '#888899', fontWeight: '600' }}>
          dy/dt = x(ρ−z)−y
        </div>
        <div style={{ color: '#FFE629', fontWeight: '600' }}>
          dz/dt = xy − βz
        </div>
        <div style={{
          marginTop: '12px',
          padding: '8px',
          borderRadius: '8px',
          background: 'rgba(255, 45, 155, 0.06)',
          border: '1px solid rgba(255, 45, 155, 0.2)',
          color: 'rgba(255,240,255,0.5)',
          fontSize: '9px',
          letterSpacing: '0.05em',
        }}>
          Drop an audio sample to seed grain nodes. Hot pink sparkles = onset points. The agent orb traverses nodes in sync with playback.
        </div>

        <div style={{ marginTop: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '4px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF2D9B', boxShadow: '0 0 6px #FF2D9B' }} />
            <span style={{ color: 'rgba(255,240,255,0.6)', fontSize: '9px' }}>Pink — hot pink trail</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '4px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#888899', boxShadow: '0 0 6px #888899' }} />
            <span style={{ color: 'rgba(255,240,255,0.6)', fontSize: '9px' }}>Purple — attractor arms</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFE629', boxShadow: '0 0 6px #FFE629' }} />
            <span style={{ color: 'rgba(255,240,255,0.6)', fontSize: '9px' }}>Cyan — crossing paths</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
