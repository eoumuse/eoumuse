import type { AudioNode3D } from '../store/synthStore'

export function detectOnsets(buffer: AudioBuffer, maxNodes = 200): AudioNode3D[] {
  const channelData = buffer.getChannelData(0)
  const frameSize = 512
  const numFrames = Math.floor(channelData.length / frameSize)
  const sampleRate = buffer.sampleRate

  // Compute RMS energy per frame
  const energies: number[] = []
  const centroids: number[] = []

  for (let f = 0; f < numFrames; f++) {
    const start = f * frameSize
    let sumSq = 0
    let weightedFreq = 0
    let totalMag = 0

    for (let i = 0; i < frameSize; i++) {
      const sample = channelData[start + i] ?? 0
      sumSq += sample * sample
      // crude spectral centroid proxy: abs value weighted by position in frame
      const mag = Math.abs(sample)
      weightedFreq += mag * (i / frameSize)
      totalMag += mag
    }

    energies.push(Math.sqrt(sumSq / frameSize))
    centroids.push(totalMag > 0 ? weightedFreq / totalMag : 0.5)
  }

  // Normalize energies
  const maxEnergy = Math.max(...energies, 1e-6)
  const normEnergies = energies.map((e) => e / maxEnergy)

  // Find local maxima above threshold as onset candidates
  const threshold = 0.15
  const minFrameGap = Math.floor(sampleRate / frameSize * 0.05) // 50ms min gap

  const onsets: number[] = []
  for (let f = 1; f < numFrames - 1; f++) {
    if (
      normEnergies[f] > threshold &&
      normEnergies[f] > normEnergies[f - 1] &&
      normEnergies[f] >= normEnergies[f + 1]
    ) {
      if (onsets.length === 0 || f - onsets[onsets.length - 1] >= minFrameGap) {
        onsets.push(f)
      }
    }
  }

  // If too few onsets, evenly space them
  if (onsets.length < 10) {
    onsets.length = 0
    const step = Math.floor(numFrames / Math.min(maxNodes, 50))
    for (let f = 0; f < numFrames; f += step) {
      onsets.push(f)
    }
  }

  // Sample down to maxNodes
  const sampled =
    onsets.length > maxNodes
      ? onsets.filter((_, i) => i % Math.ceil(onsets.length / maxNodes) === 0).slice(0, maxNodes)
      : onsets

  // Map to 3D nodes
  const totalDuration = buffer.duration
  const nodes: AudioNode3D[] = sampled.map((frameIdx, i) => {
    const time = (frameIdx * frameSize) / sampleRate
    const energy = normEnergies[frameIdx] ?? 0.5
    const centroid = centroids[frameIdx] ?? 0.5

    // Spread into 3D space
    // X: time position (normalized -2..2)
    const x = (time / totalDuration) * 4 - 2
    // Y: centroid
    const y = (centroid - 0.5) * 3 + Math.sin(i * 0.7) * 0.5
    // Z: energy
    const z = (energy - 0.5) * 2 + Math.cos(i * 0.5) * 0.4

    return {
      id: `node-${i}`,
      time,
      energy,
      centroid,
      x,
      y,
      z,
    }
  })

  return nodes
}
