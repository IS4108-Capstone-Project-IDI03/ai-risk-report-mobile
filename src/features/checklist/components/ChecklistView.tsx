// An assessment's pre-survey checklist (MB-05 AC1-AC14): the facility's priority risks
// first, then each report area, with how many items are checked, and each item opens to
// its citations and its answers. Shown by the workspace when Checklist is chosen on its
// switch; `header` is the workspace's band and switch, so they scroll with it, and `state`
// is its useChecklist (which reads the checklist from the gateway, cached for offline).
import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, SectionList, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { NetworkError } from '@/lib/api'
import { cn, readable } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useCurrentLocation } from '@/features/locations/current'
import { useOffline } from '@/features/offline/provider'
import { markItem, type Item } from '../api'
import type { ChecklistState } from '../useChecklist'
import { AnswerSheet } from './AnswerSheet'
import { GenerateSheet } from './GenerateSheet'
import { ItemRow } from './ItemRow'
import { heading, outOfDate, pendingFor, sections } from '../format'

type Answer = (item: Item, result: 'confirmed' | 'differs') => void

// `answerBeside`: given when the form can open beside the checklist (MB-05 AC22), so
// Confirm and Differs fill it in place of the pop-up box.
export function ChecklistView({ reference, state, header, answerBeside }: { reference: string; state: ChecklistState; header: ReactNode; answerBeside?: Answer }) {
  const { body, error, load, replace } = state

  const [location] = useCurrentLocation(reference)
  const { offline, items, queueMark, discard, unlink } = useOffline()
  const [generating, setGenerating] = useState(false)
  // The Confirm / Differs box that is open, if any.
  const [answering, setAnswering] = useState<{ item: Item; result: 'confirmed' | 'differs' } | null>(null)

  // An answer is an observation, and an observation is filed at a location (MB-02), so
  // ask for one first (AC11).
  function onAnswer(item: Item, result: 'confirmed' | 'differs') {
    if (location) return answerBeside ? answerBeside(item, result) : setAnswering({ item, result })
    Alert.alert('Where are you?', 'Choose your location first, so the observation is filed there.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Choose location', onPress: () => router.push({ pathname: '/assessment/[reference]/locations', params: { reference } }) },
    ])
  }

  // The gateway answers a mark with the whole checklist as it now is. A refusal throws,
  // and the row says why.
  // With no signal it is queued instead (AC16), and shows as waiting.
  async function onMark(item: Item, mark: 'not_seen' | 'not_applicable' | null) {
    try {
      replace(await markItem(reference, item.id, mark))
    } catch (e) {
      if (!(e instanceof NetworkError)) throw e
      queueMark(reference, item.id, mark)
    }
  }

  // Generating asks the model, so it needs the gateway now (AC15).
  const generateButton = (label: string) => (
    <View className="gap-1">
      <Button variant={body?.checklist ? 'outline' : 'default'} accessibilityLabel={label} disabled={offline} onPress={() => setGenerating(true)}>
        <Text>{label}</Text>
      </Button>
      {offline && <Text className="text-sm text-muted-foreground">Connect to generate.</Text>}
    </View>
  )

  if (!body) {
    return (
      <View testID="checklist" className="flex-1">
        {header}
        <View className="items-center justify-center px-8 py-10">
        {error ? (
          <View className="items-center gap-3">
            <Text className="text-center text-destructive">{error}</Text>
            <Button variant="outline" accessibilityLabel="Try again" onPress={load}>
              <Text>Try again</Text>
            </Button>
          </View>
        ) : (
          <ActivityIndicator color="#000f47" />
        )}
        </View>
      </View>
    )
  }

  return (
    <View testID="checklist" className="flex-1">
      <SectionList
        sections={body.checklist ? sections(body.checklist) : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className={readable}>
            <ItemRow item={item} checklist={body.checklist!} reference={reference} onMark={onMark} onAnswer={onAnswer} pending={pendingFor(items, reference, item.id)} onDiscard={discard} onUnlink={unlink} />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View className={cn('bg-background px-4 pb-1 pt-4', readable)}>
            <Text testID="checklist-heading" className="text-sm font-semibold uppercase tracking-[1px] text-foreground">
              {heading(section)}
            </Text>
          </View>
        )}
        ListHeaderComponent={
          <View>
            {header}
          <View className={cn('gap-3 px-4 pt-4', readable)}>
            <Text className="text-muted-foreground">{`${body.scope.facilityType} · ${body.scope.jurisdiction}`}</Text>
            {/* When it is out of date, the way to fix it sits inside the notice; otherwise
                it is a quiet button. */}
            {outOfDate(body) ? (
              <View className="gap-3 rounded-md bg-warning p-3">
                <Text className="text-warning-foreground">
                  {"This checklist is out of date: the site's facility type or country has changed. Generate it again."}
                </Text>
                {generateButton('Generate again')}
              </View>
            ) : (
              body.checklist && generateButton('Generate again')
            )}
          </View>
          </View>
        }
        ListEmptyComponent={
          body.checklist ? undefined : (
            <View className={cn('gap-4 px-4 py-6', readable)}>
              <Text className="text-center text-muted-foreground">No checklist yet.</Text>
              {generateButton('Generate checklist')}
            </View>
          )
        }
        contentContainerClassName="pb-8"
      />
      {generating && (
        <GenerateSheet
          reference={reference}
          standards={body.standards}
          onClose={() => setGenerating(false)}
          onGenerated={(next) => {
            replace(next)
            setGenerating(false)
          }}
        />
      )}
      {answering && location && (
        <AnswerSheet
          item={answering.item}
          result={answering.result}
          reference={reference}
          locationId={location.id}
          onClose={() => setAnswering(null)}
          onSaved={() => {
            setAnswering(null)
            load()
          }}
        />
      )}
    </View>
  )
}
