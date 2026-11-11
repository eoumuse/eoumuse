export const SCALES: Record<string, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Pentatonic: [0, 2, 4, 7, 9],
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

export const CHORD_MODES: Record<string, number[]> = {
  Unison: [0],
  Oct: [0, 12],
  '5th': [0, 7],
  Power: [0, 7, 12],
  Triad: [0, 4, 7],
  Min: [0, 3, 7],
  '7th': [0, 4, 7, 11],
  Min7: [0, 3, 7, 10],
  '9th': [0, 4, 7, 14],
  Sus4: [0, 5, 7],
  Stack4: [0, 5, 10, 15],
  Shimmer: [0, 12, 19, 24],
}

export type PitchLockMode = 'free' | 'scale' | 'chord'

export interface PitchHarmonySettings {
  mode: PitchLockMode
  sourceNote: number // Reference pitch class of the sample, NOT its detected key.
  rootNote: number   // Target key/chord root, 0 = C.
  scale: string
  chordMode: string
}

export const DEFAULT_PITCH_HARMONY: PitchHarmonySettings = {
  mode: 'free', sourceNote: 0, rootNote: 0, scale: 'Major', chordMode: 'Triad',
}

export function pitchClass(note: number): number {
  return ((note % 12) + 12) % 12
}

/** Snap the resulting note, then convert back to a playback-rate offset.
 * A source at A shifted by +2 is B, not D. Negative octaves use floor,
 * not truncation. Equidistant notes consistently choose the lower note.
 */
export function quantizePitchShift(
  shift: number,
  settings: PitchHarmonySettings,
  min = -Infinity,
  max = Infinity,
): number {
  const bounded = Math.max(min, Math.min(max, shift))
  if (settings.mode === 'free') return bounded

  const intervals = settings.mode === 'chord'
    ? CHORD_MODES[settings.chordMode] ?? CHORD_MODES.Unison
    : SCALES[settings.scale] ?? SCALES.Major
  const classes = [...new Set(intervals.map(pitchClass))].sort((a, b) => a - b)
  const absoluteNote = settings.sourceNote + bounded
  const octave = Math.floor((absoluteNote - settings.rootNote) / 12)
  let closest = bounded
  let distance = Infinity

  for (let oct = octave - 1; oct <= octave + 1; oct++) {
    for (const interval of classes) {
      const candidate = settings.rootNote + oct * 12 + interval - settings.sourceNote
      // Bound candidates, not the snapped result: clamping afterwards can
      // introduce a note outside the scale at the +/-24 st limits.
      if (candidate < min || candidate > max) continue
      const d = Math.abs(candidate - bounded)
      if (d < distance - 1e-9 || (Math.abs(d - distance) < 1e-9 && candidate < closest)) {
        closest = candidate
        distance = d
      }
    }
  }
  return closest
}

export function resolveGrainPitch(shift: number, settings: PitchHarmonySettings): number {
  return quantizePitchShift(shift, settings, -24, 24)
}

export function resolveHarmonyPitch(
  basePitch: number, interval: number, settings: PitchHarmonySettings,
): number {
  return quantizePitchShift(basePitch + interval, settings)
}
