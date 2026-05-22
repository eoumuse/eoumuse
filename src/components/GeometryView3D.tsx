import { useEffect, useRef } from 'react'
import { useSynthStore } from '../store/synthStore'
import { SceneManager } from '../three/SceneManager'
import { AttractorParticles } from '../three/AttractorParticles'
import { AttractorVisualizer } from '../three/AttractorVisualizer'
import { NodeMesh } from '../three/NodeMesh'
import { AgentSphere } from '../three/AgentSphere'
import { AttractorEngine } from '../audio/AttractorEngine'
import { audioEngine } from '../audio/AudioEngine'

export function GeometryView3D() {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const sceneRef       = useRef<SceneManager | null>(null)
  const bgRef          = useRef<AttractorParticles | null>(null)
  const liveVisRef     = useRef<AttractorVisualizer | null>(null)
  const nodeMeshRef    = useRef<NodeMesh | null>(null)
  const agentRef       = useRef<AgentSphere | null>(null)
  const engineRef      = useRef<AttractorEngine | null>(null)
  const lastTickRef    = useRef<number>(performance.now())

  const nodes            = useSynthStore((s) => s.nodes)
  const currentNodeIndex = useSynthStore((s) => s.currentNodeIndex)
  const isPlaying        = useSynthStore((s) => s.isPlaying)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sm = new SceneManager(canvas)
    sceneRef.current = sm

    // Faint static Lorenz cloud in the background — depth/context reference
    const bg = new AttractorParticles(2000)
    sm.scene.add(bg.points)
    bgRef.current = bg

    // Live attractor engine — this IS the synthesis engine
    const engine = new AttractorEngine('lorenz')
    engineRef.current = engine

    // Live trajectory line — shows the attractor's shape as it evolves
    const liveVis = new AttractorVisualizer(sm.scene, engine.trailLength)
    liveVisRef.current = liveVis

    const nodeMesh = new NodeMesh()
    nodeMeshRef.current = nodeMesh

    const agent = new AgentSphere()
    sm.scene.add(agent.group)
    agentRef.current = agent

    sm.startAnimation((time) => {
      const now = performance.now()
      const dt = Math.min(now - lastTickRef.current, 50)
      lastTickRef.current = now

      const eng = engineRef.current
      if (eng) {
        const store = useSynthStore.getState()

        // Sync attractor type (reset if changed)
        if (eng.params.type !== store.attractorType) {
          eng.setType(store.attractorType)
        }

        // Sync parameters from store to engine
        eng.params.p1    = store.attractorP1
        eng.params.p2    = store.attractorP2
        eng.params.p3    = store.attractorP3
        eng.params.speed = store.attractorSpeed

        eng.tick(dt)

        // Push normalized attractor state back to store (for XYZ readout panel)
        store.setAttractorState(eng.state.nx, eng.state.ny, eng.state.nz, eng.state.vortexPitch)

        // === CORE: when linked, attractor coordinates drive the grain engine ===
        if (store.attractorLinked && store.isPlaying) {
          audioEngine.position  = eng.state.nx             // x → buffer position 0..1
          audioEngine.pitch     = eng.state.vortexPitch    // vortex orbital angle → pitch
          audioEngine.grainSize = 10 + eng.state.nz * 1990 // z → 10..2000ms
        }

        // Sync vortex pitch settings from store to engine
        eng.semitonesPerOrbit = store.semitonesPerOrbit
        eng.pitchWrap         = store.pitchWrap

        // Move agent orb to follow the live attractor position in 3D space
        const s = eng.scaleForType()
        agent.setTargetPosition(
          eng.state.x * s,
          eng.state.y * s,
          eng.state.z * s,
        )

        liveVis.update(eng)
      }

      bg.update(time)
      agent.update(time)
    })

    const handleResize = () => sm.resize(canvas.clientWidth, canvas.clientHeight)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      sm.dispose()
      bg.dispose()
      nodeMesh.dispose()
      agent.dispose()
    }
  }, [])

  // Update audio onset node sparkles when a new file is loaded
  useEffect(() => {
    const sm       = sceneRef.current
    const nodeMesh = nodeMeshRef.current
    if (!sm || !nodeMesh) return
    nodeMesh.updateNodes(nodes, sm.scene, currentNodeIndex)
  }, [nodes, currentNodeIndex])

  // When not linked to attractor, advance through onset nodes sequentially
  useEffect(() => {
    const store = useSynthStore.getState()
    if (!isPlaying || nodes.length === 0 || store.attractorLinked) return

    const interval = setInterval(() => {
      const s = useSynthStore.getState()
      if (s.attractorLinked) return
      const nextIdx = (s.currentNodeIndex + 1) % nodes.length
      s.setCurrentNode(nextIdx)
      const node = nodes[nextIdx]
      if (node && audioEngine.buffer) {
        audioEngine.position = node.time / audioEngine.buffer.duration
      }
    }, 700)

    return () => clearInterval(interval)
  }, [isPlaying, nodes])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  )
}
