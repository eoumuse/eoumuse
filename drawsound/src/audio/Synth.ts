export type BrushMode = 'tone' | 'pad' | 'chord' | 'glitch'
export type ScaleName = 'pentatonic' | 'chromatic' | 'wholetone' | 'minor' | 'phrygian'

// Y=0 (top) → high pitch, Y=1 (bottom) → low pitch
// 2-octave range, MIDI C3–C5
const ROOT = 48
const SCALES: Record<ScaleName, number[]> = {
  pentatonic: [0, 2, 4, 7, 9],
  chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  wholetone:  [0, 2, 4, 6, 8, 10],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function yToMidi(y01: number, scale: number[]): number {
  const y = 1 - Math.max(0, Math.min(1, y01))  // invert: top = high
  const totalNotes = scale.length * 2
  const idx = Math.floor(y * totalNotes)
  const oct = Math.floor(idx / scale.length)
  const si  = Math.min(idx % scale.length, scale.length - 1)
  return ROOT + oct * 12 + scale[si]
}

class Synth {
  ctx: AudioContext | null = null

  private masterGain: GainNode | null = null
  private reverbIn: GainNode | null = null
  private reverbGain: GainNode | null = null

  scale: ScaleName = 'pentatonic'
  reverbWet = 0.45
  masterVol = 0.72

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 48000 })

      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.masterVol
      this.masterGain.connect(this.ctx.destination)

      // Long plate reverb
      const conv = this.ctx.createConvolver()
      conv.buffer = this._makeReverb(3.8)

      this.reverbIn = this.ctx.createGain()
      this.reverbGain = this.ctx.createGain()
      this.reverbGain.gain.value = this.reverbWet

      this.reverbIn.connect(conv)
      conv.connect(this.reverbGain)
      this.reverbGain.connect(this.masterGain)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  private _makeReverb(sec: number): AudioBuffer {
    const c = this.ensureCtx()
    const len = Math.floor(c.sampleRate * sec)
    const buf = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        // Slightly different decay per channel for lush stereo
        const decay = ch === 0 ? 1.8 : 2.2
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
      }
    }
    return buf
  }

  // Route voice output node → dry + reverb
  private _out(node: AudioNode) {
    node.connect(this.masterGain!)
    node.connect(this.reverbIn!)
  }

  // ── 2-operator FM helper ─────────────────────────────────────────────────
  private _fm(
    c: AudioContext,
    freq: number,
    ratio: number,
    index: number,
    dur: number,
    vel: number,
  ): OscillatorNode {
    const carrier = c.createOscillator()
    const mod     = c.createOscillator()
    const modGain = c.createGain()
    const now = c.currentTime

    carrier.type = 'sine'
    carrier.frequency.setValueAtTime(freq, now)

    mod.type = 'sine'
    mod.frequency.setValueAtTime(freq * ratio, now)
    modGain.gain.setValueAtTime(freq * index * vel, now)
    // Modulation index decays → timbre goes from bright to dull
    modGain.gain.exponentialRampToValueAtTime(freq * 0.04 + 0.001, now + dur * 0.65)

    mod.connect(modGain)
    modGain.connect(carrier.frequency)

    mod.start(now)
    mod.stop(now + dur + 0.06)

    return carrier
  }

  // ── TONE: single 2-op FM, OPN bell/e.piano feel ─────────────────────────
  private _tone(freq: number, vel: number, pan: number) {
    const c = this.ensureCtx()
    const now = c.currentTime
    // Duration scales with velocity — soft touch = short, hard = long
    const dur = 0.18 + vel * 0.55

    const carrier = this._fm(c, freq, 2.14, 4.5, dur, vel)
    const env     = c.createGain()
    const panner  = c.createStereoPanner()
    panner.pan.setValueAtTime(pan, now)

    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(vel * 0.22, now + 0.003)
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    carrier.connect(env)
    env.connect(panner)
    this._out(panner)

    carrier.start(now)
    carrier.stop(now + dur + 0.06)
  }

  // ── PAD: 3 detuned sines, slow attack — iku sakan shimmer ───────────────
  private _pad(freq: number, vel: number, pan: number) {
    const c = this.ensureCtx()
    const now = c.currentTime
    const dur = 2.8 + vel * 1.8
    const atk = 0.55

    for (let i = 0; i < 3; i++) {
      const osc    = c.createOscillator()
      const env    = c.createGain()
      const panner = c.createStereoPanner()

      osc.type = 'sine'
      // Very slight detuning — creates beating interference
      osc.frequency.setValueAtTime(freq * (1 + (i - 1) * 0.0028), now)
      osc.detune.setValueAtTime((i - 1) * 7, now)
      panner.pan.setValueAtTime(pan + (i - 1) * 0.4, now)

      env.gain.setValueAtTime(0, now)
      env.gain.linearRampToValueAtTime(vel * 0.072, now + atk + i * 0.06)
      env.gain.setValueAtTime(vel * 0.072, now + dur - 0.55)
      env.gain.linearRampToValueAtTime(0, now + dur)

      osc.connect(env)
      env.connect(panner)
      this._out(panner)

      osc.start(now)
      osc.stop(now + dur + 0.06)
    }
  }

  // ── CHORD: quartal harmony FM stack — very OPN ──────────────────────────
  private _chord(freq: number, vel: number, pan: number) {
    const c = this.ensureCtx()
    const now = c.currentTime
    // Stacked perfect 4ths: root, +P4, +P8, +P12
    const semitones = [0, 5, 10, 15]
    const dur = 1.4 + vel * 1.2

    semitones.forEach((st, i) => {
      const f = freq * Math.pow(2, st / 12)
      // Slightly detuned ratio per voice for richness
      const carrier = this._fm(c, f, 1.0 + i * 0.05, 2.0, dur, vel * 0.75)
      const env     = c.createGain()
      const panner  = c.createStereoPanner()

      panner.pan.setValueAtTime(pan + (i - 1.5) * 0.22, now)

      // Staggered attack — chord blooms in
      const atk = 0.04 + i * 0.05
      env.gain.setValueAtTime(0, now)
      env.gain.linearRampToValueAtTime(vel * 0.13, now + atk)
      env.gain.setValueAtTime(vel * 0.13, now + dur - 0.35)
      env.gain.linearRampToValueAtTime(0, now + dur)

      carrier.connect(env)
      env.connect(panner)
      this._out(panner)

      carrier.start(now + i * 0.012)
      carrier.stop(now + dur + 0.06)
    })
  }

  // ── GLITCH: stutter FM bursts + occasional bit-crush ────────────────────
  private _glitch(freq: number, vel: number, pan: number) {
    const c = this.ensureCtx()
    const count = Math.floor(3 + vel * 6)
    const segDur = 0.032 + Math.random() * 0.018

    for (let i = 0; i < count; i++) {
      const t = c.currentTime + i * segDur * (0.75 + Math.random() * 0.5)
      // Random octave flips — characteristic IDM dissonance
      const f = freq * (Math.random() > 0.65 ? 2 : 1) * (Math.random() > 0.8 ? 0.5 : 1)

      const carrier = this._fm(c, f, 3.0 + Math.random(), 8.0, segDur, vel)
      const env     = c.createGain()
      const panner  = c.createStereoPanner()
      panner.pan.setValueAtTime((Math.random() - 0.5) * 0.9, t)

      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(vel * 0.2, t + 0.002)
      env.gain.exponentialRampToValueAtTime(0.0001, t + segDur)

      carrier.connect(env)
      env.connect(panner)
      this._out(panner)

      carrier.start(t)
      carrier.stop(t + segDur + 0.04)
    }
  }

  // ── Public trigger ───────────────────────────────────────────────────────
  trigger(x01: number, y01: number, speed: number, mode: BrushMode): void {
    const c = this.ensureCtx()
    const now = c.currentTime
    // Prevent triggering while suspended (happens on some browsers before first gesture)
    if (c.state !== 'running') return

    const scale = SCALES[this.scale]
    const midi  = yToMidi(y01, scale)
    const freq  = midiToFreq(midi)
    const vel   = Math.max(0.2, Math.min(1, 0.25 + speed * 0.75))
    const pan   = (x01 - 0.5) * 0.7

    void now // suppress unused-var lint

    switch (mode) {
      case 'tone':  this._tone(freq, vel, pan);  break
      case 'pad':   this._pad(freq, vel, pan);   break
      case 'chord': this._chord(freq, vel, pan); break
      case 'glitch':this._glitch(freq, vel, pan);break
    }
  }

  setReverbWet(v: number): void {
    this.reverbWet = v
    if (this.reverbGain) {
      this.reverbGain.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.05)
    }
  }

  setMasterVol(v: number): void {
    this.masterVol = v
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.05)
    }
  }
}

export const synth = new Synth()
