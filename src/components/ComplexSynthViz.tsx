import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { ComplexSynthEngine } from '../audio/ComplexSynthEngine'

// ── Shaders ────────────────────────────────────────────────────────────────

const vert = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const frag = /* glsl */`
#define PI 3.14159265358979323846

varying vec2 vUv;
uniform vec2  uRoot;
uniform float uBound;
uniform float uAspect;
uniform float uEpsilon;

vec3 hsl2rgb(float h, float s, float l) {
  float c  = (1.0 - abs(2.0 * l - 1.0)) * s;
  float h6 = fract(h) * 6.0;
  float x  = c * (1.0 - abs(mod(h6, 2.0) - 1.0));
  float m  = l - c * 0.5;
  vec3 col;
  if      (h6 < 1.0) col = vec3(c, x, 0.0);
  else if (h6 < 2.0) col = vec3(x, c, 0.0);
  else if (h6 < 3.0) col = vec3(0.0, c, x);
  else if (h6 < 4.0) col = vec3(0.0, x, c);
  else if (h6 < 5.0) col = vec3(x, 0.0, c);
  else               col = vec3(c, 0.0, x);
  return col + m;
}

vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

void main() {
  // Map UV → complex plane (aspect-corrected)
  vec2 z = (vUv - 0.5) * 2.0 * uBound;
  z.x *= uAspect;

  // p(z) = z * (z − r)
  vec2 pz = cmul(z, z - uRoot);

  // arg(p(z)) → hue
  float hue = atan(pz.y, pz.x) / (2.0 * PI) + 0.5;
  vec3 color = hsl2rgb(hue, 1.0, 0.5);

  // ── Black clouds: Gaussian density around each root ──────────────────
  float sigma = 0.055;
  float cloud0 = exp(-dot(z, z)           / sigma);
  float cloudR = exp(-dot(z - uRoot, z - uRoot) / sigma);
  float cloud  = clamp(cloud0 + cloudR, 0.0, 1.0);
  color = mix(color, vec3(0.01, 0.01, 0.015), cloud * 0.97);

  // ── White pseudospectrum curves: |p(z)| ≤ ε·√(1+|z|²+|z|⁴) ─────────
  float pLen = length(pz);
  float z2   = dot(z, z);
  float nrm  = sqrt(1.0 + z2 + z2 * z2);
  float lvl  = pLen / nrm;

  float lw = max(nrm * 0.004, 0.003);

  float e1 = uEpsilon * 0.25;
  float e2 = uEpsilon;
  float e3 = uEpsilon * 3.5;

  float c1 = smoothstep(e1 - lw, e1, lvl) - smoothstep(e1, e1 + lw, lvl);
  float c2 = smoothstep(e2 - lw, e2, lvl) - smoothstep(e2, e2 + lw, lvl);
  float c3 = smoothstep(e3 - lw, e3, lvl) - smoothstep(e3, e3 + lw, lvl);
  float curves = clamp(c1 + c2 + c3, 0.0, 1.0);

  color = mix(color, vec3(1.0), curves * 0.9);

  gl_FragColor = vec4(color, 1.0);
}
`

// ── Component ──────────────────────────────────────────────────────────────

interface Params {
  orbitRadius: number
  orbitSpeed: number
  epsilon: number
  gain: number
}

const DEFAULT_PARAMS: Params = {
  orbitRadius: 1.25,
  orbitSpeed: 0.28,
  epsilon: 0.18,
  gain: 0.45,
}

export function ComplexSynthViz() {
  const mountRef    = useRef<HTMLDivElement>(null)
  const uniformsRef = useRef<{
    uRoot: THREE.IUniform<THREE.Vector2>
    uBound: THREE.IUniform<number>
    uAspect: THREE.IUniform<number>
    uEpsilon: THREE.IUniform<number>
  } | null>(null)
  const engineRef   = useRef<ComplexSynthEngine | null>(null)
  const animRef     = useRef<number>(0)
  const startRef    = useRef(Date.now())
  const paramsRef   = useRef<Params>({ ...DEFAULT_PARAMS })

  const [params, setParams]   = useState<Params>({ ...DEFAULT_PARAMS })
  const [playing, setPlaying] = useState(false)
  const [angle, setAngle]     = useState(0)

  // Keep paramsRef in sync with state (for animation closure)
  useEffect(() => { paramsRef.current = params }, [params])

  // ── Three.js setup ───────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    const scene    = new THREE.Scene()
    const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const uniforms = {
      uRoot:    { value: new THREE.Vector2(DEFAULT_PARAMS.orbitRadius, 0) },
      uBound:   { value: 2.1 },
      uAspect:  { value: mount.clientWidth / mount.clientHeight },
      uEpsilon: { value: DEFAULT_PARAMS.epsilon },
    }
    uniformsRef.current = uniforms

    const mat  = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms })
    const geo  = new THREE.PlaneGeometry(2, 2)
    scene.add(new THREE.Mesh(geo, mat))

    const onResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      uniforms.uAspect.value = mount.clientWidth / mount.clientHeight
    }
    window.addEventListener('resize', onResize)

    const tick = () => {
      animRef.current = requestAnimationFrame(tick)
      const t = (Date.now() - startRef.current) / 1000
      const p = paramsRef.current
      const a = t * p.orbitSpeed

      uniforms.uRoot.value.set(
        Math.cos(a) * p.orbitRadius,
        Math.sin(a) * p.orbitRadius,
      )
      uniforms.uEpsilon.value = p.epsilon

      // Sync audio engine
      const eng = engineRef.current
      if (eng?.isRunning) {
        eng.setOrbitParams(p.orbitRadius, a, p.epsilon)
      }

      setAngle(a % (Math.PI * 2))
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      geo.dispose()
      mat.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  // ── Audio toggle ─────────────────────────────────────────────────────────
  const toggleAudio = useCallback(async () => {
    if (!engineRef.current) {
      engineRef.current = new ComplexSynthEngine()
    }
    const eng = engineRef.current
    if (eng.isRunning) {
      eng.stop()
      engineRef.current = null
      setPlaying(false)
    } else {
      await eng.start()
      eng.setGain(paramsRef.current.gain)
      setPlaying(true)
    }
  }, [])

  // ── Param helpers ─────────────────────────────────────────────────────────
  const set = useCallback(<K extends keyof Params>(key: K, val: Params[K]) => {
    setParams(prev => {
      const next = { ...prev, [key]: val }
      paramsRef.current = next
      if (key === 'gain') engineRef.current?.setGain(val as number)
      return next
    })
  }, [])

  // ── UI layout values ──────────────────────────────────────────────────────
  const rx = (params.orbitRadius * Math.cos(angle)).toFixed(3)
  const ry = (params.orbitRadius * Math.sin(angle)).toFixed(3)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
      {/* WebGL canvas */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* ── Top-left: equation label ────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 18, left: 22,
        fontFamily: 'Georgia, "Times New Roman", serif',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', letterSpacing: '0.04em' }}>
          p(z) = z(z − r)
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 4, letterSpacing: '0.08em' }}>
          colour: arg(p(z)) &nbsp;·&nbsp; white: ε-pseudospectrum &nbsp;·&nbsp; dark: roots
        </div>
      </div>

      {/* ── Bottom-right: live state ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 18, right: 22,
        fontFamily: 'monospace', fontSize: 11,
        color: 'rgba(255,255,255,0.45)', textAlign: 'right',
        pointerEvents: 'none', lineHeight: 1.9,
      }}>
        <div>r = {rx} + {ry}i</div>
        <div>|r| = {params.orbitRadius.toFixed(2)} &nbsp; ∠ = {(angle * 180 / Math.PI).toFixed(1)}°</div>
        <div>ε = {params.epsilon.toFixed(3)}</div>
      </div>

      {/* ── Bottom-center: controls ──────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        backdropFilter: 'blur(12px)',
        background: 'rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '14px 22px',
        minWidth: 320,
      }}>
        <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end' }}>
          <Slider label="|r| orbit radius" value={params.orbitRadius} min={0.3} max={2.4} step={0.01}
            onChange={v => set('orbitRadius', v)} />
          <Slider label="ω speed" value={params.orbitSpeed} min={0.02} max={1.2} step={0.01}
            onChange={v => set('orbitSpeed', v)} />
          <Slider label="ε pseudospectrum" value={params.epsilon} min={0.02} max={0.8} step={0.01}
            onChange={v => set('epsilon', v)} />
          <Slider label="gain" value={params.gain} min={0} max={1} step={0.01}
            onChange={v => set('gain', v)} />
        </div>

        <button
          onClick={toggleAudio}
          style={{
            marginTop: 2,
            padding: '6px 28px',
            borderRadius: 20,
            border: playing
              ? '1px solid rgba(255,255,255,0.5)'
              : '1px solid rgba(255,255,255,0.15)',
            background: playing
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(255,255,255,0.04)',
            color: playing ? '#fff' : 'rgba(255,255,255,0.5)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {playing ? '◼ sound off' : '▶ sound on'}
        </button>
      </div>
    </div>
  )
}

// ── Minimal vertical slider ────────────────────────────────────────────────

function Slider({
  label, value, min, max, step, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      <div style={{
        fontFamily: 'monospace', fontSize: 13, color: '#fff',
        fontWeight: 300, letterSpacing: '0.02em',
      }}>
        {value.toFixed(2)}
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          writingMode: 'vertical-lr' as React.CSSProperties['writingMode'],
          direction: 'rtl' as React.CSSProperties['direction'],
          height: 72, width: 28, cursor: 'pointer', accentColor: '#fff',
        }}
      />
      <div style={{
        fontFamily: 'monospace', fontSize: 9,
        color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em',
        textAlign: 'center', maxWidth: 60,
      }}>
        {label}
      </div>
    </div>
  )
}
