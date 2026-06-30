export type DrawMode = 'fm' | 'pad' | 'grain' | 'glitch'

// Pentatonic major (OPN-inspired: neutral, shimmery)
const SCALE = [0, 2, 4, 7, 9]
const ROOT_MIDI = 60 // C4

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function xToMidi(x: number, octaves = 2): number {
  const totalNotes = SCALE.length * octaves
  const idx = Math.floor(x * totalNotes)
  const oct = Math.floor(idx / SCALE.length)
  const si = idx % SCALE.length
  return ROOT_MIDI + oct * 12 + SCALE[si]
}

class DrawSynthEngine {
  ctx: AudioContext | null = null
  masterOut: GainNode | null = null
  mode: DrawMode = 'fm'

  // FM params (OPN feel)
  fmRatio = 2.14   // slightly inharmonic
  fmIndex = 5.0

  init(ctx: AudioContext, master: GainNode): void {
    this.ctx = ctx
    this.masterOut = master
  }

  trigger(x: number, y: number, velocity: number, audioBuffer?: AudioBuffer | null): void {
    const c = this.ctx
    const m = this.masterOut
    if (!c || !m) return

    const midi = xToMidi(x)
    // Y=0 (top) → high; Y=1 (bottom) → low; map to ±1 octave
    const pitchMult = Math.pow(2, (0.5 - y) * 1.5)
    const freq = midiToFreq(midi) * pitchMult

    switch (this.mode) {
      case 'fm':    this._fm(c, m, freq, velocity); break
      case 'pad':   this._pad(c, m, freq, velocity); break
      case 'glitch': this._glitch(c, m, x, velocity, audioBuffer); break
      case 'grain': this._grain(c, m, x, velocity, audioBuffer); break
    }
  }

  private _fm(c: AudioContext, m: GainNode, freq: number, vel: number): void {
    const now = c.currentTime
    const dur = 0.25 + vel * 0.6

    const carrier = c.createOscillator()
    const carEnv  = c.createGain()
    carrier.type  = 'sine'
    carrier.frequency.setValueAtTime(freq, now)

    const mod     = c.createOscillator()
    const modGain = c.createGain()
    mod.type      = 'sine'
    mod.frequency.setValueAtTime(freq * this.fmRatio, now)
    modGain.gain.setValueAtTime(freq * this.fmIndex * vel, now)
    modGain.gain.exponentialRampToValueAtTime(freq * 0.05 + 0.001, now + dur * 0.7)

    carEnv.gain.setValueAtTime(0, now)
    carEnv.gain.linearRampToValueAtTime(vel * 0.18, now + 0.004)
    carEnv.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    mod.connect(modGain)
    modGain.connect(carrier.frequency)
    carrier.connect(carEnv)
    carEnv.connect(m)

    carrier.start(now); mod.start(now)
    carrier.stop(now + dur + 0.02); mod.stop(now + dur + 0.02)
  }

  private _pad(c: AudioContext, m: GainNode, freq: number, vel: number): void {
    const now = c.currentTime
    const dur = 2.5 + vel * 2.0
    const atk = 0.5

    for (let i = 0; i < 3; i++) {
      const osc = c.createOscillator()
      const env = c.createGain()
      const pan = c.createStereoPanner()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq * (1 + (i - 1) * 0.0025), now)
      osc.detune.setValueAtTime((i - 1) * 6, now)
      pan.pan.setValueAtTime((i - 1) * 0.45, now)

      env.gain.setValueAtTime(0, now)
      env.gain.linearRampToValueAtTime(vel * 0.07, now + atk)
      env.gain.setValueAtTime(vel * 0.07, now + dur - 0.6)
      env.gain.linearRampToValueAtTime(0, now + dur)

      osc.connect(env); env.connect(pan); pan.connect(m)
      osc.start(now); osc.stop(now + dur + 0.02)
    }
  }

  private _glitch(c: AudioContext, m: GainNode, x: number, vel: number, buf?: AudioBuffer | null): void {
    if (!buf) { this._fm(c, m, midiToFreq(xToMidi(x)), vel); return }
    const now = c.currentTime
    const count = Math.floor(2 + vel * 7)
    const segDur = 0.035 + Math.random() * 0.02

    for (let i = 0; i < count; i++) {
      const t = now + i * segDur * (0.7 + Math.random() * 0.6)
      const src = c.createBufferSource()
      const env = c.createGain()
      const ws  = c.createWaveShaper()

      src.buffer = buf
      src.playbackRate.value = 0.4 + Math.random() * 1.6
      const startOff = Math.max(0, Math.random() * (buf.duration - 0.15))

      // bit-crush curve (4–8 bit)
      const bits = 4 + Math.floor(vel * 4)
      const steps = Math.pow(2, bits)
      const curve = new Float32Array(512)
      for (let j = 0; j < 512; j++) {
        const v = (j / 256) - 1
        curve[j] = Math.round(v * steps) / steps
      }
      ws.curve = curve

      env.gain.setValueAtTime(vel * 0.35, t)
      env.gain.setValueAtTime(0, t + segDur)

      src.connect(ws); ws.connect(env); env.connect(m)
      src.start(t, startOff, segDur + 0.01)
    }
  }

  private _grain(c: AudioContext, m: GainNode, x: number, vel: number, buf?: AudioBuffer | null): void {
    if (!buf) return
    const now = c.currentTime
    const dur = 0.06 + vel * 0.18
    const startOff = Math.max(0, Math.min(x, 0.98)) * Math.max(0, buf.duration - dur - 0.01)

    const src = c.createBufferSource()
    const env = c.createGain()
    const pan = c.createStereoPanner()

    src.buffer = buf
    src.playbackRate.value = 0.5 + (1 - vel * 0.3) * 1.2
    pan.pan.setValueAtTime((Math.random() - 0.5) * 0.9, now)

    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(vel * 0.28, now + dur * 0.25)
    env.gain.linearRampToValueAtTime(0, now + dur)

    src.connect(env); env.connect(pan); pan.connect(m)
    src.start(now, startOff, dur)
  }
}

export const drawSynthEngine = new DrawSynthEngine()
