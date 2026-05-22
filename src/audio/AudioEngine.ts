import { harmonizerEngine } from './HarmonizerEngine'

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

  // Effects nodes (created in ensureContext)
  private filterNode!: BiquadFilterNode
  private delayNode!: DelayNode
  private delayFeedbackNode!: GainNode
  private delayWetNode!: GainNode
  private reverbNode!: ConvolverNode
  private reverbWetNode!: GainNode
  private fxInputGain!: GainNode

  // Effect params
  filterType: BiquadFilterType = 'lowpass'
  filterCutoff: number = 8000
  filterResonance: number = 1
  delayTime: number = 0.25
  delayFeedback: number = 0.3
  delayWet: number = 0
  reverbWet: number = 0

  private nextGrainTime = 0
  private intervalId: ReturnType<typeof setInterval> | null = null
  private _isStarted = false

  // Recording
  private mediaStreamDest!: MediaStreamAudioDestinationNode
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []

  private createImpulseResponse(duration = 2.5, decay = 2.0): AudioBuffer {
    const rate = this.ctx.sampleRate
    const length = Math.floor(rate * duration)
    const ir = this.ctx.createBuffer(2, length, rate)
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    return ir
  }

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGainNode = this.ctx.createGain()
      this.masterGainNode.gain.value = this.masterGain
      this.masterGainNode.connect(this.ctx.destination)

      // fx input gain
      this.fxInputGain = this.ctx.createGain()
      this.fxInputGain.gain.value = 1

      // Filter
      this.filterNode = this.ctx.createBiquadFilter()
      this.filterNode.type = this.filterType
      this.filterNode.frequency.value = this.filterCutoff
      this.filterNode.Q.value = this.filterResonance

      // Delay
      this.delayNode = this.ctx.createDelay(2.0)
      this.delayNode.delayTime.value = this.delayTime
      this.delayFeedbackNode = this.ctx.createGain()
      this.delayFeedbackNode.gain.value = this.delayFeedback
      this.delayWetNode = this.ctx.createGain()
      this.delayWetNode.gain.value = this.delayWet

      // Reverb
      this.reverbNode = this.ctx.createConvolver()
      this.reverbNode.buffer = this.createImpulseResponse()
      this.reverbWetNode = this.ctx.createGain()
      this.reverbWetNode.gain.value = this.reverbWet

      // Routing:
      // fxInputGain → masterGainNode (dry pass-through)
      this.fxInputGain.connect(this.masterGainNode)

      // fxInputGain → filterNode → masterGainNode (filtered dry)
      this.fxInputGain.connect(this.filterNode)
      this.filterNode.connect(this.masterGainNode)

      // filterNode → delayNode → delayWetNode → masterGainNode
      // delayNode → delayFeedbackNode → delayNode (feedback loop)
      this.filterNode.connect(this.delayNode)
      this.delayNode.connect(this.delayFeedbackNode)
      this.delayFeedbackNode.connect(this.delayNode)
      this.delayNode.connect(this.delayWetNode)
      this.delayWetNode.connect(this.masterGainNode)

      // filterNode → reverbNode → reverbWetNode → masterGainNode
      this.filterNode.connect(this.reverbNode)
      this.reverbNode.connect(this.reverbWetNode)
      this.reverbWetNode.connect(this.masterGainNode)

      // MediaStream destination for recording
      this.mediaStreamDest = this.ctx.createMediaStreamDestination()
      this.masterGainNode.connect(this.mediaStreamDest)

      // Wire harmonizer to this context
      harmonizerEngine.init(this.ctx, this.masterGainNode)
    }
  }

  startRecording(): void {
    if (!this.mediaStreamDest) return
    this.recordedChunks = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm'
    this.mediaRecorder = new MediaRecorder(this.mediaStreamDest.stream, { mimeType })
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data)
    }
    this.mediaRecorder.start(100) // collect chunks every 100ms
  }

  stopRecording(): void {
    if (!this.mediaRecorder) return
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `grainweaver-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
    this.mediaRecorder.stop()
    this.mediaRecorder = null
  }

  setFilterCutoff(v: number): void {
    this.filterCutoff = v
    if (this.filterNode) {
      this.filterNode.frequency.setTargetAtTime(v, this.ctx.currentTime, 0.01)
    }
  }

  setFilterResonance(v: number): void {
    this.filterResonance = v
    if (this.filterNode) {
      this.filterNode.Q.setTargetAtTime(v, this.ctx.currentTime, 0.01)
    }
  }

  setFilterType(t: BiquadFilterType): void {
    this.filterType = t
    if (this.filterNode) {
      this.filterNode.type = t
    }
  }

  setDelayTime(v: number): void {
    this.delayTime = v
    if (this.delayNode) {
      this.delayNode.delayTime.setTargetAtTime(v, this.ctx.currentTime, 0.01)
    }
  }

  setDelayFeedback(v: number): void {
    this.delayFeedback = v
    if (this.delayFeedbackNode) {
      this.delayFeedbackNode.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01)
    }
  }

  setDelayWet(v: number): void {
    this.delayWet = v
    if (this.delayWetNode) {
      this.delayWetNode.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01)
    }
  }

  setReverbWet(v: number): void {
    this.reverbWet = v
    if (this.reverbWetNode) {
      this.reverbWetNode.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01)
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

    // Tick harmonizer voices
    harmonizerEngine.tick(
      this.position,
      this.pitch,
      this.grainSize,
      this.density,
      this.scatter,
    )

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
      panner.connect(this.fxInputGain)

      const interval = 1 / Math.max(this.density, 0.5)
      const jitter = (Math.random() - 0.5) * 0.01
      this.nextGrainTime += interval + jitter
    }
  }
}

export const audioEngine = new AudioEngine()
