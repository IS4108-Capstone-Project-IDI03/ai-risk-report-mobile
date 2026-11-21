// The Confirm / Differs box (MB-05 AC9, AC10): what the checklist expects (read-only),
// what the engineer saw (Confirm starts from the item's words, Differs starts empty), an
// optional photo, and a severity that is always chosen. Save files an observation at the
// current location, linked to the item. Opened by screens/Checklist. Saves as capture
// does: online, or queued with no signal (MB-10).
import { Camera, Images } from 'lucide-react-native'
import { useState } from 'react'
import { Image, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Eyebrow } from '@/components/Eyebrow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { NetworkError, errorText } from '@/lib/api'
import { saveObservation } from '@/features/capture/api'
import { SeverityPicker } from '@/features/capture/components/SeverityPicker'
import { COPE, emptyDraft, missing, type Draft } from '@/features/capture/draft'
import { choosePhotos, takePhoto, type Picked } from '@/features/capture/media'
import { useOffline } from '@/features/offline/provider'
import { isLocal } from '@/features/offline/queue'
import type { Severity } from '@/features/observations/format'
import type { Item } from '../api'

type Props = {
  item: Item
  result: 'confirmed' | 'differs'
  reference: string
  locationId: string
  onClose(): void
  // After it is saved or queued, so the checklist can read itself again.
  onSaved(): void
}

export function AnswerSheet({ item, result, reference, locationId, onClose, onSaved }: Props) {
  const { queueObservation } = useOffline()
  // Confirm starts from the item's own words; Differs from nothing (the web's decision, 31 Oct).
  const [note, setNote] = useState(result === 'confirmed' ? item.text : '')
  const [severity, setSeverity] = useState<Severity | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const draft: Draft = {
    ...emptyDraft,
    note,
    severity,
    photos: photo ? [photo] : [],
    // The item's own categories, in COPE order.
    cope: COPE.filter((c) => item.COPE_dimension.includes(c)),
    checklistItem: { itemId: item.id, result },
  }
  const stops = missing(draft)

  async function pick(choose: () => Promise<Picked>) {
    const picked = await choose()
    if ('denied' in picked) return setProblem(picked.denied)
    if ('canceled' in picked) return
    setProblem(null)
    setPhoto(picked.uris[0])
  }

  // a. A location added offline has no gateway ID yet, so it queues behind it. b. Online.
  // c. No signal: queued (MB-10). A refusal keeps the box open with what was typed (AC14).
  async function save() {
    if (stops || saving) return
    setSaving(true)
    setProblem(null)
    try {
      if (isLocal(locationId)) await queueObservation(reference, draft, locationId)
      else {
        await saveObservation(reference, draft, locationId).catch((e) => {
          if (!(e instanceof NetworkError)) throw e
          return queueObservation(reference, draft, locationId)
        })
      }
      onSaved()
    } catch (e) {
      setProblem(errorText(e))
      setSaving(false)
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={saving ? undefined : onClose}>
      <SafeAreaView testID="answer-sheet" className="flex-1 bg-background">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
            <Text className="text-xl font-bold">{result === 'confirmed' ? 'Confirm' : 'Record a difference'}</Text>
            <Button variant="ghost" accessibilityLabel="Close" onPress={onClose} disabled={saving}>
              <Text>Close</Text>
            </Button>
          </View>
          <ScrollView contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
            <View className="gap-1">
              <Eyebrow>What the checklist expects</Eyebrow>
              <Text className="text-base">{item.text}</Text>
            </View>
            <View className="gap-2">
              <Eyebrow>What did you see?</Eyebrow>
              <Input
                accessibilityLabel="What did you see?"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={5000} // the gateway's limit (newObservationSchema)
                textAlignVertical="top"
                className="h-28 py-3"
              />
            </View>
            <View className="gap-2">
              <Eyebrow>Photo (optional)</Eyebrow>
              {photo ? (
                <View className="flex-row items-center gap-3">
                  <Image source={{ uri: photo }} className="h-16 w-16 rounded-md bg-muted" />
                  <Button variant="outline" accessibilityLabel="Remove photo" onPress={() => setPhoto(null)}>
                    <Text>Remove photo</Text>
                  </Button>
                </View>
              ) : (
                <View className="flex-row gap-2">
                  <Button variant="outline" accessibilityLabel="Take photo" disabled={saving} onPress={() => pick(takePhoto)}>
                    <Camera color="#1a1f26" size={18} />
                    <Text>Take photo</Text>
                  </Button>
                  <Button variant="outline" accessibilityLabel="Add photo from library" disabled={saving} onPress={() => pick(choosePhotos)}>
                    <Images color="#1a1f26" size={18} />
                    <Text>From library</Text>
                  </Button>
                </View>
              )}
            </View>
            <View className="gap-2">
              <Eyebrow required>Severity</Eyebrow>
              <SeverityPicker value={severity} onChange={setSeverity} />
            </View>
            {problem && (
              <View className="rounded-md bg-destructive/10 p-3">
                <Text className="text-destructive">{problem}</Text>
              </View>
            )}
          </ScrollView>
          <View className="border-t border-border bg-card px-4 pb-2 pt-2">
            {stops && <Text className="pb-2 text-center text-sm text-muted-foreground">{stops}</Text>}
            <Button size="lg" accessibilityLabel="Save answer" disabled={!!stops || saving} onPress={save}>
              <Text className="text-lg">Save answer</Text>
            </Button>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}
