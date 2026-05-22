import { create } from 'zustand'

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

  grainSize: number
  density: number
  pitch: number
  position: number
  scatter: number
  panSpread: number
  masterGain: number

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

  setGrainSize: (v) => set({ grainSize: v }),
  setDensity: (v) => set({ density: v }),
  setPitch: (v) => set({ pitch: v }),
  setPosition: (v) => set({ position: v }),
  setScatter: (v) => set({ scatter: v }),
  setPanSpread: (v) => set({ panSpread: v }),
  setMasterGain: (v) => set({ masterGain: v }),
  setPlaying: (v) => set({ isPlaying: v }),
  setNodes: (nodes) => set({ nodes }),
  setCurrentNode: (i) => set({ currentNodeIndex: i }),
  setAudioLoaded: (v, fileName = '') => set({ audioLoaded: v, fileName }),
}))
