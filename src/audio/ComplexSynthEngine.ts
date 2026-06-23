export class ComplexSynthEngine {
  private ctx: AudioContext | null = null
  private carrier1: OscillatorNode | null = null
  private carrier2: OscillatorNode | null = null
  private carrier3: OscillatorNode | null = null
  private lfo: OscillatorNode | null = null
  private lfoGain: GainNode | null = null
  private masterGain: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private panner: StereoPannerNode | null = null
  private delayNode: DelayNode | null = null
  private delayFb: GainNode | null = null
  private delaySend: GainNode | null = null
  private delayReturn: GainNode | null = null
  private dry: GainNode | null = null

  private baseFreq = 220
  private _gain = 0.4

  get isRunning() {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  async start() {
    if (this.ctx) return
    this.ctx = new AudioContext()

    // iOS Safari unlock: schedule silent buffer immediately
    const unlock = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
    const src = this.ctx.createBufferSource()
    src.buffer = unlock
    src.connect(this.ctx.destination)
    src.start(0)

    await this.ctx.resume()
    const ctx = this.ctx

    // ── Oscillators ───────────────────────────────────────────────────────
    // Three partials: fundamental, octave, fifth above octave
    this.carrier1 = ctx.createOscillator()
    this.carrier1.type = 'sine'
    this.carrier1.frequency.value = this.baseFreq

    this.carrier2 = ctx.createOscillator()
    this.carrier2.type = 'sine'
    this.carrier2.frequency.value = this.baseFreq * 2

    this.carrier3 = ctx.createOscillator()
    this.carrier3.type = 'sine'
    this.carrier3.frequency.value = this.baseFreq * 3

    // LFO modulates all carrier pitches gently (vibrato)
    this.lfo = ctx.createOscillator()
    this.lfo.type = 'sine'
    this.lfo.frequency.value = 0.3

    this.lfoGain = ctx.createGain()
    this.lfoGain.gain.value = 4  // ±4 Hz vibrato depth

    // ── Mixer ─────────────────────────────────────────────────────────────
    const mix1 = ctx.createGain(); mix1.gain.value = 0.5
    const mix2 = ctx.createGain(); mix2.gain.value = 0.3
    const mix3 = ctx.createGain(); mix3.gain.value = 0.2

    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 1400
    this.filter.Q.value = 1.2

    this.panner = ctx.createStereoPanner()
    this.panner.pan.value = 0

    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = this._gain

    // ── Delay reverb (single tap, no feedback explosion) ──────────────────
    this.delayNode = ctx.createDelay(2.0)
    this.delayNode.delayTime.value = 0.45

    this.delayFb = ctx.createGain()
    this.delayFb.gain.value = 0.35

    this.delaySend = ctx.createGain()
    this.delaySend.gain.value = 0.28

    this.delayReturn = ctx.createGain()
    this.delayReturn.gain.value = 0.55

    this.dry = ctx.createGain()
    this.dry.gain.value = 1.0

    // ── Connections ───────────────────────────────────────────────────────
    // LFO → all carrier frequencies
    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.carrier1.frequency)
    this.lfoGain.connect(this.carrier2.frequency)
    this.lfoGain.connect(this.carrier3.frequency)

    // carriers → mix → filter → panner
    this.carrier1.connect(mix1); mix1.connect(this.filter)
    this.carrier2.connect(mix2); mix2.connect(this.filter)
    this.carrier3.connect(mix3); mix3.connect(this.filter)

    this.filter.connect(this.panner)

    // panner → dry path
    this.panner.connect(this.dry)
    this.dry.connect(this.masterGain)

    // panner → delay send → delay → feedback → delay (safe level)
    this.panner.connect(this.delaySend)
    this.delaySend.connect(this.delayNode)
    this.delayNode.connect(this.delayFb)
    this.delayFb.connect(this.delayNode)
    this.delayNode.connect(this.delayReturn)
    this.delayReturn.connect(this.masterGain)

    this.masterGain.connect(ctx.destination)

    this.carrier1.start()
    this.carrier2.start()
    this.carrier3.start()
    this.lfo.start()
  }

  setOrbitParams(orbitRadius: number, orbitAngle: number, epsilon: number) {
    if (!this.ctx || !this.carrier1 || !this.carrier2 || !this.carrier3) return
    const now = this.ctx.currentTime
    const tau = 0.15

    // Root at origin → fundamental stays at base
    this.carrier1.frequency.setTargetAtTime(this.baseFreq, now, tau)

    // Root at r → frequency interval based on |r|
    // Clamp to ensure audible, positive frequencies
    const ratio = Math.max(orbitRadius * 0.5, 0.25)
    const f2 = this.baseFreq * (1 + ratio)   // always > baseFreq
    const f3 = this.baseFreq * (1 + ratio * 1.5)
    this.carrier2.frequency.setTargetAtTime(f2, now, tau)
    this.carrier3.frequency.setTargetAtTime(f3, now, tau)

    // LFO speed follows orbit speed slightly
    if (this.lfo) {
      this.lfo.frequency.setTargetAtTime(0.2 + orbitRadius * 0.15, now, 0.5)
    }
    // LFO depth follows orbit radius
    if (this.lfoGain) {
      this.lfoGain.gain.setTargetAtTime(2 + orbitRadius * 3, now, 0.3)
    }

    // Panning follows orbit angle gently
    if (this.panner) {
      this.panner.pan.setTargetAtTime(Math.sin(orbitAngle) * 0.3, now, 0.5)
    }

    // Filter cutoff: epsilon controls brightness
    if (this.filter) {
      const cutoff = 600 + epsilon * 3000
      this.filter.frequency.setTargetAtTime(cutoff, now, 0.3)
    }
  }

  setGain(gain: number) {
    this._gain = gain
    if (!this.ctx || !this.masterGain) return
    this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05)
  }

  stop() {
    try {
      this.carrier1?.stop(); this.carrier2?.stop(); this.carrier3?.stop()
      this.lfo?.stop()
    } catch (_) { /* already stopped */ }
    this.ctx?.close()
    this.ctx = null
    this.carrier1 = this.carrier2 = this.carrier3 = null
    this.lfo = null
    this.lfoGain = null
    this.masterGain = null
    this.filter = null
    this.panner = null
    this.delayNode = null
    this.delayFb = null
    this.delaySend = null
    this.delayReturn = null
    this.dry = null
  }
}
