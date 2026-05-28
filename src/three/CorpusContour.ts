import * as THREE from 'three'
import type { AudioNode3D } from '../store/synthStore'

/**
 * Draws smooth CatmullRom curves through audio onset nodes —
 * creating an Incline-style topographic "corpus map" in 3D space.
 */
export class CorpusContour {
  private group = new THREE.Group()

  constructor(scene: THREE.Scene) {
    scene.add(this.group)
  }

  update(nodes: AudioNode3D[]) {
    // Clear previous curves
    const children = this.group.children.slice()
    for (const c of children) {
      this.group.remove(c)
      const line = c as THREE.Line
      line.geometry?.dispose()
      ;(line.material as THREE.Material)?.dispose()
    }

    if (nodes.length < 3) return

    const sorted = [...nodes].sort((a, b) => a.time - b.time)

    const addCurve = (
      pts: THREE.Vector3[],
      color: number,
      opacity: number,
      resolution: number,
    ) => {
      if (pts.length < 2) return
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
      const cp    = curve.getPoints(Math.max(pts.length * resolution, 120))
      const geo   = new THREE.BufferGeometry().setFromPoints(cp)
      const mat   = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      this.group.add(new THREE.Line(geo, mat))
    }

    // Main corpus path through all nodes (time-ordered)
    const main = sorted.map(n => new THREE.Vector3(n.x, n.y, n.z))
    addCurve(main, 0x5a4820, 0.65, 5)

    // Topographic offset layers (Incline-style depth)
    for (const [dy, dz, col, op] of [
      [ 0.35, 0.2, 0x3a2e10, 0.28] as const,
      [-0.35, 0.2, 0x3a2e10, 0.28] as const,
      [ 0.7,  0.0, 0x251e08, 0.14] as const,
      [-0.7,  0.0, 0x251e08, 0.14] as const,
    ]) {
      const pts = sorted.map(n => new THREE.Vector3(n.x, n.y + dy, n.z + dz))
      addCurve(pts, col, op, 3)
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
  }
}
