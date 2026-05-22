export const SCALES: Record<string, number[]> = {
  'Major':      [0, 2, 4, 5, 7, 9, 11],
  'Minor':      [0, 2, 3, 5, 7, 8, 10],
  'Dorian':     [0, 2, 3, 5, 7, 9, 10],
  'Pentatonic': [0, 2, 4, 7, 9],
  'Chromatic':  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

export const CHORD_MODES: Record<string, number[]> = {
  'Unison': [0],
  '3rd':    [0, 4],
  '5th':    [0, 7],
  'Triad':  [0, 4, 7],
  '7th':    [0, 4, 7, 11],
  'Power':  [0, 7, 12],
  'Octave': [0, 12],
}

interface HarmonizerVoice {
  pitchOffsetSemitones: number
  nextGrainTime: number
}

export class HarmonizerEngine {
  private ctx: AudioContext | null = null
  private buffer: AudioBuffer | null = null
  private masterGainNode: GainNode | null = null
  private voices: HarmonizerVoice[] = []

  enabled = false
  rootSemitone = 0
  chordMode = 'Triad'
  voiceGain = 0.35
  detune = 8

  constructor(ctx?: AudioContext, masterGainNode?: GainNode) {
    if (ctx && masterGainNode) {
      this.ctx = ctx
      this.masterGainNode = masterGainNode
      this.rebuildVoices()
    }
  }

  /** Wire to the AudioEngine after its context is created */
  init(ctx: AudioContext, masterGainNode: GainNode): void {
    this.ctx = ctx
    this.masterGainNode = masterGainNode
    this.rebuildVoices()
  }

  private rebuildVoices(): void {
    const intervals = CHORD_MODES[this.chordMode] ?? [0, 4, 7]
    // Skip first interval (0 = unison, that's the main engine)
    const harmonyIntervals = intervals.slice(1)
    const now = this.ctx ? this.ctx.currentTime : 0
    this.voices = harmonyIntervals.map((semitones) => ({
      pitchOffsetSemitones: semitones,
      nextGrainTime: now + 0.05,
    }))
  }

  setBuffer(buf: AudioBuffer | null): void {
    this.buffer = buf
  }

  setChordMode(mode: string): void {
    this.chordMode = mode
    this.rebuildVoices()
  }

  setVoiceGain(v: number): void {
    this.voiceGain = v
  }

  setDetune(v: number): void {
    this.detune = v
  }

  tick(
    basePosition: number,
    basePitchSemitones: number,
    grainSize: number,
    density: number,
    scatter: number
  ): void {
    if (!this.enabled || !this.buffer || !this.ctx || !this.masterGainNode) return

    const lookahead = 0.1
    const grainSizeSec = grainSize / 1000
    const bufferDuration = this.buffer.duration

    for (const voice of this.voices) {
      const totalSemitones = basePitchSemitones + voice.pitchOffsetSemitones + this.rootSemitone
      const randomDetuneCents = (Math.random() - 0.5) * this.detune * 2
      const playbackRate = Math.pow(2, totalSemitones / 12) * Math.pow(2, randomDetuneCents / 1200)

      if (voice.nextGrainTime < this.ctx.currentTime) {
        voice.nextGrainTime = this.ctx.currentTime + 0.01
      }

      while (voice.nextGrainTime < this.ctx.currentTime + lookahead) {
        const src = this.ctx.createBufferSource()
        src.buffer = this.buffer
        src.playbackRate.value = playbackRate

        const scatterRange = scatter * bufferDuration * 0.1
        const rawOffset =
          basePosition * bufferDuration + (Math.random() - 0.5) * scatterRange
        const safeGrainSize = Math.min(grainSizeSec, bufferDuration * 0.5)
        const offset = Math.max(0, Math.min(rawOffset, bufferDuration - safeGrainSize - 0.001))
        const duration = safeGrainSize

        src.start(voice.nextGrainTime, offset, duration)

        const env = this.ctx.createGain()
        env.gain.setValueAtTime(0, voice.nextGrainTime)
        env.gain.linearRampToValueAtTime(this.voiceGain, voice.nextGrainTime + duration * 0.3)
        env.gain.linearRampToValueAtTime(0, voice.nextGrainTime + duration)

        src.connect(env)
        env.connect(this.masterGainNode)

        const interval = 1 / Math.max(density, 0.5)
        const jitter = (Math.random() - 0.5) * 0.01
        voice.nextGrainTime += interval + jitter
      }
    }
  }

  start(): void {
    this.rebuildVoices()
  }

  stop(): void {
    // Voices stop naturally as they don't schedule new grains
  }
}

export const harmonizerEngine = new HarmonizerEngine()
