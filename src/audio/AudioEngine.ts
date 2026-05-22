export class AudioEngine {
  ctx!: AudioContext
  buffer: AudioBuffer | null = null
  masterGainNode!: GainNode

  grainSize = 150 // ms
  density = 8 // grains/sec
  pitch = 0 // semitones
  position = 0.5 // 0-1
  scatter = 0.2 // 0-1
  panSpread = 0.4 // 0-1
  masterGain = 0.7

  private nextGrainTime = 0
  private intervalId: ReturnType<typeof setInterval> | null = null
  private _isStarted = false

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGainNode = this.ctx.createGain()
      this.masterGainNode.gain.value = this.masterGain
      this.masterGainNode.connect(this.ctx.destination)
    }
  }

  async loadFile(file: File): Promise<void> {
    this.ensureContext()
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
    const arrayBuffer = await file.arrayBuffer()
    this.buffer = await this.ctx.decodeAudioData(arrayBuffer)
  }

  start(): void {
    if (this._isStarted) return
    this.ensureContext()
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    this._isStarted = true
    this.nextGrainTime = this.ctx.currentTime + 0.05
    this.intervalId = setInterval(() => this.scheduleGrains(), 25)
  }

  stop(): void {
    if (!this._isStarted) return
    this._isStarted = false
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  setMasterGain(v: number) {
    this.masterGain = v
    if (this.masterGainNode) {
      this.masterGainNode.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01)
    }
  }

  private scheduleGrains(): void {
    if (!this.buffer || !this._isStarted) return

    const lookahead = 0.1
    const grainSizeSec = this.grainSize / 1000
    const bufferDuration = this.buffer.duration

    while (this.nextGrainTime < this.ctx.currentTime + lookahead) {
      const src = this.ctx.createBufferSource()
      src.buffer = this.buffer
      src.playbackRate.value = Math.pow(2, this.pitch / 12)

      const scatterRange = this.scatter * bufferDuration * 0.1
      const rawOffset =
        this.position * bufferDuration + (Math.random() - 0.5) * scatterRange

      const safeGrainSize = Math.min(grainSizeSec, bufferDuration * 0.5)
      const offset = Math.max(0, Math.min(rawOffset, bufferDuration - safeGrainSize - 0.001))
      const duration = safeGrainSize

      src.start(this.nextGrainTime, offset, duration)

      // Hanning-like window envelope
      const env = this.ctx.createGain()
      env.gain.setValueAtTime(0, this.nextGrainTime)
      env.gain.linearRampToValueAtTime(1, this.nextGrainTime + duration * 0.3)
      env.gain.linearRampToValueAtTime(0, this.nextGrainTime + duration)

      const panner = this.ctx.createStereoPanner()
      panner.pan.value = (Math.random() - 0.5) * this.panSpread * 2

      src.connect(env)
      env.connect(panner)
      panner.connect(this.masterGainNode)

      const interval = 1 / Math.max(this.density, 0.5)
      const jitter = (Math.random() - 0.5) * 0.01
      this.nextGrainTime += interval + jitter
    }
  }
}

export const audioEngine = new AudioEngine()
