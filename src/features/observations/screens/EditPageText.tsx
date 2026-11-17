// Edit the text read from one scanned page (MB-17 AC11-AC13). Opened by Edit text under a page on the
// observation's detail (route observation/[id]/page-text?pageId=). Starts from the engineer's earlier
// correction, or the reading. Save calls correctPageText; the gateway keeps its own reading as evidence.
// A refused or failed save keeps what was typed.
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Eyebrow } from '@/components/Eyebrow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { ApiError, errorText } from '@/lib/api'
import { cn, readable } from '@/lib/utils'
import { correctPageText, listObservations } from '../api'
import { MediaImage } from '../components/MediaImage'
import type { Page } from '../format'

// The gateway's limit (transcriptCorrectionSchema in the web repo's observation.service.ts).
const MAX = 20000

export default function EditPageText() {
  const { reference, id, pageId } = useLocalSearchParams<{ reference: string; id: string; pageId: string }>()
  // undefined while loading; null once the list arrives without this page.
  const [page, setPage] = useState<Page | null | undefined>(undefined)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // Starts from what the gateway holds, once: typing before then would be overwritten.
  useEffect(() => {
    let live = true
    listObservations(reference).then(
      (all) => {
        if (!live) return
        const found = all.find((o) => o.id === id)?.pages.find((p) => p.id === pageId) ?? null
        setPage(found)
        setText(found?.transcription?.correction?.text ?? found?.transcription?.transcript ?? '')
      },
      (e) => live && setError(e),
    )
    return () => {
      live = false
    }
  }, [reference, id, pageId])

  const saved = page?.transcription?.correction?.text ?? page?.transcription?.transcript ?? ''

  // a. Send the text. b. On success go back: the detail reads the list again as it comes into view.
  async function save() {
    setBusy(true)
    setError(null)
    try {
      await correctPageText(id, pageId, text)
      router.back()
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  if (page === undefined && !error)
    return (
      <View testID="page-text" className="flex-1 items-center justify-center">
        <ActivityIndicator color="#000f47" />
      </View>
    )
  if (!page)
    return (
      <View testID="page-text" className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-lg font-semibold">{page === null ? "This page isn't available" : "Couldn't load this page"}</Text>
        {page === undefined && <Text className="text-center text-muted-foreground">{errorText(error)}</Text>}
        <Button variant="outline" accessibilityLabel="Back" onPress={() => router.back()}>
          <Text>Back</Text>
        </Button>
      </View>
    )

  // The gateway's reason for the text shows under the field; anything else (no signal), above Save.
  const fields = error instanceof ApiError ? error.fields : {}
  const general = error && !fields.text ? errorText(error) : null
  return (
    <View testID="page-text" className="flex-1">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
          <View className={cn('gap-4', readable)}>
            <MediaImage url={page.url} testID="page-text-image" label="Handwritten page" />
            <View className="gap-2">
              <Eyebrow>Corrected text</Eyebrow>
              <Input
                accessibilityLabel="Corrected text"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={MAX}
                textAlignVertical="top"
                className={cn('min-h-48 py-3', fields.text && 'border-destructive')}
              />
              {fields.text && <Text className="text-sm text-destructive">{fields.text}</Text>}
              <Text className="text-sm text-muted-foreground">The first reading is kept. Reports are drafted from your text.</Text>
            </View>
            {general && (
              <View className="rounded-md bg-destructive/10 p-3">
                <Text className="text-destructive">{general}</Text>
              </View>
            )}
          </View>
        </ScrollView>
        <SafeAreaView edges={['bottom']} className="border-t border-border bg-card px-4 pt-2">
          <View className={cn('mb-2 flex-row gap-3', readable)}>
            <Button variant="outline" accessibilityLabel="Cancel" className="flex-1" disabled={busy} onPress={() => router.back()}>
              <Text>Cancel</Text>
            </Button>
            <Button accessibilityLabel="Save text" className="flex-1" disabled={busy || text === saved} onPress={save}>
              <Text>Save text</Text>
            </Button>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  )
}
