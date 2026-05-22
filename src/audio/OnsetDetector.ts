import type { AudioNode3D } from '../store/synthStore'

export function detectOnsets(buffer: AudioBuffer, maxNodes = 200): AudioNode3D[] {
  const channelData = buffer.getChannelData(0)
  const sampleRate  = buffer.sampleRate
  const duration    = buffer.duration

  // --- Performance: for long samples, skip frames to stay fast ---
  // Target: analyse at most ~8000 frames regardless of file length.
  const baseFrame  = 512
  const totalRaw   = Math.floor(channelData.length / baseFrame)
  const skipEvery  = Math.max(1, Math.ceil(totalRaw / 8000))
  const frameSize  = baseFrame * skipEvery   // effective frame size
  const numFrames  = Math.floor(channelData.length / frameSize)

  // RMS energy + crude spectral centroid per frame
  const energies: number[]  = new Array(numFrames)
  const centroids: number[] = new Array(numFrames)

  for (let f = 0; f < numFrames; f++) {
    const start = f * frameSize
    let sumSq = 0, weightedFreq = 0, totalMag = 0

    for (let i = 0; i < frameSize; i++) {
      const s = channelData[start + i] ?? 0
      sumSq        += s * s
      const mag     = Math.abs(s)
      weightedFreq += mag * (i / frameSize)
      totalMag     += mag
    }

    energies[f]  = Math.sqrt(sumSq / frameSize)
    centroids[f] = totalMag > 0 ? weightedFreq / totalMag : 0.5
  }

  // Normalise — avoid spread operator on large arrays (stack overflow risk)
  let maxEnergy = 1e-6
  for (let i = 0; i < numFrames; i++) if (energies[i] > maxEnergy) maxEnergy = energies[i]
  const normEnergies = energies.map((e) => e / maxEnergy)

  // Local maxima above threshold
  const threshold   = 0.15
  const minFrameGap = Math.max(1, Math.floor(sampleRate / frameSize * 0.05))

  const onsets: number[] = []
  for (let f = 1; f < numFrames - 1; f++) {
    if (
      normEnergies[f] > threshold &&
      normEnergies[f] > normEnergies[f - 1] &&
      normEnergies[f] >= normEnergies[f + 1] &&
      (onsets.length === 0 || f - onsets[onsets.length - 1] >= minFrameGap)
    ) {
      onsets.push(f)
    }
  }

  // Fallback: evenly spaced if too few onsets
  if (onsets.length < 10) {
    onsets.length = 0
    const step = Math.max(1, Math.floor(numFrames / Math.min(maxNodes, 50)))
    for (let f = 0; f < numFrames; f += step) onsets.push(f)
  }

  // Downsample to maxNodes
  const sampled =
    onsets.length > maxNodes
      ? onsets.filter((_, i) => i % Math.ceil(onsets.length / maxNodes) === 0).slice(0, maxNodes)
      : onsets

  // Map to 3D AudioNode3D
  return sampled.map((frameIdx, i) => {
    const time     = (frameIdx * frameSize) / sampleRate
    const energy   = normEnergies[frameIdx] ?? 0.5
    const centroid = centroids[frameIdx]    ?? 0.5

    return {
      id:       `node-${i}`,
      time,
      energy,
      centroid,
      x: (time / duration) * 4 - 2,
      y: (centroid - 0.5) * 3 + Math.sin(i * 0.7) * 0.5,
      z: (energy  - 0.5) * 2 + Math.cos(i * 0.5) * 0.4,
    }
  })
}
