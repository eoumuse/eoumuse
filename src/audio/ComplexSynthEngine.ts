export class ComplexSynthEngine {
  private ctx: AudioContext | null = null
  private carrier1: OscillatorNode | null = null
  private carrier2: OscillatorNode | null = null
  private mod1: OscillatorNode | null = null
  private mod2: OscillatorNode | null = null
  private modGain1: GainNode | null = null
  private modGain2: GainNode | null = null
  private carGain1: GainNode | null = null
  private carGain2: GainNode | null = null
  private masterGain: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private panner: StereoPannerNode | null = null
  private delay1: DelayNode | null = null
  private delay2: DelayNode | null = null
  private fb1: GainNode | null = null
  private fb2: GainNode | null = null
  private reverbSend: GainNode | null = null

  private baseFreq = 55
  private _gain = 0.45

  get isRunning() {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  async start() {
    if (this.ctx) return
    this.ctx = new AudioContext()
    await this.ctx.resume()
    const ctx = this.ctx

    // Two FM pairs, one per root (origin + orbiting)
    this.carrier1 = ctx.createOscillator()
    this.carrier1.type = 'sine'
    this.carrier1.frequency.value = this.baseFreq

    this.carrier2 = ctx.createOscillator()
    this.carrier2.type = 'sine'
    this.carrier2.frequency.value = this.baseFreq * 1.5

    this.mod1 = ctx.createOscillator()
    this.mod1.type = 'sine'
    this.mod1.frequency.value = this.baseFreq * 2

    this.mod2 = ctx.createOscillator()
    this.mod2.type = 'sine'
    this.mod2.frequency.value = this.baseFreq * 3

    this.modGain1 = ctx.createGain()
    this.modGain1.gain.value = this.baseFreq * 1.5

    this.modGain2 = ctx.createGain()
    this.modGain2.gain.value = this.baseFreq * 2

    this.carGain1 = ctx.createGain()
    this.carGain1.gain.value = 0.5

    this.carGain2 = ctx.createGain()
    this.carGain2.gain.value = 0.5

    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 1800
    this.filter.Q.value = 1.5

    this.panner = ctx.createStereoPanner()
    this.panner.pan.value = 0

    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = this._gain

    // Reverb via two-comb delay network
    this.delay1 = ctx.createDelay(3.0)
    this.delay1.delayTime.value = 0.41
    this.delay2 = ctx.createDelay(3.0)
    this.delay2.delayTime.value = 0.57

    this.fb1 = ctx.createGain()
    this.fb1.gain.value = 0.48
    this.fb2 = ctx.createGain()
    this.fb2.gain.value = 0.43

    this.reverbSend = ctx.createGain()
    this.reverbSend.gain.value = 0.35

    // FM connections
    this.mod1.connect(this.modGain1)
    this.modGain1.connect(this.carrier1.frequency)
    this.mod2.connect(this.modGain2)
    this.modGain2.connect(this.carrier2.frequency)

    // Carrier mix
    this.carrier1.connect(this.carGain1)
    this.carrier2.connect(this.carGain2)

    this.carGain1.connect(this.filter)
    this.carGain2.connect(this.filter)

    this.filter.connect(this.panner)

    // Dry path
    this.panner.connect(this.masterGain)

    // Reverb path
    this.panner.connect(this.reverbSend)
    this.reverbSend.connect(this.delay1)
    this.delay1.connect(this.fb1)
    this.fb1.connect(this.delay1)
    this.fb1.connect(this.masterGain)

    this.reverbSend.connect(this.delay2)
    this.delay2.connect(this.fb2)
    this.fb2.connect(this.delay2)
    this.fb2.connect(this.masterGain)

    this.masterGain.connect(ctx.destination)

    this.carrier1.start()
    this.carrier2.start()
    this.mod1.start()
    this.mod2.start()
  }

  // Called every animation frame with current polynomial parameters
  setOrbitParams(orbitRadius: number, orbitAngle: number, epsilon: number) {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const tau = 0.08

    // Root at origin: fixed fundamental drone
    this.carrier1?.frequency.setTargetAtTime(this.baseFreq, now, tau)
    this.mod1?.frequency.setTargetAtTime(this.baseFreq * 1.5, now, tau)
    const idx1 = this.baseFreq * 1.2
    this.modGain1?.gain.setTargetAtTime(idx1, now, tau)

    // Root at r: frequency ∝ |r|, creates musical interval
    const f2 = this.baseFreq * Math.max(orbitRadius, 0.2)
    this.carrier2?.frequency.setTargetAtTime(f2, now, tau)
    this.mod2?.frequency.setTargetAtTime(f2 * orbitRadius, now, tau)
    const idx2 = f2 * orbitRadius * 1.8
    this.modGain2?.gain.setTargetAtTime(idx2, now, tau)

    // Pan follows orbit angle (gentle left-right movement)
    const pan = Math.sin(orbitAngle) * 0.35
    this.panner?.pan.setTargetAtTime(pan, now, 0.4)

    // Filter cutoff tied to epsilon (more epsilon = brighter)
    const cutoff = 400 + epsilon * 3600
    this.filter?.frequency.setTargetAtTime(cutoff, now, 0.25)

    // Balance between roots: closer roots → more carrier2
    const r2vol = Math.min(orbitRadius / 2.0, 1.0)
    this.carGain1?.gain.setTargetAtTime(0.5, now, tau)
    this.carGain2?.gain.setTargetAtTime(r2vol * 0.5, now, tau)
  }

  setGain(gain: number) {
    this._gain = gain
    if (!this.ctx || !this.masterGain) return
    this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05)
  }

  stop() {
    try {
      this.carrier1?.stop(); this.carrier2?.stop()
      this.mod1?.stop(); this.mod2?.stop()
    } catch (_) { /* already stopped */ }
    this.ctx?.close()
    this.ctx = null
    this.carrier1 = this.carrier2 = null
    this.mod1 = this.mod2 = null
    this.modGain1 = this.modGain2 = null
    this.carGain1 = this.carGain2 = null
    this.masterGain = null
    this.filter = null
    this.panner = null
  }
}
