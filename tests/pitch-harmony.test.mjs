import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { AudioEngine } from '../src/audio/AudioEngine.ts'
import { harmonizerEngine } from '../src/audio/HarmonizerEngine.ts'
import {
  CHORD_MODES, SCALES, DEFAULT_PITCH_HARMONY, pitchClass,
  resolveGrainPitch, resolveHarmonyPitch,
} from '../src/audio/PitchHarmony.ts'

const settings = (patch = {}) => ({ ...DEFAULT_PITCH_HARMONY, mode: 'scale', ...patch })
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)

test('FREE preserves fractional transposition and the existing two-octave bounds', () => {
  for (const shift of [-24, -7.3, -0.4, 0, 0.8, 12.25, 24]) {
    near(resolveGrainPitch(shift, DEFAULT_PITCH_HARMONY), shift)
  }
  assert.equal(resolveGrainPitch(-30, DEFAULT_PITCH_HARMONY), -24)
  assert.equal(resolveGrainPitch(30, DEFAULT_PITCH_HARMONY), 24)
})

test('major scale crosses zero and both octave boundaries correctly', () => {
  const inputs = [-24, -13, -12, -11, -1, 0, 1, 3, 6, 10, 11, 12, 13, 23, 24]
  const expected = [-24, -13, -12, -12, -1, 0, 0, 2, 5, 9, 11, 12, 12, 23, 24]
  assert.deepEqual(inputs.map((p) => resolveGrainPitch(p, settings())), expected)
})

test('source reference and target root are independent, including non-C samples', () => {
  const tuning = settings({ sourceNote: 9 }) // A sample, C major target
  assert.deepEqual([0, 1, 2, 3, -1, -2].map((p) => resolveGrainPitch(p, tuning)), [0, 0, 2, 3, -2, -2])
  const dMinor = settings({ sourceNote: 9, rootNote: 2, scale: 'Minor' })
  assert.equal(resolveGrainPitch(1, dMinor), 1) // A -> Bb, not B
  assert.equal(resolveGrainPitch(3, dMinor), 3) // A -> C
})

test('every scale/chord, source note and root stays in tune and finds the nearest bounded note', () => {
  for (const mode of ['scale', 'chord']) {
    for (const [name, intervals] of Object.entries(mode === 'scale' ? SCALES : CHORD_MODES)) {
      for (let sourceNote = 0; sourceNote < 12; sourceNote++) {
        for (let rootNote = 0; rootNote < 12; rootNote++) {
          const tuning = settings({ mode, sourceNote, rootNote, scale: name, chordMode: name })
          const allowed = new Set(intervals.map((i) => pitchClass(rootNote + i)))
          const candidates = Array.from({ length: 49 }, (_, i) => i - 24)
            .filter((shift) => allowed.has(pitchClass(sourceNote + shift)))
          let last = -Infinity
          for (let input = -24; input <= 24; input += 0.25) {
            const result = resolveGrainPitch(input, tuning)
            assert.ok(result >= -24 && result <= 24)
            assert.ok(allowed.has(pitchClass(sourceNote + result)))
            assert.ok(result >= last, 'ascending motion must not reverse')
            const minimum = Math.min(...candidates.map((c) => Math.abs(c - input)))
            near(Math.abs(result - input), minimum)
            near(resolveGrainPitch(result, tuning), result)
            last = result
          }
        }
      }
    }
  }
})

test('harmony voices follow the target scale/chord rather than adding out-of-key fixed thirds', () => {
  const cMajor = settings()
  // D -> F / A, B -> D / F (diatonic minor and diminished triads).
  assert.deepEqual([4, 7].map((i) => resolveHarmonyPitch(2, i, cMajor)), [5, 9])
  assert.deepEqual([4, 7].map((i) => resolveHarmonyPitch(11, i, cMajor)), [14, 17])
  const chord = settings({ mode: 'chord', chordMode: 'Triad' })
  for (let base = -24; base <= 24; base++) {
    for (const i of CHORD_MODES.Triad) {
      const voice = resolveHarmonyPitch(resolveGrainPitch(base, chord), i, chord)
      assert.ok([0, 4, 7].includes(pitchClass(voice)))
    }
  }
})

test('manual transpose and attractor offset combine before locking', () => {
  const engine = new AudioEngine()
  engine.pitchHarmony = settings()
  engine.pitch = 3
  engine.pitchModulation = 3.2
  assert.equal(engine.effectivePitch, 7)
  engine.pitchModulation = -6
  assert.equal(engine.effectivePitch, -3)
  engine.pitchModulation = 0
  assert.equal(engine.effectivePitch, 2)
  engine.pitchHarmony.mode = 'free'
  assert.equal(engine.effectivePitch, 3)
})

function makeContext() {
  const param = (value = 0) => ({
    value, events: [],
    setValueAtTime(value, time) { this.events.push({ value, time }) },
    linearRampToValueAtTime(value, time) { this.events.push({ value, time }) },
    exponentialRampToValueAtTime(value, time) {
      assert.ok(value > 0)
      this.events.push({ value, time })
    },
  })
  const node = () => ({ connections: [], connect(to) { this.connections.push(to) }, disconnect() {} })
  const context = {
    currentTime: 0,
    sources: [],
    createGain() { return { ...node(), gain: param() } },
    createStereoPanner() { return { ...node(), pan: param() } },
    createBufferSource() {
      const source = { ...node(), playbackRate: param(1), start(...args) { this.started = args } }
      this.sources.push(source)
      return source
    },
  }
  return context
}

function prepareAudio({ pitch = 1, duration = 2, mode = 'scale', harmony = true } = {}) {
  const ctx = makeContext()
  const engine = new AudioEngine()
  engine.ctx = ctx
  engine.buffer = { duration }
  engine.masterGainNode = ctx.createGain()
  engine.fxInputGain = ctx.createGain()
  engine.pitch = pitch
  engine.pitchHarmony = settings({ mode, sourceNote: 9, rootNote: 2, scale: 'Minor' })
  engine._isStarted = true
  engine.nextGrainTime = 0.05
  harmonizerEngine.init(ctx, engine.masterGainNode)
  harmonizerEngine.setBuffer(engine.buffer)
  harmonizerEngine.enabled = harmony
  harmonizerEngine.setChordMode('Triad')
  harmonizerEngine.setDetune(0)
  harmonizerEngine.setVoiceGain(0.35)
  return { ctx, engine }
}

afterEach(() => {
  harmonizerEngine.enabled = false
  harmonizerEngine.setBuffer(null)
})

test('actual main and harmony buffer sources use Bb/D/F rates for an A sample in D minor', () => {
  const { ctx, engine } = prepareAudio()
  engine.scheduleGrains()
  const pitches = ctx.sources.map((src) => 12 * Math.log2(src.playbackRate.value)).sort((a, b) => a - b)
  assert.equal(pitches.length, 3)
  pitches.forEach((pitch, i) => near(pitch, [1, 5, 8][i]))
})

test('pitch lock still reaches the main source when harmony voices are off', () => {
  const { ctx, engine } = prepareAudio({ pitch: 1.4, harmony: false })
  engine.scheduleGrains()
  assert.equal(ctx.sources.length, 1)
  near(12 * Math.log2(ctx.sources[0].playbackRate.value), 1)
})

test('pitched grains stay within short buffers and finish at the envelope end', () => {
  for (const pitch of [-24, 0, 24]) {
    const { ctx, engine } = prepareAudio({ pitch, duration: 0.08 })
    engine.grainSize = 2000
    engine.scheduleGrains()
    for (const source of ctx.sources) {
      const [start, offset, sourceDuration] = source.started
      assert.ok(offset >= 0 && offset + sourceDuration <= engine.buffer.duration + 1e-9)
      const envelopeEnd = source.connections[0].gain.events.at(-1).time
      near(start + sourceDuration / source.playbackRate.value, envelopeEnd)
    }
  }
})

test('zero voice gain is silent and never ramps exponentially to zero', () => {
  const { ctx, engine } = prepareAudio()
  harmonizerEngine.setVoiceGain(0)
  engine.scheduleGrains()
  assert.equal(ctx.sources.length, 1)
})
