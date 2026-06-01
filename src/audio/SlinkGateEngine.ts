import { audioEngine } from './AudioEngine'

export type SlinkPreset = 'trance' | 'wobble' | 'sweep' | 'snake' | 'random'

const PRESETS: Record<Exclude<SlinkPreset, 'random'>, number[]> = {
  trance: [1.0, 0.05, 0.72, 0.05, 1.0, 0.05, 0.72, 0.05, 1.0, 0.05, 0.72, 0.05, 1.0, 0.35, 0.65, 0.05],
  wobble: [0.80, 0.50, 0.90, 0.30, 0.75, 0.20, 1.00, 0.15, 0.85, 0.55, 0.95, 0.35, 0.70, 0.25, 0.95, 0.10],
  sweep:  [0.05, 0.13, 0.22, 0.32, 0.43, 0.55, 0.67, 0.80, 0.92, 1.00, 0.92, 0.80, 0.67, 0.55, 0.43, 0.32],
  snake:  [0.60, 0.80, 0.40, 0.90, 0.20, 0.75, 0.50, 1.00, 0.30, 0.85, 0.45, 0.70, 0.15, 0.60, 0.35, 0.90],
}

// Minimal Web MIDI API types
interface MIDIPort { id: string; name: string | null }
interface MIDIOutput extends MIDIPort { send(data: number[]): void }
interface MIDIAccess { outputs: Map<string, MIDIOutput> }

export interface MidiPortInfo { id: string; name: string }

export class SlinkGateEngine {
  enabled = false
  bpm = 120
  steps: number[] = [...PRESETS.trance]
  smoothing = 0.35
  depth = 0.65
  baseFreq = 2000
  division = 0.25

  midiEnabled = false
  midiCC = 74    // Filter Cutoff (General MIDI)
  midiChannel = 0  // 0-indexed → channel 1

  private currentStep = 0
  private nextStepTime = -1
  private timerId: ReturnType<typeof setInterval> | null = null
  private midiOutput: MIDIOutput | null = null
  private midiAccess: MIDIAccess | null = null

  onStep: ((step: number) => void) | null = null

  loadPreset(name: SlinkPreset): number[] {
    if (name === 'random') return Array.from({ length: 16 }, () => Math.random())
    return [...PRESETS[name]]
  }

  async requestMidi(): Promise<MidiPortInfo[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const access = await (navigator as any).requestMIDIAccess({ sysex: false }) as MIDIAccess
      this.midiAccess = access
      return this.listOutputs()
    } catch {
      return []
    }
  }

  listOutputs(): MidiPortInfo[] {
    if (!this.midiAccess) return []
    return Array.from(this.midiAccess.outputs.values()).map(o => ({
      id: o.id,
      name: o.name ?? o.id,
    }))
  }

  selectOutput(id: string | null) {
    if (!id || !this.midiAccess) {
      this.midiOutput = null
      return
    }
    this.midiOutput = this.midiAccess.outputs.get(id) ?? null
  }

  start() {
    if (this.timerId !== null) return
    this.currentStep = 0
    this.nextStepTime = -1
    this.timerId = setInterval(() => this.tick(), 5)
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

  private tick() {
    if (!this.enabled) return

    // MIDI-only mode: no Web Audio context needed
    if (this.midiEnabled && !audioEngine.ctx) {
      const now = performance.now() / 1000
      if (this.nextStepTime < 0) this.nextStepTime = now
      const stepDuration = (60 / this.bpm) * this.division
      while (this.nextStepTime < now + 0.025) {
        this.fireStepMidi(this.currentStep)
        this.currentStep = (this.currentStep + 1) % this.steps.length
        this.nextStepTime += stepDuration
      }
      return
    }

    const ctx = audioEngine.ctx
    if (!ctx) return
    if (this.nextStepTime < 0) this.nextStepTime = ctx.currentTime
    const stepDuration = (60 / this.bpm) * this.division
    while (this.nextStepTime < ctx.currentTime + 0.025) {
      this.fireStep(this.currentStep, this.nextStepTime)
      this.currentStep = (this.currentStep + 1) % this.steps.length
      this.nextStepTime += stepDuration
    }
  }

  private fireStepMidi(step: number) {
    const val = this.steps[step] ?? 0.5
    this.sendMidiCC(val)
    this.onStep?.(step)
  }

  private fireStep(step: number, time: number) {
    const val = this.steps[step] ?? 0.5

    // Web Audio filter
    const logMin = Math.log2(80)
    const logMax = Math.log2(18000)
    const logBase = Math.log2(Math.max(80, Math.min(18000, this.baseFreq)))
    const halfRange = (logMax - logMin) * this.depth * 0.5
    const logFreq = logBase + (val - 0.5) * 2 * halfRange
    const freq = Math.pow(2, Math.max(logMin, Math.min(logMax, logFreq)))
    const tc = 0.001 + this.smoothing * 0.299
    audioEngine.setFilterCutoffScheduled(freq, time, tc)

    // MIDI CC
    if (this.midiEnabled && this.midiOutput) {
      this.sendMidiCC(val)
    }

    const ctx = audioEngine.ctx
    const delay = Math.max(0, (time - ctx.currentTime) * 1000)
    setTimeout(() => this.onStep?.(step), delay)
  }

  private sendMidiCC(val: number) {
    if (!this.midiOutput) return
    const cc = Math.round(val * 127)
    const status = 0xB0 | (this.midiChannel & 0x0F)
    this.midiOutput.send([status, this.midiCC & 0x7F, cc & 0x7F])
  }
}

export const slinkGateEngine = new SlinkGateEngine()
