import * as THREE from 'three'
import type { AttractorEngine } from '../audio/AttractorEngine'

/**
 * Renders the attractor trail as a glowing neon line/particle system.
 * Uses additive blending so overlapping paths bloom like neon tubes.
 */
export class AttractorVisualizer {
  private points: THREE.Points
  private geometry: THREE.BufferGeometry
  private posAttr: THREE.BufferAttribute
  private colorAttr: THREE.BufferAttribute
  private scaleUniform: THREE.IUniform<number>

  // Scale factor to map raw attractor coords into ~[-3,3] scene space
  private scaleMap: Record<string, number> = {
    lorenz: 0.12,
    rossler: 0.22,
    thomas: 0.55,
  }

  constructor(scene: THREE.Scene, trailLength: number) {
    this.geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(trailLength * 3)
    const colors    = new Float32Array(trailLength * 3)

    this.posAttr   = new THREE.BufferAttribute(positions, 3)
    this.colorAttr = new THREE.BufferAttribute(colors, 3)
    this.geometry.setAttribute('position', this.posAttr)
    this.geometry.setAttribute('color',    this.colorAttr)
    this.geometry.setDrawRange(0, 0)

    this.scaleUniform = { value: 0.12 }

    const material = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geometry, material)
    scene.add(this.points)
  }

  update(engine: AttractorEngine) {
    const trail  = engine.trail
    const len    = engine.trailLength
    const head   = engine.trailHead
    const filled = engine.trailFilled
    const count  = filled ? len : head
    const scale  = this.scaleMap[engine.params.type] ?? 0.12
    this.scaleUniform.value = scale

    // reorder trail so newest point is last
    const pos = this.posAttr.array as Float32Array
    const col = this.colorAttr.array as Float32Array

    for (let i = 0; i < count; i++) {
      // age: 0=oldest, 1=newest
      const age = i / count
      const src = filled
        ? ((head + i) % len) * 3
        : i * 3

      pos[i * 3]     = trail[src]     * scale
      pos[i * 3 + 1] = trail[src + 1] * scale
      pos[i * 3 + 2] = trail[src + 2] * scale

      // Color: pink → yellow → light gray along path age
      if (age < 0.5) {
        const t = age / 0.5
        // pink(1,0.18,0.61) → yellow(1,0.9,0.16)
        col[i * 3]     = 1.0
        col[i * 3 + 1] = 0.18 + t * 0.72
        col[i * 3 + 2] = 0.61 - t * 0.45
      } else {
        const t = (age - 0.5) / 0.5
        // yellow(1,0.9,0.16) → light gray(0.75,0.75,0.8)
        col[i * 3]     = 1.0  - t * 0.25
        col[i * 3 + 1] = 0.9  - t * 0.15
        col[i * 3 + 2] = 0.16 + t * 0.64
      }
      // fade out oldest 20%
      const fade = Math.min(1, age * 5)
      col[i * 3]     *= fade
      col[i * 3 + 1] *= fade
      col[i * 3 + 2] *= fade
    }

    this.posAttr.needsUpdate   = true
    this.colorAttr.needsUpdate = true
    this.geometry.setDrawRange(0, count)
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.points)
    this.geometry.dispose()
  }
}
