import * as THREE from 'three'

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  private animationId: number | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x08000f)
    this.scene.fog = new THREE.FogExp2(0x08000f, 0.08)

    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.01,
      1000
    )
    this.camera.position.set(0, 1, 8)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    // Ambient light
    const ambient = new THREE.AmbientLight(0x110022, 2)
    this.scene.add(ambient)

    // Directional
    const dir = new THREE.DirectionalLight(0xbf5fff, 1)
    dir.position.set(5, 5, 5)
    this.scene.add(dir)
  }

  startAnimation(onFrame: (time: number) => void) {
    const tick = (time: number) => {
      onFrame(time)
      this.renderer.render(this.scene, this.camera)
      this.animationId = requestAnimationFrame(tick)
    }
    this.animationId = requestAnimationFrame(tick)
  }

  stopAnimation() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  dispose() {
    this.stopAnimation()
    this.renderer.dispose()
  }
}
