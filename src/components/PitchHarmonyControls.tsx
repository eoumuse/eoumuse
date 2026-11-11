import { useSynthStore } from '../store/synthStore'
import { NOTE_NAMES } from '../audio/KeyDetector'
import { CHORD_MODES, SCALES, pitchClass, resolveGrainPitch } from '../audio/PitchHarmony'
import type { PitchLockMode } from '../audio/PitchHarmony'
import './PitchHarmonyControls.css'

const MODES: PitchLockMode[] = ['free', 'scale', 'chord']

export function PitchHarmonyControls() {
  const mode = useSynthStore((s) => s.pitchLockMode)
  const sourceNote = useSynthStore((s) => s.sourceNote)
  const rootNote = useSynthStore((s) => s.harmonyRoot)
  const scale = useSynthStore((s) => s.harmonyScale)
  const chordMode = useSynthStore((s) => s.harmonizerChordMode)
  const pitch = useSynthStore((s) => s.pitch)
  const modulation = useSynthStore((s) =>
    s.attractorLinked && s.isPlaying ? s.attractorVortexPitch : 0)
  const setMode = useSynthStore((s) => s.setPitchLockMode)
  const setSourceNote = useSynthStore((s) => s.setSourceNote)
  const setRootNote = useSynthStore((s) => s.setHarmonyRoot)
  const setScale = useSynthStore((s) => s.setHarmonyScale)
  const setChordMode = useSynthStore((s) => s.setHarmonizerChordMode)
  const setPitch = useSynthStore((s) => s.setPitch)

  const output = resolveGrainPitch(pitch + modulation, { mode, sourceNote, rootNote, scale, chordMode })
  const noteName = NOTE_NAMES[pitchClass(sourceNote + output)]
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)} st`

  return (
    <section className="pitch-harmony" aria-label="Pitch harmony">
      <div className="pitch-harmony-heading">PITCH LOCK</div>
      <div className="pitch-lock-modes" role="group" aria-label="Pitch lock mode">
        {MODES.map((value) => (
          <button key={value} type="button" aria-pressed={mode === value}
            onClick={() => setMode(value)}>{value.toUpperCase()}</button>
        ))}
      </div>

      <div className="pitch-harmony-fields">
        <label>
          SOURCE NOTE
          <select aria-label="Source note" value={sourceNote}
            onChange={(e) => setSourceNote(Number(e.target.value))}>
            {NOTE_NAMES.map((name, value) => <option key={name} value={value}>{name}</option>)}
          </select>
        </label>
        <label>
          TARGET ROOT
          <select aria-label="Target root" value={rootNote}
            onChange={(e) => setRootNote(Number(e.target.value))}>
            {NOTE_NAMES.map((name, value) => <option key={name} value={value}>{name}</option>)}
          </select>
        </label>
        <label className="pitch-harmony-wide">
          {mode === 'chord' ? 'CHORD' : 'SCALE'}
          {mode === 'chord' ? (
            <select aria-label="Target chord" value={chordMode}
              onChange={(e) => setChordMode(e.target.value)}>
              {Object.keys(CHORD_MODES).map((name) => <option key={name}>{name}</option>)}
            </select>
          ) : (
            <select aria-label="Target scale" value={scale}
              onChange={(e) => setScale(e.target.value)}>
              {Object.keys(SCALES).map((name) => <option key={name}>{name}</option>)}
            </select>
          )}
        </label>
      </div>

      <label className="pitch-transpose">
        <span>TRANSPOSE <span>{signed(pitch)}</span></span>
        <input type="range" aria-label="Pitch transpose" min={-24} max={24} step={0.1}
          value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
      </label>
      <div className="pitch-harmony-output">
        OUT
        <output aria-label="Output pitch">
          {mode === 'free' ? signed(output) : `${noteName} · ${signed(output)}`}
        </output>
      </div>
      <p className="pitch-harmony-help">
        Set SOURCE NOTE to the sample’s reference note. Lock follows the knob and
        attractor, even with harmony voices off. Chords and noise are transposed as a whole.
      </p>
    </section>
  )
}
