// Capture sheet (MB-03 AC3-AC13): a full-screen modal over the workspace where
// one observation is put together and saved. One observation can hold a note,
// any number of photos, voice notes and scanned handwritten notes, so the
// sheet is one form with a section for each, every section adding its own.
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { MapPin, ScanText } from 'lucide-react-native'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import { useCurrentLocation } from '@/features/locations/current'
import { locationLabel } from '@/features/locations/locations'
import { ApiError } from '@/lib/api'
import { saveObservation } from '../api'
import { CopeChips } from '../components/CopeChips'
import { ImageSection } from '../components/ImageSection'
import { SeverityPicker } from '../components/SeverityPicker'
import { VoiceNotesSection } from '../components/VoiceNotesSection'
import { emptyDraft, isBlank, missing, type Draft } from '../draft'
import { choosePhotos, takePhoto } from '../media'
import { useVoiceNote, type RecordingProblem } from '../useVoiceNote'

type Into = 'photos' | 'pages'
type ListKey = 'photos' | 'pages' | 'recordings'

export default function CaptureSheet() {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  const [location] = useCurrentLocation(reference)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  // Why the camera, library or microphone couldn't be used (AC13).
  const [problem, setProblem] = useState<RecordingProblem | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // False once closed, so a late save doesn't navigate twice and pop the workspace too.
  const open = useRef(true)
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
      router.back()
    }
    if (isBlank(draft) && !voice.recording) return void leave()
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
      await saveObservation(reference, draft, location.id)
      if (open.current) router.back()
      open.current = false
    } catch (e) {
      // The gateway's own words, the field's problem first when it names one;
      // the sheet keeps everything, so the engineer can fix it and save (AC11).
      const fields = e instanceof ApiError ? Object.values(e.fields) : []
      setError(fields[0] ?? (e instanceof Error ? e.message : String(e)))
      setSaving(false)
    }
  }

  const blocker = missing(draft)

  return (
    <>
      <Stack.Screen
        options={{
          title: 'New observation',
          headerLeft: () => null,
          headerRight: () => (
            <Button
              variant="ghost"
              accessibilityLabel="Close"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={close}
              className="px-2"
            >
              <Text className="text-white">Close</Text>
            </Button>
          ),
        }}
      />
      <SafeAreaView testID="capture-sheet" edges={['bottom']} className="flex-1 bg-background">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerClassName="gap-6 p-4 pb-8" keyboardShouldPersistTaps="handled">
            {location && (
              <View className="flex-row items-center gap-2">
                <MapPin color="#2c5488" size={18} />
                <Text className="flex-1 font-medium">{locationLabel(location)}</Text>
              </View>
            )}

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
                className="h-28 py-3"
              />
            </View>

            <ImageSection
              title="Photos"
              uris={draft.photos}
              testID="evidence-photo"
              addLabel="Take photo"
              libraryLabel="Add photo from library"
              noun="photo"
              onTake={() => addImages('photos', 'camera')}
              onLibrary={() => addImages('photos', 'library')}
              onRemove={(i) => remove('photos', i)}
            />

            <VoiceNotesSection
              recordings={draft.recordings}
              recording={voice.recording}
              durationMillis={voice.durationMillis}
              onRecord={record}
              onStop={voice.stop}
              onRemove={(i) => remove('recordings', i)}
            />

            {/* Handwritten pages: transcribed by the gateway (CP-19), not shown as site photos. */}
            <ImageSection
              title="Scanned notes"
              uris={draft.pages}
              testID="evidence-page"
              addLabel="Scan handwritten notes"
              libraryLabel="Add scan from library"
              noun="scan"
              Icon={ScanText}
              onTake={() => addImages('pages', 'camera')}
              onLibrary={() => addImages('pages', 'library')}
              onRemove={(i) => remove('pages', i)}
            />

            <View className="gap-2">
              <Eyebrow>COPE category</Eyebrow>
              <CopeChips value={draft.cope} onChange={(cope) => update({ cope })} />
            </View>

            <View className="gap-2">
              <Eyebrow>Severity</Eyebrow>
              <SeverityPicker value={draft.severity} onChange={(severity) => update({ severity })} />
            </View>
          </ScrollView>

          {/* Pinned in thumb reach; says what's missing when it can't save yet (AC9). */}
          <View className="gap-2 border-t border-border bg-card p-4">
            {error ? (
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
            >
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text>Save observation</Text>}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  )
}
