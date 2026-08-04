import * as THREE from 'three'
import type { AudioNode3D } from '../store/synthStore'

const NODE_VERTEX = /* glsl */`
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mvPos.xyz);
    gl_PointSize = clamp(size * 200.0 / dist, 2.0, 20.0);
    gl_Position = projectionMatrix * mvPos;
  }
`

const NODE_FRAGMENT = /* glsl */`
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;

    // Round shape
    float glow = exp(-r * 3.0);
    float core = exp(-r * 8.0);

    if (glow < 0.01) discard;
    vec3 finalColor = mix(vColor, vec3(1.0), core * 0.8);
    gl_FragColor = vec4(finalColor, (glow + core * 0.5));
  }
`

export class NodeMesh {
  points: THREE.Points | null = null
  private geometry: THREE.BufferGeometry | null = null
  private material: THREE.ShaderMaterial
  private currentNodes: AudioNode3D[] = []

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: NODE_VERTEX,
      fragmentShader: NODE_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  }

  updateNodes(nodes: AudioNode3D[], scene: THREE.Scene, currentIndex: number) {
    if (nodes === this.currentNodes && this.points) {
      this.updateCurrentHighlight(currentIndex)
      return
    }

    // Remove old
    if (this.points) {
      scene.remove(this.points)
      this.geometry?.dispose()
      this.points = null
      this.geometry = null
    }

    if (nodes.length === 0) return

    this.currentNodes = nodes
    this.geometry = new THREE.BufferGeometry()

    const positions = new Float32Array(nodes.length * 3)
    const sizes = new Float32Array(nodes.length)
    const colors = new Float32Array(nodes.length * 3)

    const goldColor = new THREE.Color(0xffd24a)
    const whiteColor = new THREE.Color(0xf0ead2)
    const pinkColor = new THREE.Color(0xff6b4a)

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      positions[i * 3] = n.x
      positions[i * 3 + 1] = n.y
      positions[i * 3 + 2] = n.z

      sizes[i] = 0.05 + n.energy * 0.15

      const col = i === currentIndex
        ? pinkColor
        : n.energy > 0.7
          ? whiteColor
          : goldColor

      colors[i * 3] = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    this.points = new THREE.Points(this.geometry, this.material)
    scene.add(this.points)
  }

  updateCurrentHighlight(currentIndex: number) {
    if (!this.geometry || this.currentNodes.length === 0) return

    const colorAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute
    const sizeAttr = this.geometry.getAttribute('size') as THREE.BufferAttribute

    const goldColor = new THREE.Color(0xffd24a)
    const whiteColor = new THREE.Color(0xf0ead2)
    const pinkColor = new THREE.Color(0xff6b4a)

    for (let i = 0; i < this.currentNodes.length; i++) {
      const n = this.currentNodes[i]
      const col = i === currentIndex
        ? pinkColor
        : n.energy > 0.7
          ? whiteColor
          : goldColor

      colorAttr.setXYZ(i, col.r, col.g, col.b)
      sizeAttr.setX(i, i === currentIndex ? 0.2 : 0.05 + n.energy * 0.15)
    }

    colorAttr.needsUpdate = true
    sizeAttr.needsUpdate = true
  }

  dispose() {
    this.geometry?.dispose()
    this.material.dispose()
  }
}
