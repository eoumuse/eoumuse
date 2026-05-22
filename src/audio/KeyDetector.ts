export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Krumhansl-Schmuckler major/minor profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

export interface KeyResult {
  root: number         // 0=C, 1=C#, ... 11=B
  mode: 'major' | 'minor'
  confidence: number   // 0-1
  name: string         // e.g. "C Major"
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length
  const meanA = a.reduce((s, v) => s + v, 0) / n
  const meanB = b.reduce((s, v) => s + v, 0) / n

  let num = 0
  let denomA = 0
  let denomB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num += da * db
    denomA += da * da
    denomB += db * db
  }

  const denom = Math.sqrt(denomA * denomB)
  return denom === 0 ? 0 : num / denom
}

export function detectKey(buffer: AudioBuffer): KeyResult {
  // Mix down to mono
  const length = buffer.length
  const mono = new Float32Array(length)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / buffer.numberOfChannels
    }
  }

  const sampleRate = buffer.sampleRate
  const frameSize = 2048
  const hopSize = 512
  const chroma = new Array(12).fill(0)

  // For each frame, compute FFT-based chroma
  // We use a simple DFT for the relevant frequency bins
  const numFrames = Math.floor((length - frameSize) / hopSize)

  // Frequency of each note class (relative to C4 = 261.63 Hz)
  // We'll scan pitch classes across multiple octaves
  const A4 = 440
  const C0 = A4 * Math.pow(2, -4.75) // C0 in Hz

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize

    // Apply Hann window and compute energy at frequencies corresponding to each pitch class
    for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
      let energy = 0

      // Sum energy across 5 octaves (C2-C6) for this pitch class
      for (let octave = 2; octave <= 6; octave++) {
        const freq = C0 * Math.pow(2, octave + pitchClass / 12)
        if (freq > sampleRate / 2) continue

        // Goertzel algorithm for single frequency
        const omega = (2 * Math.PI * freq) / sampleRate
        const coeff = 2 * Math.cos(omega)
        let q1 = 0
        let q2 = 0

        for (let n = 0; n < frameSize; n++) {
          const sample = mono[offset + n] ?? 0
          // Apply Hann window
          const win = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (frameSize - 1)))
          const q0 = coeff * q1 - q2 + sample * win
          q2 = q1
          q1 = q0
        }

        // Power at this frequency
        const power = q1 * q1 + q2 * q2 - q1 * q2 * coeff
        energy += Math.max(0, power)
      }

      chroma[pitchClass] += energy
    }
  }

  // Normalize chroma
  const maxChroma = Math.max(...chroma)
  const normalizedChroma = maxChroma > 0 ? chroma.map(v => v / maxChroma) : chroma

  // Correlate with all 24 key profiles (12 major + 12 minor)
  let bestCorr = -Infinity
  let bestRoot = 0
  let bestMode: 'major' | 'minor' = 'major'
  const allCorrs: number[] = []

  for (let root = 0; root < 12; root++) {
    // Rotate chroma to align with this root
    const rotated = Array.from({ length: 12 }, (_, i) => normalizedChroma[(i + root) % 12])

    const majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE)
    const minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE)

    allCorrs.push(majorCorr, minorCorr)

    if (majorCorr > bestCorr) {
      bestCorr = majorCorr
      bestRoot = root
      bestMode = 'major'
    }
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr
      bestRoot = root
      bestMode = 'minor'
    }
  }

  // Confidence: normalize best correlation against range
  const minCorr = Math.min(...allCorrs)
  const maxCorr = Math.max(...allCorrs)
  const confidence = maxCorr > minCorr ? (bestCorr - minCorr) / (maxCorr - minCorr) : 0.5

  const modeName = bestMode === 'major' ? 'Major' : 'Minor'
  return {
    root: bestRoot,
    mode: bestMode,
    confidence: Math.max(0, Math.min(1, confidence)),
    name: `${NOTE_NAMES[bestRoot]} ${modeName}`,
  }
}
