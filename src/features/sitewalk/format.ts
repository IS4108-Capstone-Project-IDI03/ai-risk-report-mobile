// How a walk's status reads on the Site walks screen (MB-16 AC2): a word and a colour, never colour
// alone. Used by components/WalkRow.
import type { BadgeProps } from '@/components/ui/badge'
import type { WalkStatus } from './api'

export const WALK_STATUS: Record<WalkStatus, { label: string; tone: BadgeProps['variant'] }> = {
  recording: { label: 'Recording', tone: 'info' },
  transcribing: { label: 'Transcribing', tone: 'warning' },
  proposing: { label: 'Proposing observations', tone: 'warning' },
  ready: { label: 'Ready to review', tone: 'success' },
  failed: { label: "Couldn't process", tone: 'neutral' },
  created: { label: 'Created', tone: 'success' },
}

// A walk is working on the gateway while it is turned into text and proposals.
export const working = (status: WalkStatus) => status === 'transcribing' || status === 'proposing'
