// Capture sheet (MB-03 AC3-AC13): a full-screen modal over the workspace (on a
// tablet, a centred sheet with two columns once it's wide enough, MB-09) where
// one observation is put together and saved. One observation can hold a note,
// any number of photos, voice notes and scanned handwritten notes, so the
// sheet is one form. MB-07: everything added sits in one Evidence tray at the
// top, and the Photo, Voice and Scan buttons sit at the bottom, in thumb reach,
// above Save. MB-10: with no signal, Save queues it on the phone instead.
// MB-09 AC4: on a wide iPad the Workspace shows this form inside itself, beside the
// checklist (props `onClose`, `embedded`), so both stay on screen and scroll on their
// own. Everywhere else it is the capture route (src/app/assessment/[reference]/capture).
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { MapPin } from 'lucide-react-native'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Eyebrow } from '@/components/Eyebrow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { isTablet } from '@/lib/device'
import { cn, readable } from '@/lib/utils'
import { useCurrentLocation } from '@/features/locations/current'
import { locationLabel } from '@/features/locations/locations'
import { errorText, NetworkError } from '@/lib/api'
import { useOffline } from '@/features/offline/provider'
import { isLocal } from '@/features/offline/queue'
import { saveObservation } from '../api'
import { CaptureButtons } from '../components/CaptureButtons'
import { CopeChips } from '../components/CopeChips'
import { EvidenceTray } from '../components/EvidenceTray'
import { SeverityPicker } from '../components/SeverityPicker'
import type { Item } from '@/features/checklist/api'
import { COPE, emptyDraft, isBlank, missing, type Draft } from '../draft'
import { choosePhotos, takePhoto } from '../media'
import { useVoiceNote, type RecordingProblem } from '../useVoiceNote'

type Into = 'photos' | 'pages'
type ListKey = 'photos' | 'pages' | 'recordings'

type Props = {
  // Given when the Workspace shows the form inside itself: closing and saving call
  // this, not router.back(), and the form draws its own header.
  onClose?: () => void
  // Inside Home's tab, where the tab bar below already clears the home indicator.
  embedded?: boolean
  reference?: string
  // A checklist item being answered (MB-05 AC22): the form starts as the answer box does.
  answer?: { item: Item; result: 'confirmed' | 'differs' }
}

export default function CaptureSheet({ onClose, embedded = false, reference: given, answer }: Props = {}) {
  const params = useLocalSearchParams<{ reference: string }>()
  const reference = given ?? params.reference
  // Inside the workspace the form fills its column, left-aligned with its header;
  // as a route it keeps the readable column (MB-09).
  const col = onClose ? '' : readable
  // Leaves the form: back to the observations, or off the route.
  const leaveForm = () => (onClose ? onClose() : router.back())
  const [location] = useCurrentLocation(reference)
  // Confirm starts from the item's own words, Differs from nothing; the item's COPE
  // categories are chosen and the item linked (as checklist/components/AnswerSheet).
  const [initial] = useState<Draft>(() =>
    answer
      ? {
          ...emptyDraft,
          note: answer.result === 'confirmed' ? answer.item.text : '',
          cope: COPE.filter((c) => answer.item.COPE_dimension.includes(c)),
          checklistItem: { itemId: answer.item.id, result: answer.result },
        }
      : emptyDraft,
  )
  const [draft, setDraft] = useState<Draft>(initial)
  // Why the camera, library or microphone couldn't be used (AC13).
  const [problem, setProblem] = useState<RecordingProblem | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Whether the sheet is 640pt or wider (the `readable` column's width,
  // src/lib/utils.ts), measured, as on iPad the sheet isn't the window's width.
  // A tablet starts wide, so its form doesn't open in one column then reflow.
  // Inside the workspace the form is narrower than that, so it starts in one column.
  const [wide, setWide] = useState(() => !onClose && isTablet(Dimensions.get('screen')))
  // False once closed, so a late save doesn't navigate twice and pop the workspace too.
  const open = useRef(true)
  const { queueObservation } = useOffline()
  const voice = useVoiceNote((note) => setDraft((d) => ({ ...d, recordings: [...d.recordings, note] })))

  const update = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }))
  const remove = (key: ListKey, index: number) =>
    setDraft((d) => ({ ...d, [key]: d[key].filter((_: unknown, i: number) => i !== index) }))

  // Adds what the camera or library gave; a cancel adds nothing; refused
  // access says why, with Open Settings.
  async function addImages(into: Into, from: 'camera' | 'library') {
    const picked = await (from === 'camera' ? takePhoto() : choosePhotos())
    if ('denied' in picked) return setProblem({ message: picked.denied, settings: true })
    if (!('uris' in picked)) return
    setProblem(null)
    setDraft((d) => ({ ...d, [into]: [...d[into], ...picked.uris] }))
  }

  async function record() {
    setProblem(await voice.start())
  }

  // Close asks first when anything would be lost (AC12). Not during a save,
  // which would otherwise save what the engineer chose to discard.
  function close() {
    if (saving) return
    const leave = async () => {
      if (voice.recording) await voice.stop()
      open.current = false
      leaveForm()
    }
    // Untouched counts as nothing to lose, also when it started filled in from a checklist item.
    const untouched = JSON.stringify(draft) === JSON.stringify(initial)
    if ((isBlank(draft) || untouched) && !voice.recording) return void leave()
    Alert.alert('Discard this observation?', 'Its photos, voice notes, scans and note are not saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: leave },
    ])
  }

  // Android's back button goes through the same check as Close.
  const onBack = useEffectEvent(() => close())
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack()
      return true
    })
    return () => sub.remove()
  }, [])

  async function save() {
    if (!location || missing(draft) || saving) return
    setSaving(true)
    setError(null)
    try {
      // a. A location added offline has no gateway ID yet, so it queues behind
      //    it. b. Online, as before. c. No signal: queued (MB-10 AC2, AC8).
      if (isLocal(location.id)) await queueObservation(reference, draft, location.id)
      else {
        await saveObservation(reference, draft, location.id).catch((e) => {
          if (!(e instanceof NetworkError)) throw e
          return queueObservation(reference, draft, location.id)
        })
      }
      if (open.current) leaveForm()
      open.current = false
    } catch (e) {
      // The gateway's own words; the sheet keeps everything, so the engineer
      // can fix it and save (AC11).
      setError(errorText(e))
      setSaving(false)
    }
  }

  const blocker = missing(draft)

  // Close on the left, where a sheet's cancel goes; Save is at the bottom.
  const closeButton = (
    <Button
      variant="header"
      accessibilityLabel="Close"
      accessibilityState={{ disabled: saving }}
      disabled={saving}
      onPress={close}
      className="px-2"
    >
      <Text>Close</Text>
    </Button>
  )

  return (
    <>
      {/* Inside the workspace there is no stack header to set. */}
      {!onClose && (
        <Stack.Screen options={{ title: 'New observation', headerLeft: () => closeButton, headerRight: () => null }} />
      )}
      <SafeAreaView testID="capture-sheet" edges={embedded ? [] : ['bottom']} className="flex-1 bg-background">
        {/* Its own header, with Close in words, as the form isn't a screen here. */}
        {onClose && (
          <View className="min-h-16 flex-row items-center justify-between border-b border-border bg-card px-4 py-3">
            <Text className="text-lg font-semibold">New observation</Text>
            <Button variant="outline" accessibilityLabel="Close" accessibilityState={{ disabled: saving }} disabled={saving} onPress={close}>
              <Text>Close</Text>
            </Button>
          </View>
        )}
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Read-only here: changing it means closing the sheet, so a picker on
              top can't catch Android's back button meant for the sheet. */}
          {answer && (
            <View className="gap-1 border-b border-border bg-accent px-4 py-3">
              <Eyebrow>What the checklist expects</Eyebrow>
              <Text>{answer.item.text}</Text>
            </View>
          )}
          {location && (
            <View className="border-b border-border bg-card px-4">
              <View className={cn('min-h-12 flex-row items-center gap-2', col)}>
                <MapPin color="#2c5488" size={18} />
                <Text className="flex-1 font-medium">{locationLabel(location)}</Text>
              </View>
            </View>
          )}
          <ScrollView
            onLayout={(e) => setWide(e.nativeEvent.layout.width >= 640)}
            // Wide, the two columns use the sheet's width; else the readable column (MB-09).
            contentContainerClassName={cn('gap-6 p-4 pb-8', wide ? 'w-full max-w-[960px] self-center' : col)}
            keyboardShouldPersistTaps="handled"
          >
            {problem && (
              <View className="gap-3 rounded-md bg-warning p-3">
                <Text className="text-warning-foreground">{problem.message}</Text>
                {problem.settings && (
                  <Button variant="outline" accessibilityLabel="Open Settings" onPress={() => Linking.openSettings()}>
                    <Text>Open Settings</Text>
                  </Button>
                )}
              </View>
            )}

            {/* Two columns once the sheet is wide (a centred sheet on iPad, MB-09):
                what was captured on the left, how to file it on the right. */}
            <View className={wide ? 'flex-row gap-7' : 'gap-6'}>
              <View className={cn('gap-6', wide && 'flex-1')}>
                <EvidenceTray draft={draft} onRemove={remove} />

                <View className="gap-2">
                  <Eyebrow>Note</Eyebrow>
                  <Input
                    accessibilityLabel="Note"
                    value={draft.note}
                    onChangeText={(note) => update({ note })}
                    placeholder="What did you see?"
                    multiline
                    maxLength={5000} // the gateway's limit (newObservationSchema)
                    textAlignVertical="top"
                    className="h-24 py-3"
                  />
                </View>
              </View>
              <View className={cn('gap-6', wide && 'flex-1')}>
                {/* Severity first: it's required to save, COPE isn't. */}
                <View className="gap-2">
                  <View className="flex-row items-baseline justify-between">
                    <Eyebrow>Severity</Eyebrow>
                    <Text className={draft.severity ? 'text-sm font-semibold text-success-foreground' : 'text-sm font-semibold text-warning-foreground'}>
                      Required
                    </Text>
                  </View>
                  <SeverityPicker value={draft.severity} onChange={(severity) => update({ severity })} />
                </View>

                <View className="gap-2">
                  <View className="flex-row items-baseline justify-between">
                    <Eyebrow>COPE category</Eyebrow>
                    <Text className="text-sm text-muted-foreground">Optional, any number</Text>
                  </View>
                  <CopeChips value={draft.cope} onChange={(cope) => update({ cope })} />
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Pinned in thumb reach; says what's missing when it can't save yet (AC9). */}
          <View className="border-t border-border bg-card px-4 pt-3">
            <View className={cn('gap-2', col)}>
              <CaptureButtons
                draft={draft}
                recording={voice.recording}
                durationMillis={voice.durationMillis}
                busy={saving}
                onPhoto={() => addImages('photos', 'camera')}
                onRecord={record}
                onStop={voice.stop}
                onScan={() => addImages('pages', 'camera')}
                onPhotoLibrary={() => addImages('photos', 'library')}
                onScanLibrary={() => addImages('pages', 'library')}
              />
              {voice.recording ? (
                <Text className="text-center text-sm font-medium text-destructive" accessibilityLiveRegion="polite">
                  Recording…
                </Text>
              ) : error ? (
                <Text className="text-destructive">{error}</Text>
              ) : (
                blocker && <Text className="text-center text-sm text-muted-foreground">{blocker}</Text>
              )}
              <Button
                size="lg"
                accessibilityLabel="Save observation"
                accessibilityState={{ disabled: Boolean(blocker) || saving || voice.recording }}
                disabled={Boolean(blocker) || saving || voice.recording}
                onPress={save}
                className="mb-2"
              >
                {saving ? <ActivityIndicator color="#ffffff" /> : <Text className="text-lg">Save observation</Text>}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  )
}
