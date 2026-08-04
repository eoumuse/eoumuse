import * as THREE from 'three'
import type { AttractorEngine } from '../audio/AttractorEngine'

/**
 * Two glowing planes in 3D space marking loop start (pink) and loop end (yellow).
 * The zone between them glows faintly so the loop region is obvious at any camera angle.
 * Trail points inside the loop region are brightest; outside are dimmed.
 */
export class LoopPlaneVis {
  private group: THREE.Group

  private startFill: THREE.Mesh
  private startEdge: THREE.LineSegments
  private endFill:   THREE.Mesh
  private endEdge:   THREE.LineSegments
  private zoneSlab:  THREE.Mesh

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group()

    // Shared plane geometry, oriented perpendicular to world X axis
    const makeEdgePlane = (color: number) => {
      const geo = new THREE.PlaneGeometry(18, 18)
      geo.rotateY(Math.PI / 2)       // face along X

      const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.055,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }))
      fill.position.set(0, 0, 1)

      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      edge.position.set(0, 0, 1)

      return { fill, edge }
    }

    const start = makeEdgePlane(0xff9ac8)   // pink = loop IN
    const end   = makeEdgePlane(0xffb37c)   // peach = loop OUT
    this.startFill = start.fill
    this.startEdge = start.edge
    this.endFill   = end.fill
    this.endEdge   = end.edge

    // Zone slab: a thin box spanning the loop region (scale.x set each frame)
    const slabGeo = new THREE.BoxGeometry(1, 18, 14)
    this.zoneSlab = new THREE.Mesh(slabGeo, new THREE.MeshBasicMaterial({
      color: 0xc9a8ff,
      transparent: true,
      opacity: 0.022,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }))
    this.zoneSlab.position.set(0, 0, 1)

    this.group.add(this.startFill, this.startEdge)
    this.group.add(this.endFill,   this.endEdge)
    this.group.add(this.zoneSlab)
    scene.add(this.group)
  }

  update(engine: AttractorEngine, loopStart: number, loopEnd: number, enabled: boolean) {
    this.group.visible = enabled
    if (!enabled) return

    const sx = engine.nxToWorldX(loopStart)
    const ex = engine.nxToWorldX(loopEnd)

    this.startFill.position.x = sx
    this.startEdge.position.x = sx
    this.endFill.position.x   = ex
    this.endEdge.position.x   = ex

    const center = (sx + ex) / 2
    const width  = Math.abs(ex - sx)
    this.zoneSlab.position.x = center
    this.zoneSlab.scale.x    = Math.max(0.01, width)
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
  }
}
