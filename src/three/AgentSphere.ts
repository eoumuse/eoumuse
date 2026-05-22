import * as THREE from 'three'
import type { AudioNode3D } from '../store/synthStore'

export class AgentSphere {
  group: THREE.Group
  private mesh: THREE.Mesh
  private light: THREE.PointLight
  private targetPos = new THREE.Vector3(0, 0, 0)

  constructor() {
    this.group = new THREE.Group()

    // Sphere geometry
    const geo = new THREE.SphereGeometry(0.12, 32, 32)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff2d9b,
      emissive: 0xff2d9b,
      emissiveIntensity: 3,
      roughness: 0.1,
      metalness: 0.8,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.group.add(this.mesh)

    // Inner glow core
    const coreGeo = new THREE.SphereGeometry(0.06, 16, 16)
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    this.group.add(core)

    // Outer glow ring
    const ringGeo = new THREE.SphereGeometry(0.22, 16, 16)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff2d9b,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    this.group.add(ring)

    // Point light for local glow
    this.light = new THREE.PointLight(0xff2d9b, 4, 3)
    this.group.add(this.light)
  }

  setTargetFromNode(node: AudioNode3D | undefined) {
    if (node) {
      this.targetPos.set(node.x, node.y, node.z)
    }
  }

  setTargetPosition(x: number, y: number, z: number) {
    this.targetPos.set(x, y, z)
  }

  update(time: number) {
    // Lerp toward target
    this.group.position.lerp(this.targetPos, 0.03)

    // Pulse scale
    const pulse = 1 + Math.sin(time * 0.003) * 0.12
    this.mesh.scale.setScalar(pulse)

    // Pulse light intensity
    this.light.intensity = 3 + Math.sin(time * 0.004) * 1.5

    // Slowly rotate hue-shift the emissive
    const hue = (time * 0.0001) % 1
    const col = new THREE.Color().setHSL(hue * 0.15 + 0.9, 1, 0.6) // pink-purple range
    ;(this.mesh.material as THREE.MeshStandardMaterial).emissive = col
    this.light.color = col
  }

  dispose() {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.MeshStandardMaterial).dispose()
  }
}
