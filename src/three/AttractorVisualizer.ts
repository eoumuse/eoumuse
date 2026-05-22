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

      // Color: pink → purple → cyan along path age
      if (age < 0.33) {
        const t = age / 0.33
        col[i * 3]     = 1   - t * 0.25    // R: 1→0.75
        col[i * 3 + 1] = t * 0.18          // G: 0→0.18
        col[i * 3 + 2] = t * 0.6           // B: 0→0.6
      } else if (age < 0.66) {
        const t = (age - 0.33) / 0.33
        col[i * 3]     = 0.75 - t * 0.62   // R: 0.75→0.13
        col[i * 3 + 1] = 0.18 + t * 0.72   // G: 0.18→0.9
        col[i * 3 + 2] = 0.6  + t * 0.4    // B: 0.6→1
      } else {
        const t = (age - 0.66) / 0.34
        col[i * 3]     = 0.13 * (1 - t)
        col[i * 3 + 1] = 0.9
        col[i * 3 + 2] = 1
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
