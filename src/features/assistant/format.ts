// Colours, the stage and the time of a turn for MarshBot's chat (MB-20). The hex values repeat tailwind.config.js and the
// web's tones (a style prop can't take a class). Used by the components and the screen.
import type { Tone } from './types'
import { STAGES } from './types'

// The icon colour and its tinted tile for a card row's tone.
export const ROW_TONE: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: '#545e6b', bg: '#eef1f5' },
  violet: { fg: '#5b4bb7', bg: '#ece9fb' },
  amber: { fg: '#8f5f13', bg: '#fdf1d8' },
  red: { fg: '#ad2e2d', bg: '#fdecec' },
  green: { fg: '#2f7049', bg: '#e6f3ea' },
}

// The status pill under MarshBot's name: red fix first, amber needs you, green done, blue waiting.
export const PILL = {
  red: { fg: '#ad2e2d', bg: '#fdecec' },
  amber: { fg: '#8f5f13', bg: '#fdf1d8' },
  green: { fg: '#2f7049', bg: '#e6f3ea' },
  blue: { fg: '#2c5488', bg: '#eaf0fc' },
}

const LABELS: Record<string, string> = {
  setup: 'Setup',
  prepare: 'Prepare',
  capture: 'Capture',
  ready_for_generation: 'Ready for generation',
  generate: 'Generate',
  review: 'Review',
  ready_to_export: 'Ready to export',
  exported: 'Exported',
}
export const stageLabel = (stage: string) => LABELS[stage] ?? stage
export const stageIndex = (stage: string) => Math.max(0, STAGES.indexOf(stage))

// "11:45" in the phone's own clock.
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
