// One citation's number after its statement (MB-06 AC3-AC4): a small mono
// numeral, violet once verified (violet marks machine-generated content, per the
// design system), muted while checking, amber with "?" when unverified. Inline
// text, so it never starts a line on its own. Tapping it opens CitationSheet.
import { Text } from 'react-native'
import { pagesText, type CitationState, type Source } from '../answer'

export type OpenCitation = { number: number; label: string; quote: string; state: CitationState; source?: Source }

type Props = OpenCitation & { documentName?: string; onOpen(c: OpenCitation): void }

const LOOK: Record<CitationState, { color: string; backgroundColor: string }> = {
  verified: { color: '#6258a3', backgroundColor: '#eeecfb' }, // ai-fg on violet-50
  checking: { color: '#545e6b', backgroundColor: '#eef1f6' },
  unverified: { color: '#8f5f13', backgroundColor: '#fdf1d8' }, // amber
}

export function CitationMarker({ documentName, onOpen, ...citation }: Props) {
  const { number, state, source } = citation
  // Read aloud as "Citation 2: NFPA 13 (2022), Page 81, unverified", so markers
  // citing different pages don't sound the same (as on the web).
  const where = [documentName, source && pagesText(source.pageStart, source.pageEnd)].filter(Boolean).join(', ')
  const label = [`Citation ${number}${where ? `: ${where}` : ''}`, state !== 'verified' && state].filter(Boolean).join(', ')
  return (
    <Text
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => onOpen(citation)}
      suppressHighlighting={false}
      // Inline text can't take a larger hit area, so the numeral itself is a size up.
      style={[LOOK[state], { fontVariant: ['tabular-nums'], fontSize: 14 }]}
    >
      {` ${number}${state === 'unverified' ? '?' : ''} `}
    </Text>
  )
}
