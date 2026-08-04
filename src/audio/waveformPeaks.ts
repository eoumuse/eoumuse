export interface WaveformPeaks {
  width: number
  min: Float32Array
  max: Float32Array
  /** Optional RMS envelope (mono abs average) for glow overlays */
  rms: Float32Array
}

let cachedPeaks: WaveformPeaks | null = null
let cachedBuffer: AudioBuffer | null = null

export function getCachedPeaks(): WaveformPeaks | null {
  return cachedPeaks
}

export function clearCachedPeaks(): void {
  cachedPeaks = null
  cachedBuffer = null
}

/** Build min/max (and RMS) peaks for canvas width. Mixes all channels. */
export function buildWaveformPeaks(buffer: AudioBuffer, width: number): WaveformPeaks {
  if (cachedPeaks && cachedBuffer === buffer && cachedPeaks.width === width) {
    return cachedPeaks
  }

  const nCh = buffer.numberOfChannels
  const len = buffer.length
  const step = Math.max(1, Math.ceil(len / width))
  const min = new Float32Array(width)
  const max = new Float32Array(width)
  const rms = new Float32Array(width)

  const channels: Float32Array[] = []
  for (let ch = 0; ch < nCh; ch++) channels.push(buffer.getChannelData(ch))

  for (let i = 0; i < width; i++) {
    let lo = 1
    let hi = -1
    let absSum = 0
    const base = i * step
    const count = Math.min(step, len - base)
    for (let j = 0; j < count; j++) {
      let s = 0
      for (let ch = 0; ch < nCh; ch++) s += channels[ch][base + j] ?? 0
      const v = s / nCh
      if (v < lo) lo = v
      if (v > hi) hi = v
      absSum += Math.abs(v)
    }
    min[i] = lo
    max[i] = hi
    rms[i] = count > 0 ? absSum / count : 0
  }

  cachedPeaks = { width, min, max, rms }
  cachedBuffer = buffer
  return cachedPeaks
}

export function drawPeaksStroke(
  ctx: CanvasRenderingContext2D,
  peaks: WaveformPeaks,
  height: number,
  startI: number,
  endI: number,
  strokeStyle: string,
) {
  const amp = height / 2
  const { min, max } = peaks
  ctx.beginPath()
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = 1
  let first = true
  for (let i = startI; i < endI; i++) {
    const y1 = (1 + min[i]) * amp
    const y2 = (1 + max[i]) * amp
    if (first) {
      ctx.moveTo(i, y1)
      first = false
    } else {
      ctx.lineTo(i, y1)
      ctx.lineTo(i, y2)
    }
  }
  ctx.stroke()
}
