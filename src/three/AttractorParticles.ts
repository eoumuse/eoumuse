import * as THREE from 'three'

const VERTEX_SHADER = /* glsl */`
  attribute float alpha;
  attribute vec3 color;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vAlpha = alpha;
    vColor = color;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mvPos.xyz);
    gl_PointSize = clamp(300.0 / dist, 1.0, 6.0);
    gl_Position = projectionMatrix * mvPos;
  }
`

const FRAGMENT_SHADER = /* glsl */`
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    float glow = exp(-r * 2.5);
    if (glow < 0.01) discard;
    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`

function lorenz(x: number, y: number, z: number, dt: number) {
  const sigma = 10
  const rho = 28
  const beta = 8 / 3
  const dx = sigma * (y - x)
  const dy = x * (rho - z) - y
  const dz = x * y - beta * z
  return {
    x: x + dx * dt,
    y: y + dy * dt,
    z: z + dz * dt,
  }
}

export class AttractorParticles {
  points: THREE.Points
  private material: THREE.ShaderMaterial

  constructor(numPoints = 5000) {
    // Pre-compute Lorenz attractor
    const positions = new Float32Array(numPoints * 3)
    const alphas = new Float32Array(numPoints)
    const colors = new Float32Array(numPoints * 3)

    let px = 0.1, py = 0, pz = 0

    // Warm up
    for (let i = 0; i < 200; i++) {
      const n = lorenz(px, py, pz, 0.005)
      px = n.x; py = n.y; pz = n.z
    }

    // Collect bounds first
    const rawX: number[] = []
    const rawY: number[] = []
    const rawZ: number[] = []
    for (let i = 0; i < numPoints; i++) {
      const n = lorenz(px, py, pz, 0.005)
      px = n.x; py = n.y; pz = n.z
      rawX.push(px)
      rawY.push(py)
      rawZ.push(pz)
    }

    const minX = Math.min(...rawX), maxX = Math.max(...rawX)
    const minY = Math.min(...rawY), maxY = Math.max(...rawY)
    const minZ = Math.min(...rawZ), maxZ = Math.max(...rawZ)

    const scale = 4

    // Color palette: pink → yellow → light gray → pink
    const palette = [
      new THREE.Color(0xff2d9b), // hot pink
      new THREE.Color(0xffe629), // yellow
      new THREE.Color(0xc0c0cc), // light gray
      new THREE.Color(0xff2d9b), // back to pink
    ]

    for (let i = 0; i < numPoints; i++) {
      const nx = ((rawX[i] - minX) / (maxX - minX) - 0.5) * scale * 2
      const ny = ((rawY[i] - minY) / (maxY - minY) - 0.5) * scale
      const nz = ((rawZ[i] - minZ) / (maxZ - minZ) - 0.5) * scale * 1.5

      positions[i * 3] = nx
      positions[i * 3 + 1] = ny
      positions[i * 3 + 2] = nz

      // Fade alpha: trail effect (older = more transparent)
      alphas[i] = 0.3 + (i / numPoints) * 0.7

      // Color interpolation
      const t = (i / numPoints) * 3
      const segIdx = Math.floor(t)
      const segT = t - segIdx
      const c0 = palette[Math.min(segIdx, palette.length - 1)]
      const c1 = palette[Math.min(segIdx + 1, palette.length - 1)]
      const col = c0.clone().lerp(c1, segT)

      colors[i * 3] = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this.points = new THREE.Points(geometry, this.material)
  }

  update(time: number) {
    this.points.rotation.y = time * 0.0003
    this.points.rotation.x = Math.sin(time * 0.0001) * 0.05
  }

  dispose() {
    this.points.geometry.dispose()
    this.material.dispose()
  }
}
