import { useEffect, useRef } from 'react'
import * as THREE from 'three'
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
  const perturbRef     = useRef<THREE.Mesh | null>(null)
  const isPerturbingRef = useRef(false)

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

    // Perturbation cursor — glowing wireframe sphere at the drag target
    const perturbGeo = new THREE.SphereGeometry(0.18, 10, 10)
    const perturbMat = new THREE.MeshBasicMaterial({
      color: 0xffd840,
      wireframe: true,
      transparent: true,
      opacity: 0,
    })
    const perturbSphere = new THREE.Mesh(perturbGeo, perturbMat)
    sm.scene.add(perturbSphere)
    perturbRef.current = perturbSphere

    // ── Right-click drag = attractor perturbation ────────────────────────
    const getCanvasNorm = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        cx: (e.clientX - rect.left) / rect.width,
        cy: (e.clientY - rect.top)  / rect.height,
      }
    }

    const applyPerturb = (cx: number, cy: number) => {
      const eng = engineRef.current
      if (!eng) return
      const target = eng.canvasToAttractorCoords(cx, cy)
      eng.perturbTarget   = target
      eng.perturbStrength = 1

      // Show sphere at world-space position
      const s = eng.scaleForType()
      perturbSphere.position.set(target.x * s, target.y * s, target.z * s)
      ;(perturbSphere.material as THREE.MeshBasicMaterial).opacity = 0.7
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return  // only right-click
      e.preventDefault()
      isPerturbingRef.current = true
      canvas.setPointerCapture(e.pointerId)
      const { cx, cy } = getCanvasNorm(e)
      applyPerturb(cx, cy)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isPerturbingRef.current) return
      const { cx, cy } = getCanvasNorm(e)
      applyPerturb(cx, cy)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 2) return
      isPerturbingRef.current = false
      const eng = engineRef.current
      if (eng) eng.perturbStrength = 0
      ;(perturbSphere.material as THREE.MeshBasicMaterial).opacity = 0
    }

    const onContextMenu = (e: Event) => e.preventDefault()

    canvas.addEventListener('pointerdown',  onPointerDown)
    canvas.addEventListener('pointermove',  onPointerMove)
    canvas.addEventListener('pointerup',    onPointerUp)
    canvas.addEventListener('contextmenu',  onContextMenu)

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
      canvas.removeEventListener('pointerdown',  onPointerDown)
      canvas.removeEventListener('pointermove',  onPointerMove)
      canvas.removeEventListener('pointerup',    onPointerUp)
      canvas.removeEventListener('contextmenu',  onContextMenu)
      sm.dispose()
      bg.dispose()
      nodeMesh.dispose()
      agent.dispose()
      perturbGeo.dispose()
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
    <div style={{ position: 'absolute', inset: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {/* Hint overlay */}
      <div style={{
        position: 'absolute', bottom: 10, right: 12,
        fontSize: '9px', letterSpacing: '0.08em',
        color: 'rgba(200,160,50,0.45)',
        pointerEvents: 'none', userSelect: 'none',
        textTransform: 'uppercase',
      }}>
        Left drag: orbit　·　Right drag: distort　·　Scroll: zoom
      </div>
    </div>
  )
}
