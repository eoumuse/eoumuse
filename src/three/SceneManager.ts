import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  private animationId: number | null = null
  private autoRotateTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x28282f)
    this.scene.fog = new THREE.FogExp2(0x28282f, 0.04)

    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.01,
      1000
    )
    this.camera.position.set(0, 2, 10)
    this.camera.lookAt(0, 0, 2)

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    // OrbitControls — drag to rotate, scroll to zoom
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.6
    this.controls.target.set(0, 0, 2)
    this.controls.minDistance = 2
    this.controls.maxDistance = 30
    // Pause auto-rotate while user is dragging, resume after 3s idle
    canvas.addEventListener('pointerdown', () => {
      this.controls.autoRotate = false
      if (this.autoRotateTimeout) clearTimeout(this.autoRotateTimeout)
    })
    canvas.addEventListener('pointerup', () => {
      if (this.autoRotateTimeout) clearTimeout(this.autoRotateTimeout)
      this.autoRotateTimeout = setTimeout(() => {
        this.controls.autoRotate = true
      }, 3000)
    })

    // Lights
    const ambient = new THREE.AmbientLight(0x505060, 2.5)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xff2d9b, 0.8)
    dir.position.set(5, 5, 5)
    this.scene.add(dir)

    const dir2 = new THREE.DirectionalLight(0xffe629, 0.4)
    dir2.position.set(-5, -3, 2)
    this.scene.add(dir2)
  }

  startAnimation(onFrame: (time: number) => void) {
    const tick = (time: number) => {
      this.controls.update()
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
    if (this.autoRotateTimeout) clearTimeout(this.autoRotateTimeout)
    this.controls.dispose()
    this.renderer.dispose()
  }
}
