// Edit a saved observation's severity, COPE categories and note (MB-12 AC1-AC6), and
// manage its photos and voice notes (AC16-AC21, in MediaSection). Opened by Edit on
// the detail (ObservationDetail). Calls updateObservation, which sends only what
// changed. A failed save keeps what was typed (AC5).
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Eyebrow } from '@/components/Eyebrow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { ApiError, errorText } from '@/lib/api'
import { cn, readable } from '@/lib/utils'
import { CopeChips } from '@/features/capture/components/CopeChips'
import { SeverityPicker } from '@/features/capture/components/SeverityPicker'
import type { Cope } from '@/features/capture/draft'
import { MediaSection } from '../components/MediaSection'
import { addMedia, listObservations, noNewMedia, updateObservation, type Changes } from '../api'
import type { Observation, Severity } from '../format'

// Order doesn't matter to the gateway, so two picks of the same categories are the same.
const sameCope = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join()

export default function ObservationEdit() {
  const { reference, id } = useLocalSearchParams<{ reference: string; id: string }>()
  // undefined while loading; null once the list arrives without it.
  const [original, setOriginal] = useState<Observation | null | undefined>(undefined)
  const [severity, setSeverity] = useState<Severity | null>(null)
  const [cope, setCope] = useState<Cope[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  // The media section is mid-action or recording: leaving now would lose it.
  const [mediaBusy, setMediaBusy] = useState(false)
  // New photos and voice notes waiting for Save (MB-12 AC20).
  const [staged, setStaged] = useState(noNewMedia)

  // Starts from what the gateway holds, once.
  useEffect(() => {
    let live = true
    listObservations(reference).then(
      (all) => {
        if (!live) return
        const found = all.find((o) => o.id === id) ?? null
        setOriginal(found)
        setSeverity(found?.severity ?? null)
        setCope((found?.copeDimensions ?? []) as Cope[])
        setNote(found?.note ?? '')
      },
      (e) => live && setError(e),
    )
    return () => {
      live = false
    }
  }, [reference, id])

  // Coming back from correcting a page's text (MB-17): take the pages from the gateway, and leave what was
  // typed here alone. The first focus is the mount, which loads everything already.
  const seen = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (!seen.current) {
        seen.current = true
        return
      }
      listObservations(reference).then(
        (all) => {
          const fresh = all.find((o) => o.id === id)
          if (fresh) setOriginal((prev) => (prev ? { ...prev, pages: fresh.pages } : prev))
        },
        () => {},
      )
    }, [reference, id]),
  )

  // What differs from the saved one, in the gateway's terms: `null` uncategorises
  // and removes a note (a blank one is the same as none).
  const changes: Changes = {}
  if (original) {
    if (severity && severity !== original.severity) changes.severity = severity
    if (!sameCope(cope, original.copeDimensions ?? [])) changes.copeDimensions = cope.length ? cope : null
    // Spaces alone are no note, so they don't count as a change to an empty one.
    const typed = note.trim() ? note : ''
    if (typed !== (original.note ?? '')) changes.note = typed || null
  }
  const hasStaged = staged.photos.length > 0 || staged.recordings.length > 0 || staged.pages.length > 0
  const dirty = Object.keys(changes).length > 0 || hasStaged

  // a. The tags and note, if changed. b. Then the new photos, voice notes and pages, which is
  // when they are uploaded and each voice note and page is read. The tags go first, so a
  // refused change doesn't cost a reading. If b fails, a is already saved: the
  // saved copy replaces `original` so it isn't sent again, and the message says so
  // (AC21).
  async function save() {
    setBusy(true)
    setError(null)
    let changesSaved = false
    try {
      if (Object.keys(changes).length) {
        setOriginal(await updateObservation(id, changes))
        changesSaved = true
      }
      if (hasStaged) await addMedia(id, staged)
      router.back()
    } catch (e) {
      setError(
        changesSaved ? new Error(`Your changes were saved, but the new photos and voice notes weren't added: ${errorText(e)}`) : e,
      )
      setBusy(false)
    }
  }

  // Asks only when something changed (AC6): then nothing is lost by a stray tap.
  const cancel = useCallback(() => {
    if (!dirty) return router.back()
    Alert.alert('Discard your changes?', 'What you changed is not saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ])
    return undefined
  }, [dirty])
  // Android's back button asks too. Mid-save it does nothing: going back then would
  // close this screen and, when the save finishes, the detail under it as well.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy && !mediaBusy) cancel()
      return true
    })
    return () => sub.remove()
  }, [cancel, busy, mediaBusy])

  // The gateway's reason for one field shows under it; anything else, above Save.
  const fields = error instanceof ApiError ? error.fields : {}
  const general = error && !fields.note && !fields.severity && !fields.copeDimensions ? errorText(error) : null

  // Nothing to edit until it has loaded: typing before then would be overwritten.
  if (original === undefined && !error) {
    return (
      <View testID="observation-edit" className="flex-1 items-center justify-center">
        <ActivityIndicator color="#000f47" />
      </View>
    )
  }

  if (original === null || original === undefined) {
    return (
      <View testID="observation-edit" className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-lg font-semibold">
          {original === null ? "This observation isn't available" : "Couldn't load this observation"}
        </Text>
        {original === undefined && <Text className="text-center text-muted-foreground">{errorText(error)}</Text>}
        <Button variant="outline" accessibilityLabel="Back" onPress={() => router.back()}>
          <Text>Back</Text>
        </Button>
      </View>
    )
  }

  return (
    <View testID="observation-edit" className="flex-1">
      {/* The bottom bar is the way out, so the header's own back would skip the question. */}
      <Stack.Screen options={{ title: 'Edit observation', headerBackVisible: false, gestureEnabled: !dirty && !mediaBusy }} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-6 p-4" keyboardShouldPersistTaps="handled">
          <View className={cn('gap-6', readable)}>
            <View className="gap-2">
              <Eyebrow>Severity</Eyebrow>
              <SeverityPicker value={severity} onChange={setSeverity} />
              {fields.severity && <Text className="text-sm text-destructive">{fields.severity}</Text>}
            </View>
            <View className="gap-2">
              <Eyebrow>COPE categories</Eyebrow>
              <CopeChips value={cope} onChange={setCope} />
              {fields.copeDimensions && <Text className="text-sm text-destructive">{fields.copeDimensions}</Text>}
            </View>
            <View className="gap-2">
              <Eyebrow>Note</Eyebrow>
              <Input
                accessibilityLabel="Note"
                value={note}
                onChangeText={setNote}
                placeholder="What did you see?"
                multiline
                maxLength={5000} // the gateway's limit (observationChangesSchema)
                textAlignVertical="top"
                className={cn('h-32 py-3', fields.note && 'border-destructive')}
              />
              {fields.note && <Text className="text-sm text-destructive">{fields.note}</Text>}
            </View>
            <MediaSection observation={original} onChange={setOriginal} staged={staged} setStaged={setStaged} onBusyChange={setMediaBusy} />
            {general && (
              <View className="rounded-md bg-destructive/10 p-3">
                <Text className="text-destructive">{general}</Text>
              </View>
            )}
          </View>
        </ScrollView>
        {/* In thumb reach, as the workspace's bottom bar. */}
        <SafeAreaView edges={['bottom']} className="border-t border-border bg-card px-4 pt-2">
          <View className={cn('mb-2 flex-row gap-3', readable)}>
            <Button variant="outline" accessibilityLabel="Cancel" className="flex-1" disabled={busy || mediaBusy} onPress={cancel}>
              <Text>Cancel</Text>
            </Button>
            <Button accessibilityLabel="Save changes" className="flex-1" disabled={busy || mediaBusy || !dirty || !original} onPress={save}>
              <Text>Save changes</Text>
            </Button>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  )
}
