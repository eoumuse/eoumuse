import * as THREE from 'three'
import type { AttractorEngine } from '../audio/AttractorEngine'

/**
 * Renders the live attractor trajectory as a glowing neon line.
 * Two layers: a crisp Line (1px, additive) for the path shape,
 * plus a Points layer for glow, plus a bright head sphere at the current tip.
 */
export class AttractorVisualizer {
  private lineGeom: THREE.BufferGeometry
  private linePosAttr: THREE.BufferAttribute
  private lineColorAttr: THREE.BufferAttribute
  private line: THREE.Line

  private glowGeom: THREE.BufferGeometry
  private glowPosAttr: THREE.BufferAttribute
  private glowColorAttr: THREE.BufferAttribute
  private glowPoints: THREE.Points

  private headMesh: THREE.Mesh
  private headLight: THREE.PointLight

  private scaleMap: Record<string, number> = {
    lorenz:  0.12,
    rossler: 0.22,
    thomas:  0.55,
  }

  constructor(scene: THREE.Scene, trailLength: number) {
    // ── Line path ──────────────────────────────────────────────────────────
    this.lineGeom = new THREE.BufferGeometry()
    const lPos = new Float32Array(trailLength * 3)
    const lCol = new Float32Array(trailLength * 3)
    this.linePosAttr   = new THREE.BufferAttribute(lPos, 3)
    this.lineColorAttr = new THREE.BufferAttribute(lCol, 3)
    this.lineGeom.setAttribute('position', this.linePosAttr)
    this.lineGeom.setAttribute('color',    this.lineColorAttr)
    this.lineGeom.setDrawRange(0, 0)

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.7,
    })
    this.line = new THREE.Line(this.lineGeom, lineMat)
    scene.add(this.line)

    // ── Glow points (subset — every 4th point to keep GPU load low) ────────
    const glowLen = Math.ceil(trailLength / 4)
    this.glowGeom = new THREE.BufferGeometry()
    const gPos = new Float32Array(glowLen * 3)
    const gCol = new Float32Array(glowLen * 3)
    this.glowPosAttr   = new THREE.BufferAttribute(gPos, 3)
    this.glowColorAttr = new THREE.BufferAttribute(gCol, 3)
    this.glowGeom.setAttribute('position', this.glowPosAttr)
    this.glowGeom.setAttribute('color',    this.glowColorAttr)
    this.glowGeom.setDrawRange(0, 0)

    const glowMat = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    })
    this.glowPoints = new THREE.Points(this.glowGeom, glowMat)
    scene.add(this.glowPoints)

    // ── Head: bright sphere at current attractor tip ───────────────────────
    const headGeo = new THREE.SphereGeometry(0.08, 12, 12)
    const headMat = new THREE.MeshBasicMaterial({
      color: 0xffd840,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    })
    this.headMesh = new THREE.Mesh(headGeo, headMat)
    scene.add(this.headMesh)

    this.headLight = new THREE.PointLight(0xffd840, 2.0, 2.0)
    scene.add(this.headLight)
  }

  update(engine: AttractorEngine, loopStart = 0, loopEnd = 1, loopEnabled = false) {
    const trail  = engine.trail
    const len    = engine.trailLength
    const head   = engine.trailHead
    const filled = engine.trailFilled
    const count  = filled ? len : head
    const scale  = this.scaleMap[engine.params.type] ?? 0.12

    if (count === 0) return

    const lp = this.linePosAttr.array as Float32Array
    const lc = this.lineColorAttr.array as Float32Array
    const gp = this.glowPosAttr.array as Float32Array
    const gc = this.glowColorAttr.array as Float32Array

    let gi = 0
    for (let i = 0; i < count; i++) {
      const age = i / count   // 0=oldest, 1=newest
      const src = filled ? ((head + i) % len) * 3 : i * 3

      const px = trail[src]     * scale
      const py = trail[src + 1] * scale
      const pz = trail[src + 2] * scale

      lp[i * 3]     = px
      lp[i * 3 + 1] = py
      lp[i * 3 + 2] = pz

      // Is this trail point inside the loop zone?
      const nx     = engine.trailPointNx(trail[src])
      const inLoop = loopEnabled && nx >= loopStart && nx <= loopEnd

      // Gradient: dark amber → ochre(0.82,0.57,0.12) → bright gold(1,0.87,0.22)
      let r: number, g: number, b: number
      if (age < 0.6) {
        const t = age / 0.6
        r = 0.45 + t * 0.37
        g = 0.28 + t * 0.29
        b = 0.04 + t * 0.08
      } else {
        const t = (age - 0.6) / 0.4
        r = 0.82 + t * 0.18
        g = 0.57 + t * 0.30
        b = 0.12 + t * 0.10
      }

      if (loopEnabled && !inLoop) {
        // Outside loop: desaturate to dim gray
        const gray = (r + g + b) / 3 * 0.28
        r = gray; g = gray; b = gray
      }

      const fade   = Math.min(1, age * 4.0)
      const bright = (loopEnabled && inLoop) ? 1.6 : 1.0
      lc[i * 3]     = Math.min(1, r * fade * bright)
      lc[i * 3 + 1] = Math.min(1, g * fade * bright)
      lc[i * 3 + 2] = Math.min(1, b * fade * bright)

      // Glow layer: every 4th point
      if (i % 4 === 0) {
        gp[gi * 3]     = px
        gp[gi * 3 + 1] = py
        gp[gi * 3 + 2] = pz
        gc[gi * 3]     = lc[i * 3]
        gc[gi * 3 + 1] = lc[i * 3 + 1]
        gc[gi * 3 + 2] = lc[i * 3 + 2]
        gi++
      }
    }

    this.linePosAttr.needsUpdate   = true
    this.lineColorAttr.needsUpdate = true
    this.lineGeom.setDrawRange(0, count)

    this.glowPosAttr.needsUpdate   = true
    this.glowColorAttr.needsUpdate = true
    this.glowGeom.setDrawRange(0, gi)

    // Head sphere at newest point
    const hi = filled ? ((head - 1 + len) % len) * 3 : (head - 1) * 3
    if (hi >= 0) {
      const hx = trail[hi]     * scale
      const hy = trail[hi + 1] * scale
      const hz = trail[hi + 2] * scale
      this.headMesh.position.set(hx, hy, hz)
      this.headLight.position.set(hx, hy, hz)
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.line)
    scene.remove(this.glowPoints)
    scene.remove(this.headMesh)
    scene.remove(this.headLight)
    this.lineGeom.dispose()
    this.glowGeom.dispose()
  }
}
