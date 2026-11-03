// The search step above an answer (MB-06 AC2, AC6), as the web's SearchStep:
// while it runs, "Searching the knowledge base…" in small muted text that gently
// pulses (chat.css `chat-pulse`: down to 45% and back over 1.6s). Once done, a
// quiet summary that opens to list each step.
import { ChevronDown, ChevronRight } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { Search, SearchFilters } from '../events'

// Source types as the web names them (client/src/features/chat/components/SearchStep.tsx).
const SOURCE: Record<string, string> = {
  fm_standard: 'FM standards',
  nfpa_standard: 'NFPA standards',
  local_standard: 'Local standards',
  marsh_report: 'Past reports',
}

// A country code's name ("SG" → "Singapore"), or the code if the phone can't name it.
function country(code: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

function filterNames(f: SearchFilters = {}) {
  return [
    f.jurisdiction && country(f.jurisdiction),
    f.facility_type,
    f.source_type && (SOURCE[f.source_type] ?? f.source_type),
    f.document,
  ].filter((x): x is string => Boolean(x))
}

export function SearchLine({ search }: { search: Search }) {
  if (search.status === 'searching') return <Searching />
  return <Searched search={search} />
}

// The pulsing line while searching. Still when the phone asks for reduced motion.
function Searching() {
  const [opacity] = useState(() => new Animated.Value(1))
  useEffect(() => {
    const half = (to: number) =>
      Animated.timing(opacity, { toValue: to, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    const pulse = Animated.loop(Animated.sequence([half(0.45), half(1)]))
    let stopped = false
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => !reduce && !stopped && pulse.start())
      .catch(() => {})
    return () => {
      stopped = true
      pulse.stop()
    }
  }, [opacity])
  return (
    <Animated.Text
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={{ opacity, fontSize: 13, color: '#545e6b', fontFamily: 'IBMPlexSans_400Regular' }}
    >
      Searching the knowledge base…
    </Animated.Text>
  )
}

// The finished step: one quiet line, opening to what was searched and found.
function Searched({ search }: { search: Search }) {
  const [open, setOpen] = useState(false)
  const names = filterNames(search.filters)
  const where = names.length ? ` in ${names.join(' · ')}` : ''
  const summary = names.length ? `Searched: ${names.join(' · ')}` : 'Searched the whole knowledge base'
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        hitSlop={12}
        className="flex-row items-center gap-1 self-start"
      >
        <Text className="text-[13px] text-muted-foreground">{summary}</Text>
        <Chevron color="#545e6b" size={14} />
      </Pressable>
      {open && (
        <View className="mt-1 gap-0.5 pl-3">
          {search.query && <Step text={`Searched for “${search.query}”${where}`} />}
          {(search.also ?? []).map((q) => (
            <Step key={q} text={`Also searched for “${q}”`} />
          ))}
          <Step
            text={search.declined ? 'No passage was relevant enough to answer from' : `Found ${search.passages ?? 0} relevant passages`}
          />
        </View>
      )}
    </View>
  )
}

const Step = ({ text }: { text: string }) => <Text className="text-[13px] text-muted-foreground">{`• ${text}`}</Text>
