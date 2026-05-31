import { audioEngine } from './AudioEngine'

export type SlinkPreset = 'trance' | 'wobble' | 'sweep' | 'snake' | 'random'

const PRESETS: Record<Exclude<SlinkPreset, 'random'>, number[]> = {
  trance: [1.0, 0.05, 0.72, 0.05, 1.0, 0.05, 0.72, 0.05, 1.0, 0.05, 0.72, 0.05, 1.0, 0.35, 0.65, 0.05],
  wobble: [0.80, 0.50, 0.90, 0.30, 0.75, 0.20, 1.00, 0.15, 0.85, 0.55, 0.95, 0.35, 0.70, 0.25, 0.95, 0.10],
  sweep:  [0.05, 0.13, 0.22, 0.32, 0.43, 0.55, 0.67, 0.80, 0.92, 1.00, 0.92, 0.80, 0.67, 0.55, 0.43, 0.32],
  snake:  [0.60, 0.80, 0.40, 0.90, 0.20, 0.75, 0.50, 1.00, 0.30, 0.85, 0.45, 0.70, 0.15, 0.60, 0.35, 0.90],
}

export class SlinkGateEngine {
  enabled = false
  bpm = 120
  steps: number[] = [...PRESETS.trance]
  smoothing = 0.35
  depth = 0.65
  baseFreq = 2000
  division = 0.25  // beat fraction: 1=quarter, 0.5=eighth, 0.25=sixteenth

  private currentStep = 0
  private nextStepTime = -1
  private timerId: ReturnType<typeof setInterval> | null = null
  onStep: ((step: number) => void) | null = null

  loadPreset(name: SlinkPreset): number[] {
    if (name === 'random') return Array.from({ length: 16 }, () => Math.random())
    return [...PRESETS[name]]
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
    const ctx = audioEngine.ctx
    if (!ctx) return

    if (this.nextStepTime < 0) this.nextStepTime = ctx.currentTime

    const stepDuration = (60 / this.bpm) * this.division
    const lookahead = 0.025

    while (this.nextStepTime < ctx.currentTime + lookahead) {
      this.fireStep(this.currentStep, this.nextStepTime)
      this.currentStep = (this.currentStep + 1) % this.steps.length
      this.nextStepTime += stepDuration
    }
  }

  private fireStep(step: number, time: number) {
    const val = this.steps[step] ?? 0.5
    const logMin = Math.log2(80)
    const logMax = Math.log2(18000)
    const logBase = Math.log2(Math.max(80, Math.min(18000, this.baseFreq)))
    const halfRange = (logMax - logMin) * this.depth * 0.5
    const logFreq = logBase + (val - 0.5) * 2 * halfRange
    const freq = Math.pow(2, Math.max(logMin, Math.min(logMax, logFreq)))
    const tc = 0.001 + this.smoothing * 0.299
    audioEngine.setFilterCutoffScheduled(freq, time, tc)

    const ctx = audioEngine.ctx
    const delay = Math.max(0, (time - ctx.currentTime) * 1000)
    setTimeout(() => this.onStep?.(step), delay)
  }
}

export const slinkGateEngine = new SlinkGateEngine()
