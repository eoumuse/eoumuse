import { CHORD_MODES, DEFAULT_PITCH_HARMONY, resolveHarmonyPitch } from './PitchHarmony.ts'
import type { PitchHarmonySettings } from './PitchHarmony.ts'
export { CHORD_MODES, SCALES } from './PitchHarmony.ts'

interface HarmonizerVoice {
  pitchOffsetSemitones: number
  nextGrainTime: number
  panPosition: number   // base pan -1..1 (multiplied by spread)
  detunePhase: number   // current oscillator phase for detune drift
  detuneRate: number    // Hz — how fast the drift oscillates (per voice)
}

export class HarmonizerEngine {
  private ctx: AudioContext | null = null
  private buffer: AudioBuffer | null = null
  private masterGainNode: GainNode | null = null
  private voices: HarmonizerVoice[] = []

  enabled = false
  chordMode = 'Triad'
  voiceGain = 0.35
  detune = 12      // cents — peak detune for oscillation
  spread = 0.85    // stereo spread 0..1

  constructor(ctx?: AudioContext, masterGainNode?: GainNode) {
    if (ctx && masterGainNode) {
      this.ctx = ctx
      this.masterGainNode = masterGainNode
      this.rebuildVoices()
    }
  }

  init(ctx: AudioContext, masterGainNode: GainNode): void {
    this.ctx = ctx
    this.masterGainNode = masterGainNode
    this.rebuildVoices()
  }

  private rebuildVoices(): void {
    const intervals = CHORD_MODES[this.chordMode] ?? [0, 4, 7]
    const harmonyIntervals = intervals.slice(1)   // skip unison (main engine handles that)
    const n   = harmonyIntervals.length
    const now = this.ctx ? this.ctx.currentTime : 0

    this.voices = harmonyIntervals.map((semitones, i) => {
      // Spread voices evenly across the stereo field
      const panPos = n === 0 ? 0 : n === 1 ? 0.55 : -1 + (2 * i / (n - 1))
      return {
        pitchOffsetSemitones: semitones,
        nextGrainTime: now + 0.05 + i * 0.012,   // slight stagger at rebuild
        panPosition:   panPos,
        detunePhase:   Math.random() * Math.PI * 2,
        detuneRate:    0.18 + Math.random() * 0.35, // 0.18–0.53 Hz slow oscillation
      }
    })
  }

  setBuffer(buf: AudioBuffer | null): void { this.buffer = buf }
  setChordMode(mode: string): void { this.chordMode = mode; this.rebuildVoices() }
  setVoiceGain(v: number): void    { this.voiceGain = v }
  setDetune(v: number): void       { this.detune = v }
  setSpread(v: number): void       { this.spread = v }

  tick(
    basePosition: number,
    basePitchSemitones: number,
    grainSize: number,
    density: number,
    scatter: number,
    pitchHarmony: PitchHarmonySettings = DEFAULT_PITCH_HARMONY,
  ): void {
    if (!this.enabled || this.voiceGain <= 0 || !this.buffer || !this.ctx || !this.masterGainNode) return

    const lookahead      = 0.1
    const grainSizeSec   = grainSize / 1000
    const bufferDuration = this.buffer.duration
    const now            = this.ctx.currentTime

    for (const voice of this.voices) {
      // Advance slow detune oscillator (~25ms per tick call)
      voice.detunePhase += voice.detuneRate * 0.025 * Math.PI * 2

      // Oscillating detune + tiny per-grain random flutter
      const driftCents = Math.sin(voice.detunePhase) * this.detune
                       + (Math.random() - 0.5) * Math.min(4, this.detune / 3)

      const totalSemitones = resolveHarmonyPitch(basePitchSemitones, voice.pitchOffsetSemitones, pitchHarmony)
      const playbackRate   = Math.pow(2, totalSemitones / 12) * Math.pow(2, driftCents / 1200)

      if (voice.nextGrainTime < now) voice.nextGrainTime = now + 0.01

      while (voice.nextGrainTime < now + lookahead) {
        const src       = this.ctx.createBufferSource()
        src.buffer      = this.buffer
        src.playbackRate.value = playbackRate

        const scatterRange  = scatter * bufferDuration * 0.1
        const rawOffset     = basePosition * bufferDuration + (Math.random() - 0.5) * scatterRange
        const sourceDuration = Math.min(grainSizeSec, bufferDuration * 0.5) * playbackRate
        const safeSourceDuration = Math.min(sourceDuration, bufferDuration)
        const safeGrainSize = safeSourceDuration / playbackRate
        const offset        = Math.max(0, Math.min(rawOffset, bufferDuration - safeSourceDuration))

        src.start(voice.nextGrainTime, offset, safeSourceDuration)

        // Smooth bloom envelope (exponential → less click, more shimmer)
        const env = this.ctx.createGain()
        const t0  = voice.nextGrainTime
        const t1  = t0 + safeGrainSize
        env.gain.setValueAtTime(0.0001, t0)
        env.gain.exponentialRampToValueAtTime(this.voiceGain, t0 + safeGrainSize * 0.2)
        env.gain.exponentialRampToValueAtTime(0.0001, t1)

        // Stereo panner — each voice at its own position in the field
        const panner       = this.ctx.createStereoPanner()
        panner.pan.value   = voice.panPosition * this.spread

        src.connect(env)
        env.connect(panner)
        panner.connect(this.masterGainNode!)
        src.onended = () => { src.disconnect(); env.disconnect(); panner.disconnect() }

        const interval = 1 / Math.max(density, 0.5)
        const jitter   = (Math.random() - 0.5) * 0.015
        voice.nextGrainTime += interval + jitter
      }
    }
  }

  start(): void { this.rebuildVoices() }
  stop():  void { /* grains stop naturally */ }
}

export const harmonizerEngine = new HarmonizerEngine()
