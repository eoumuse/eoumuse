import { create } from 'zustand'
import type { AttractorType } from '../audio/AttractorEngine'

export interface AudioNode3D {
  id: string
  time: number
  energy: number
  centroid: number
  x: number
  y: number
  z: number
}

interface SynthState {
  isPlaying: boolean
  audioLoaded: boolean
  fileName: string
  nodes: AudioNode3D[]
  currentNodeIndex: number

  // Grain params (attractor overrides position/pitch/grainSize when linked)
  grainSize: number      // ms 10–2000
  density: number        // grains/sec 1–100
  pitch: number          // semitones -24..+24
  position: number       // 0–1
  scatter: number        // 0–1
  panSpread: number      // 0–1
  masterGain: number     // 0–1

  // Attractor
  attractorType: AttractorType
  attractorLinked: boolean  // when true, attractor drives position/pitch/grainSize
  attractorSpeed: number    // 0.1–4
  attractorP1: number
  attractorP2: number
  attractorP3: number

  // Live attractor state (normalized 0..1) for display
  attractorNX: number
  attractorNY: number
  attractorNZ: number

  // Vortex pitch settings
  semitonesPerOrbit: number  // semitones added per full orbit (1–24)
  pitchWrap: boolean         // true = Shepard-tone wrap, false = clamp at ±24

  setSemitonesPerOrbit: (v: number) => void
  setPitchWrap: (v: boolean) => void

  // Effects
  filterCutoff: number
  filterResonance: number
  filterType: string
  delayTime: number
  delayFeedback: number
  delayWet: number
  reverbWet: number

  // Harmonizer
  harmonizerEnabled: boolean
  harmonizerChordMode: string
  harmonizerVoiceGain: number
  harmonizerDetune: number

  // Key detection
  detectedKey: string
  detectedKeyConfidence: number

  // Effects setters
  setFilterCutoff: (v: number) => void
  setFilterResonance: (v: number) => void
  setFilterType: (v: string) => void
  setDelayTime: (v: number) => void
  setDelayFeedback: (v: number) => void
  setDelayWet: (v: number) => void
  setReverbWet: (v: number) => void

  // Harmonizer setters
  setHarmonizerEnabled: (v: boolean) => void
  setHarmonizerChordMode: (v: string) => void
  setHarmonizerVoiceGain: (v: number) => void
  setHarmonizerDetune: (v: number) => void

  // Key detection setters
  setDetectedKey: (key: string, confidence: number) => void

  // Actions
  setGrainSize: (v: number) => void
  setDensity: (v: number) => void
  setPitch: (v: number) => void
  setPosition: (v: number) => void
  setScatter: (v: number) => void
  setPanSpread: (v: number) => void
  setMasterGain: (v: number) => void
  setPlaying: (v: boolean) => void
  setNodes: (nodes: AudioNode3D[]) => void
  setCurrentNode: (i: number) => void
  setAudioLoaded: (v: boolean, fileName?: string) => void
  setAttractorType: (t: AttractorType) => void
  setAttractorLinked: (v: boolean) => void
  setAttractorSpeed: (v: number) => void
  setAttractorP1: (v: number) => void
  setAttractorP2: (v: number) => void
  setAttractorP3: (v: number) => void
  attractorVortexPitch: number  // live vortex pitch in semitones (-24..+24)
  setAttractorState: (nx: number, ny: number, nz: number, vortexPitch?: number) => void
}

export const useSynthStore = create<SynthState>((set) => ({
  isPlaying: false,
  audioLoaded: false,
  fileName: '',
  nodes: [],
  currentNodeIndex: 0,

  grainSize: 150,
  density: 8,
  pitch: 0,
  position: 0.5,
  scatter: 0.2,
  panSpread: 0.4,
  masterGain: 0.7,

  attractorType: 'lorenz',
  attractorLinked: true,
  attractorSpeed: 1,
  attractorP1: 10,
  attractorP2: 28,
  attractorP3: 2.667,
  attractorNX: 0.5,
  attractorNY: 0.5,
  attractorNZ: 0.5,

  semitonesPerOrbit: 7,
  pitchWrap: true,
  attractorVortexPitch: 0,

  filterCutoff: 8000,
  filterResonance: 1,
  filterType: 'lowpass',
  delayTime: 0.25,
  delayFeedback: 0.3,
  delayWet: 0,
  reverbWet: 0,

  harmonizerEnabled: false,
  harmonizerChordMode: 'Triad',
  harmonizerVoiceGain: 0.35,
  harmonizerDetune: 8,

  detectedKey: '',
  detectedKeyConfidence: 0,

  setFilterCutoff:    (v) => set({ filterCutoff: v }),
  setFilterResonance: (v) => set({ filterResonance: v }),
  setFilterType:      (v) => set({ filterType: v }),
  setDelayTime:       (v) => set({ delayTime: v }),
  setDelayFeedback:   (v) => set({ delayFeedback: v }),
  setDelayWet:        (v) => set({ delayWet: v }),
  setReverbWet:       (v) => set({ reverbWet: v }),

  setHarmonizerEnabled:   (v) => set({ harmonizerEnabled: v }),
  setHarmonizerChordMode: (v) => set({ harmonizerChordMode: v }),
  setHarmonizerVoiceGain: (v) => set({ harmonizerVoiceGain: v }),
  setHarmonizerDetune:    (v) => set({ harmonizerDetune: v }),

  setDetectedKey: (key, confidence) => set({ detectedKey: key, detectedKeyConfidence: confidence }),

  setGrainSize:      (v) => set({ grainSize: v }),
  setDensity:        (v) => set({ density: v }),
  setPitch:          (v) => set({ pitch: v }),
  setPosition:       (v) => set({ position: v }),
  setScatter:        (v) => set({ scatter: v }),
  setPanSpread:      (v) => set({ panSpread: v }),
  setMasterGain:     (v) => set({ masterGain: v }),
  setPlaying:        (v) => set({ isPlaying: v }),
  setNodes:          (nodes) => set({ nodes }),
  setCurrentNode:    (i) => set({ currentNodeIndex: i }),
  setAudioLoaded:    (v, fileName = '') => set({ audioLoaded: v, fileName }),
  setSemitonesPerOrbit: (v) => set({ semitonesPerOrbit: v }),
  setPitchWrap:         (v) => set({ pitchWrap: v }),
  setAttractorType:  (t) => set({ attractorType: t }),
  setAttractorLinked:(v) => set({ attractorLinked: v }),
  setAttractorSpeed: (v) => set({ attractorSpeed: v }),
  setAttractorP1:    (v) => set({ attractorP1: v }),
  setAttractorP2:    (v) => set({ attractorP2: v }),
  setAttractorP3:    (v) => set({ attractorP3: v }),
  setAttractorState: (nx, ny, nz, vortexPitch = 0) => set({ attractorNX: nx, attractorNY: ny, attractorNZ: nz, attractorVortexPitch: vortexPitch }),
}))
