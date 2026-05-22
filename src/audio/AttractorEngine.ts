/**
 * Strange attractor simulator.
 * The attractor's (x,y,z) state directly drives grain synthesis parameters —
 * the math of chaos IS the synthesis engine.
 *
 * x → audio buffer read position (0..1)
 * z → grain size (10ms..2000ms)
 *
 * Pitch — VORTEX MODEL:
 *   Instead of mapping y linearly to pitch, we track the cumulative orbital
 *   angle of the trajectory around the attractor's center (atan2 in x-y plane).
 *   Each complete orbit raises pitch by `semitonesPerOrbit` semitones.
 *   In chaotic regimes the attractor orbits faster → pitch ascends faster,
 *   creating the sensation of a sonic vortex.
 *   The pitch wraps in a 48-semitone window (Shepard-tone-like infinite rise).
 */

export type AttractorType = 'lorenz' | 'rossler' | 'thomas'

export interface AttractorState {
  x: number
  y: number
  z: number
  // normalized 0..1 for synthesis mapping
  nx: number
  ny: number
  nz: number
  /** Pitch derived from cumulative orbital angle (semitones, -24..+24 wrapped) */
  vortexPitch: number
  /** Raw cumulative orbits — useful for visualizing how many laps the trajectory made */
  totalOrbits: number
}

export interface AttractorParams {
  type: AttractorType
  // Lorenz: sigma, rho, beta
  // Rössler: a, b, c
  // Thomas: b
  p1: number
  p2: number
  p3: number
  speed: number // integration speed multiplier 0.01..4
}

const DEFAULTS: Record<AttractorType, AttractorParams> = {
  lorenz:  { type: 'lorenz',  p1: 10,   p2: 28,  p3: 2.667, speed: 1 },
  rossler: { type: 'rossler', p1: 0.2,  p2: 0.2, p3: 5.7,   speed: 1 },
  thomas:  { type: 'thomas',  p1: 0.19, p2: 0,   p3: 0,     speed: 1 },
}

// Approximate bounding boxes per attractor for normalization
const BOUNDS: Record<AttractorType, { x: [number,number], y: [number,number], z: [number,number] }> = {
  lorenz:  { x: [-20, 20], y: [-28, 28], z: [0, 50]   },
  rossler: { x: [-12, 12], y: [-12, 12], z: [0, 25]   },
  thomas:  { x: [-5,  5],  y: [-5,  5],  z: [-5, 5]   },
}

function lorenzStep(x: number, y: number, z: number, p: AttractorParams, dt: number) {
  const { p1: sigma, p2: rho, p3: beta } = p
  const dx = sigma * (y - x)
  const dy = x * (rho - z) - y
  const dz = x * y - beta * z
  return { x: x + dx * dt, y: y + dy * dt, z: z + dz * dt }
}

function rosslerStep(x: number, y: number, z: number, p: AttractorParams, dt: number) {
  const { p1: a, p2: b, p3: c } = p
  const dx = -y - z
  const dy = x + a * y
  const dz = b + z * (x - c)
  return { x: x + dx * dt, y: y + dy * dt, z: z + dz * dt }
}

function thomasStep(x: number, y: number, z: number, p: AttractorParams, dt: number) {
  const { p1: b } = p
  const dx = Math.sin(y) - b * x
  const dy = Math.sin(z) - b * y
  const dz = Math.sin(x) - b * z
  return { x: x + dx * dt, y: y + dy * dt, z: z + dz * dt }
}

function normalize(v: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (v - min) / (max - min)))
}

// Semitones added to pitch per full orbit around the attractor center.
// One orbit = full 2π rotation in the x-y plane.
export const DEFAULT_SEMITONES_PER_ORBIT = 7   // a fifth per orbit feels musical

// The pitch window: vortex pitch wraps within ±this value (Shepard-tone illusion).
const PITCH_HALF_RANGE = 24

export class AttractorEngine {
  params: AttractorParams
  state: AttractorState = {
    x: 0.1, y: 0, z: 0,
    nx: 0.5, ny: 0.5, nz: 0.5,
    vortexPitch: 0, totalOrbits: 0,
  }

  // Perturbation: a gentle force that pulls the trajectory toward a target point
  perturbTarget: { x: number; y: number; z: number } | null = null
  perturbStrength = 0  // 0..1

  // Vortex pitch settings
  semitonesPerOrbit = DEFAULT_SEMITONES_PER_ORBIT
  /** When true, pitch wraps (Shepard-tone infinite rise). When false, clamps at ±24. */
  pitchWrap = true

  // Internal angle tracking for vortex pitch
  private _prevAngle = 0
  private _cumulativeAngle = 0

  // Rolling history for 3D trail rendering (last N positions)
  trail: Float32Array  // x0,y0,z0, x1,y1,z1, ...
  trailLength = 6000
  trailHead = 0
  trailFilled = false

  constructor(type: AttractorType = 'lorenz') {
    this.params = { ...DEFAULTS[type] }
    this.trail = new Float32Array(this.trailLength * 3)
    // warm-up: run 2000 steps to settle on attractor
    this._warmup(2000)
  }

  setType(type: AttractorType) {
    this.params = { ...DEFAULTS[type] }
    const s = type === 'lorenz'  ? { x: 0.1, y: 0,   z: 0 }
             : type === 'rossler' ? { x: 0.1, y: 0,   z: 0 }
             :                      { x: 0.1, y: 0.1, z: 0 }
    this.state = { ...s, nx: 0.5, ny: 0.5, nz: 0.5, vortexPitch: 0, totalOrbits: 0 }
    this._prevAngle = 0
    this._cumulativeAngle = 0
    this.trailHead = 0
    this.trailFilled = false
    this._warmup(2000)
  }

  private _warmup(steps: number) {
    const dt = 0.005
    let { x, y, z } = this.state
    for (let i = 0; i < steps; i++) {
      const next = this._step(x, y, z, dt)
      x = next.x; y = next.y; z = next.z
    }
    // Initialise angle tracking from warmed-up position
    this._prevAngle = Math.atan2(y, x)
    this._cumulativeAngle = 0
    this._setState(x, y, z)
  }

  private _step(x: number, y: number, z: number, dt: number) {
    switch (this.params.type) {
      case 'lorenz':  return lorenzStep(x, y, z, this.params, dt)
      case 'rossler': return rosslerStep(x, y, z, this.params, dt)
      case 'thomas':  return thomasStep(x, y, z, this.params, dt)
    }
  }

  private _setState(x: number, y: number, z: number) {
    const b = BOUNDS[this.params.type]

    // --- Vortex pitch: track cumulative orbital angle in x-y plane ---
    const angle = Math.atan2(y, x)
    let delta = angle - this._prevAngle
    // Unwrap delta to [-π, π] to avoid 2π jumps
    if (delta >  Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI
    this._cumulativeAngle += delta
    this._prevAngle = angle

    const totalOrbits = this._cumulativeAngle / (2 * Math.PI)
    const rawPitch = totalOrbits * this.semitonesPerOrbit
    const range = PITCH_HALF_RANGE * 2  // 48 semitones window

    let vortexPitch: number
    if (this.pitchWrap) {
      // Sawtooth wrap: ascends then snaps back — Shepard-tone infinite-rise illusion
      vortexPitch = ((rawPitch % range) + range) % range - PITCH_HALF_RANGE
    } else {
      vortexPitch = Math.max(-PITCH_HALF_RANGE, Math.min(PITCH_HALF_RANGE, rawPitch))
    }

    this.state = {
      x, y, z,
      nx: normalize(x, b.x[0], b.x[1]),
      ny: normalize(y, b.y[0], b.y[1]),
      nz: normalize(z, b.z[0], b.z[1]),
      vortexPitch,
      totalOrbits,
    }
  }

  /** Advance the attractor by `ms` milliseconds of real time. */
  tick(ms: number) {
    const stepsPerMs = 0.5 * this.params.speed
    const steps = Math.max(1, Math.round(ms * stepsPerMs))
    const dt = 0.005 * this.params.speed

    let { x, y, z } = this.state
    for (let i = 0; i < steps; i++) {
      const next = this._step(x, y, z, dt)
      x = next.x; y = next.y; z = next.z

      // Apply perturbation force — pulls trajectory toward target point
      if (this.perturbTarget !== null && this.perturbStrength > 0) {
        const k = this.perturbStrength * 0.12
        x += k * (this.perturbTarget.x - x)
        y += k * (this.perturbTarget.y - y)
        z += k * (this.perturbTarget.z - z) * 0.5
      }

      // record trail
      const idx = this.trailHead * 3
      this.trail[idx]     = x
      this.trail[idx + 1] = y
      this.trail[idx + 2] = z
      this.trailHead = (this.trailHead + 1) % this.trailLength
      if (this.trailHead === 0) this.trailFilled = true
    }

    this._setState(x, y, z)
  }

  /** Map canvas position (0..1) to attractor coordinate space for perturbation. */
  canvasToAttractorCoords(cx: number, cy: number): { x: number; y: number; z: number } {
    const b = BOUNDS[this.params.type]
    return {
      x: b.x[0] + cx * (b.x[1] - b.x[0]),
      y: b.y[1] - cy * (b.y[1] - b.y[0]),  // canvas Y is inverted
      z: (b.z[0] + b.z[1]) / 2,
    }
  }

  getDefaultParams(type: AttractorType): AttractorParams {
    return { ...DEFAULTS[type] }
  }

  /** Return the Three.js scene scale factor for the current attractor type */
  scaleForType(): number {
    const map: Record<AttractorType, number> = {
      lorenz:  0.12,
      rossler: 0.22,
      thomas:  0.55,
    }
    return map[this.params.type] ?? 0.12
  }
}

export const ATTRACTOR_RANGES: Record<AttractorType, {
  p1: { label: string; min: number; max: number; default: number }
  p2: { label: string; min: number; max: number; default: number }
  p3: { label: string; min: number; max: number; default: number }
}> = {
  lorenz: {
    p1: { label: 'σ sigma',  min: 1,  max: 20,  default: 10    },
    p2: { label: 'ρ rho',    min: 1,  max: 50,  default: 28    },
    p3: { label: 'β beta',   min: 0.5,max: 6,   default: 2.667 },
  },
  rossler: {
    p1: { label: 'a',        min: 0.01,max: 0.5, default: 0.2 },
    p2: { label: 'b',        min: 0.01,max: 0.5, default: 0.2 },
    p3: { label: 'c',        min: 1,   max: 15,  default: 5.7 },
  },
  thomas: {
    p1: { label: 'b damp',   min: 0.1, max: 0.5, default: 0.19 },
    p2: { label: '—',        min: 0,   max: 1,   default: 0    },
    p3: { label: '—',        min: 0,   max: 1,   default: 0    },
  },
}
