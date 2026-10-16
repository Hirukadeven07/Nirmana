import type { ColorMode } from './buildHouse'

export type Preset = 'exterior' | 'cutaway' | 'exploded' | 'section'

export interface ViewState {
  preset: Preset
  roof: boolean
  foundation: boolean
  floors: boolean[]
  explode: boolean
  cutaway: boolean
  section: boolean
  sectionAxis: 'x' | 'z'
  sectionPos: number
  colorMode: ColorMode
}

export function presetView(preset: Preset, floorCount: number, prev?: ViewState): ViewState {
  const base: ViewState = {
    preset, roof: true, foundation: false, floors: Array(floorCount).fill(true), explode: false, cutaway: false,
    section: false, sectionAxis: prev?.sectionAxis ?? 'x', sectionPos: prev?.sectionPos ?? 0.5, colorMode: prev?.colorMode ?? 'type',
  }
  if (preset === 'cutaway') return { ...base, roof: false, cutaway: true }
  if (preset === 'exploded') return { ...base, explode: true, cutaway: true }
  if (preset === 'section') return { ...base, section: true }
  return base
}
