import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useSynthStore } from '../store/synthStore'
import { SceneManager } from '../three/SceneManager'
import { AttractorParticles } from '../three/AttractorParticles'
import { AttractorVisualizer } from '../three/AttractorVisualizer'
import { CorpusContour } from '../three/CorpusContour'
import { LoopPlaneVis } from '../three/LoopPlaneVis'
import { NodeMesh } from '../three/NodeMesh'
import { AgentSphere } from '../three/AgentSphere'
import { AttractorEngine } from '../audio/AttractorEngine'
import { audioEngine } from '../audio/AudioEngine'

// Project mouse (0..1) onto plane perpendicular to camera through world center
function projectMouseTo3D(
  cx: number, cy: number,
  camera: THREE.PerspectiveCamera,
  center: THREE.Vector3,
): THREE.Vector3 | null {
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(cx * 2 - 1, -(cy * 2 - 1)), camera)
  const camDir = camera.getWorldDirection(new THREE.Vector3())
  const plane  = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, center)
  const hit    = new THREE.Vector3()
  return raycaster.ray.intersectPlane(plane, hit) ? hit : null
}

type DragMode = 'perturb' | 'loopStart' | 'loopEnd'

export function GeometryView3D() {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const sceneRef       = useRef<SceneManager | null>(null)
  const bgRef          = useRef<AttractorParticles | null>(null)
  const liveVisRef     = useRef<AttractorVisualizer | null>(null)
  const corpusRef      = useRef<CorpusContour | null>(null)
  const loopVisRef     = useRef<LoopPlaneVis | null>(null)
  const nodeMeshRef    = useRef<NodeMesh | null>(null)
  const agentRef       = useRef<AgentSphere | null>(null)
  const engineRef      = useRef<AttractorEngine | null>(null)
  const lastTickRef    = useRef<number>(performance.now())

  // Interaction state
  const mousePosRef    = useRef({ cx: 0.5, cy: 0.5 })
  const isOverRef      = useRef(false)
  const isGrabbingRef  = useRef(false)
  const dragModeRef    = useRef<DragMode>('perturb')
  const perturbSphRef  = useRef<THREE.Mesh | null>(null)
  const connLineRef    = useRef<THREE.Line | null>(null)
  const connPosRef     = useRef<THREE.BufferAttribute | null>(null)

  const nodes            = useSynthStore((s) => s.nodes)
  const currentNodeIndex = useSynthStore((s) => s.currentNodeIndex)
  const isPlaying        = useSynthStore((s) => s.isPlaying)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sm = new SceneManager(canvas)
    sceneRef.current = sm

    const bg = new AttractorParticles(2000)
    sm.scene.add(bg.points)
    bgRef.current = bg

    const engine = new AttractorEngine('lorenz')
    engineRef.current = engine

    const liveVis = new AttractorVisualizer(sm.scene, engine.trailLength)
    liveVisRef.current = liveVis

    const corpus = new CorpusContour(sm.scene)
    corpusRef.current = corpus

    const loopVis = new LoopPlaneVis(sm.scene)
    loopVisRef.current = loopVis

    const nodeMesh = new NodeMesh()
    nodeMeshRef.current = nodeMesh

    const agent = new AgentSphere()
    sm.scene.add(agent.group)
    agentRef.current = agent

    // Perturbation cursor sphere
    const perturbGeo = new THREE.SphereGeometry(0.14, 10, 10)
    const perturbMat = new THREE.MeshBasicMaterial({
      color: 0x7ec8ff, wireframe: true, transparent: true, opacity: 0,
    })
    const perturbSph = new THREE.Mesh(perturbGeo, perturbMat)
    sm.scene.add(perturbSph)
    perturbSphRef.current = perturbSph

    // Connection line: attractor head ↔ mouse target
    const connGeo = new THREE.BufferGeometry()
    const connPos = new THREE.BufferAttribute(new Float32Array(6), 3)
    connGeo.setAttribute('position', connPos)
    connPosRef.current = connPos
    const connMat = new THREE.LineBasicMaterial({
      color: 0xc9a8ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const connLine = new THREE.Line(connGeo, connMat)
    sm.scene.add(connLine)
    connLineRef.current = connLine

    // ── Mouse handlers ────────────────────────────────────────────────────
    const norm = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      return { cx: (e.clientX - r.left) / r.width, cy: (e.clientY - r.top) / r.height }
    }

    let lastClickTime = 0
    let clickStartPos = { x: 0, y: 0 }

    const onMove    = (e: MouseEvent) => { mousePosRef.current = norm(e) }
    const onEnter   = () => { isOverRef.current = true }
    const onLeave   = () => {
      isOverRef.current = false; isGrabbingRef.current = false
      const eng = engineRef.current
      if (eng) eng.perturbStrength = 0
      ;(perturbSph.material as THREE.MeshBasicMaterial).opacity = 0
      ;(connLine.material  as THREE.LineBasicMaterial ).opacity = 0
    }
    const onDown    = (e: MouseEvent) => {
      if (e.button !== 0) return
      isGrabbingRef.current = true
      clickStartPos = { x: e.clientX, y: e.clientY }
    }
    const onUp      = (e: MouseEvent) => { if (e.button === 0) isGrabbingRef.current = false }
    const onClick   = (e: MouseEvent) => {
      const now = Date.now()
      const dx = e.clientX - clickStartPos.x, dy = e.clientY - clickStartPos.y
      if (Math.sqrt(dx*dx + dy*dy) < 6 && now - lastClickTime < 380) {
        engineRef.current?.kickChaos()
        ;(perturbSph.material as THREE.MeshBasicMaterial).opacity = 1
        setTimeout(() => {
          ;(perturbSph.material as THREE.MeshBasicMaterial).opacity = isOverRef.current ? 0.28 : 0
        }, 200)
      }
      lastClickTime = now
    }
    const noCtx = (e: Event) => e.preventDefault()

    canvas.addEventListener('mousemove',   onMove)
    canvas.addEventListener('mouseenter',  onEnter)
    canvas.addEventListener('mouseleave',  onLeave)
    canvas.addEventListener('mousedown',   onDown)
    canvas.addEventListener('mouseup',     onUp)
    canvas.addEventListener('click',       onClick)
    canvas.addEventListener('contextmenu', noCtx)

    // ── Animation loop ────────────────────────────────────────────────────
    const attractorCenter = new THREE.Vector3(0, 0, 2)
    const LOOP_SNAP_DIST  = 0.4   // world units — snap to loop plane within this distance

    sm.startAnimation((time) => {
      const now = performance.now()
      const dt  = Math.min(now - lastTickRef.current, 50)
      lastTickRef.current = now

      const eng = engineRef.current
      if (eng) {
        const store = useSynthStore.getState()

        if (eng.params.type !== store.attractorType) eng.setType(store.attractorType)
        eng.params.p1         = store.attractorP1
        eng.params.p2         = store.attractorP2
        eng.params.p3         = store.attractorP3
        eng.params.speed      = store.attractorSpeed
        eng.semitonesPerOrbit = store.semitonesPerOrbit
        eng.pitchWrap         = store.pitchWrap

        // Mouse → 3D hit point
        const isOver  = isOverRef.current
        const isGrab  = isGrabbingRef.current
        const { cx, cy } = mousePosRef.current
        const hit = isOver ? projectMouseTo3D(cx, cy, sm.camera, attractorCenter) : null

        // Determine drag mode based on proximity to loop planes
        if (hit && store.loopEnabled) {
          const startX = eng.nxToWorldX(store.loopStart)
          const endX   = eng.nxToWorldX(store.loopEnd)
          const ds     = Math.abs(hit.x - startX)
          const de     = Math.abs(hit.x - endX)

          if (!isGrab) {
            // Update drag mode only when not currently dragging
            if (ds < LOOP_SNAP_DIST && ds < de) dragModeRef.current = 'loopStart'
            else if (de < LOOP_SNAP_DIST)        dragModeRef.current = 'loopEnd'
            else                                  dragModeRef.current = 'perturb'
          }
        } else if (!isGrab) {
          dragModeRef.current = 'perturb'
        }

        // Update canvas cursor
        const wantCursor = (dragModeRef.current !== 'perturb') ? 'ew-resize' : 'crosshair'
        if (canvas.style.cursor !== wantCursor) canvas.style.cursor = wantCursor

        if (hit) {
          const s = eng.scaleForType()

          if (isGrab && dragModeRef.current !== 'perturb') {
            // ── Loop plane drag ──────────────────────────────────────────
            const nx = eng.nxFromWorldX(hit.x)
            if (dragModeRef.current === 'loopStart') {
              store.setLoopStart(Math.max(0, Math.min(nx, store.loopEnd - 0.02)))
            } else {
              store.setLoopEnd(Math.max(store.loopStart + 0.02, Math.min(nx, 1)))
            }
            eng.perturbStrength = 0
            ;(perturbSph.material as THREE.MeshBasicMaterial).opacity = 0
            ;(connLine.material  as THREE.LineBasicMaterial ).opacity = 0
          } else {
            // ── Attractor perturbation ───────────────────────────────────
            eng.perturbTarget   = { x: hit.x / s, y: hit.y / s, z: hit.z / s }
            eng.perturbStrength = isGrab ? 1.2 : 0

            perturbSph.position.copy(hit)
            ;(perturbSph.material as THREE.MeshBasicMaterial).opacity = isGrab ? 0.85 : 0

            const cp = connPosRef.current!
            cp.setXYZ(0, eng.state.x * s, eng.state.y * s, eng.state.z * s)
            cp.setXYZ(1, hit.x, hit.y, hit.z)
            cp.needsUpdate = true
            ;(connLine.material as THREE.LineBasicMaterial).opacity = isGrab ? 0.55 : 0
          }
        } else {
          eng.perturbStrength = 0
          ;(perturbSph.material as THREE.MeshBasicMaterial).opacity = 0
          ;(connLine.material  as THREE.LineBasicMaterial ).opacity = 0
        }

        eng.tick(dt)

        store.setAttractorState(eng.state.nx, eng.state.ny, eng.state.nz, eng.state.vortexPitch)

        if (store.attractorLinked && store.isPlaying) {
          const pos = store.loopEnabled
            ? store.loopStart + eng.state.nx * (store.loopEnd - store.loopStart)
            : eng.state.nx
          // Smooth the position instead of snapping — the chaotic attractor's nx
          // can leap between lobes frame-to-frame, which otherwise reads as the
          // grain source jumping to silence/edge material mid-loop.
          audioEngine.position  += (pos - audioEngine.position) * 0.15
          audioEngine.pitch     = eng.state.vortexPitch
          audioEngine.grainSize = 10 + eng.state.nz * 1990
        }

        const s = eng.scaleForType()
        agent.setTargetPosition(eng.state.x * s, eng.state.y * s, eng.state.z * s)
        agent.setScatter(store.scatter)

        liveVis.update(eng, store.loopStart, store.loopEnd, store.loopEnabled)
        loopVis.update(eng, store.loopStart, store.loopEnd, store.loopEnabled)
      }

      bg.update(time)
      agent.update(time)
    })

    const onResize = () => sm.resize(canvas.clientWidth, canvas.clientHeight)
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('mousemove',   onMove)
      canvas.removeEventListener('mouseenter',  onEnter)
      canvas.removeEventListener('mouseleave',  onLeave)
      canvas.removeEventListener('mousedown',   onDown)
      canvas.removeEventListener('mouseup',     onUp)
      canvas.removeEventListener('click',       onClick)
      canvas.removeEventListener('contextmenu', noCtx)
      sm.dispose()
      bg.dispose()
      nodeMesh.dispose()
      agent.dispose()
      perturbGeo.dispose()
      connGeo.dispose()
    }
  }, [])

  // Update corpus contour when nodes change
  useEffect(() => {
    const sm     = sceneRef.current
    const nm     = nodeMeshRef.current
    const corpus = corpusRef.current
    if (!sm || !nm) return
    nm.updateNodes(nodes, sm.scene, currentNodeIndex)
    corpus?.update(nodes)
  }, [nodes, currentNodeIndex])

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
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
      />
      <div style={{
        position: 'absolute', bottom: 10, right: 12,
        fontSize: '9px', letterSpacing: '0.08em',
        color: 'rgba(200,160,50,0.38)',
        pointerEvents: 'none', userSelect: 'none',
        textTransform: 'uppercase', lineHeight: '1.8', textAlign: 'right',
      }}>
        Drag: pull attractor　·　Near loop plane: drag to move<br />
        Right drag: orbit　·　Double-click: chaos　·　Scroll: zoom
      </div>
    </div>
  )
}
