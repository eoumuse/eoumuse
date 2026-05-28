import * as THREE from 'three'

export class AgentSphere {
  group: THREE.Group
  private mesh: THREE.Mesh
  private light: THREE.PointLight
  private scatterSphere: THREE.Mesh
  private targetPos = new THREE.Vector3(0, 0, 0)

  constructor() {
    this.group = new THREE.Group()

    // Core sphere
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
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    this.group.add(new THREE.Mesh(coreGeo, coreMat))

    // Outer glow halo
    const haloGeo = new THREE.SphereGeometry(0.22, 16, 16)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xff2d9b, transparent: true, opacity: 0.1, side: THREE.BackSide,
    })
    this.group.add(new THREE.Mesh(haloGeo, haloMat))

    // Scatter radius sphere — wireframe, shows grain scatter area
    const scatterGeo = new THREE.SphereGeometry(1, 16, 12)
    const scatterMat = new THREE.MeshBasicMaterial({
      color: 0xd4a020,
      wireframe: true,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
    })
    this.scatterSphere = new THREE.Mesh(scatterGeo, scatterMat)
    this.group.add(this.scatterSphere)

    // Point light for local glow
    this.light = new THREE.PointLight(0xff2d9b, 4, 3)
    this.group.add(this.light)
  }

  /** Update scatter radius sphere size (scatter 0..1 → radius 0..2.5 world units) */
  setScatter(scatter: number) {
    const r = 0.2 + scatter * 2.5
    this.scatterSphere.scale.setScalar(r)
    ;(this.scatterSphere.material as THREE.MeshBasicMaterial).opacity = 0.04 + scatter * 0.1
  }

  setTargetPosition(x: number, y: number, z: number) {
    this.targetPos.set(x, y, z)
  }

  update(time: number) {
    this.group.position.lerp(this.targetPos, 0.03)

    const pulse = 1 + Math.sin(time * 0.003) * 0.12
    this.mesh.scale.setScalar(pulse)
    this.light.intensity = 3 + Math.sin(time * 0.004) * 1.5

    const hue = (time * 0.0001) % 1
    const col = new THREE.Color().setHSL(hue * 0.15 + 0.9, 1, 0.6)
    ;(this.mesh.material as THREE.MeshStandardMaterial).emissive = col
    this.light.color = col
  }

  dispose() {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.MeshStandardMaterial).dispose()
  }
}
