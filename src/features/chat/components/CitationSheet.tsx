// The source behind a citation (MB-06 AC5): a page sheet with the document's
// name, its pages, any warnings, the quoted words (verbatim, behind a rule, per
// the design system) and the passage's text from GET /api/chat/passages/:id.
// Text only: the web's PDF preview isn't on the phone.
import { useEffect, useState } from 'react'
import { Modal, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Eyebrow } from '@/components/Eyebrow'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { pagesText } from '../answer'
import { getPassage, type Passage } from '../api'
import type { OpenCitation } from './CitationMarker'

type Props = { citation: OpenCitation | null; names: Map<string, string>; onClose(): void }

export function CitationSheet({ citation, names, onClose }: Props) {
  // The passage for the citation that's open, keyed by its id so a stale
  // reply for an earlier citation is never shown.
  const [loaded, setLoaded] = useState<{ id: string; passage?: Passage; error?: string } | null>(null)
  const passageId = citation?.source?.passageId

  useEffect(() => {
    if (!passageId) return
    getPassage(passageId).then(
      (passage) => setLoaded({ id: passageId, passage }),
      (e: Error) => setLoaded({ id: passageId, error: e.message }),
    )
  }, [passageId])

  const source = citation?.source
  const shown = loaded?.id === passageId ? loaded : null
  const name = (source && names.get(source.documentId)) ?? 'Source document'
  const pages = source && pagesText(source.pageStart, source.pageEnd)

  return (
    <Modal visible={Boolean(citation)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {citation && (
        <SafeAreaView testID="citation-sheet" className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-2">
            <Text className="text-lg font-semibold">{`Citation ${citation.number}`}</Text>
            <Button variant="ghost" accessibilityLabel="Close" onPress={onClose}>
              <Text className="text-primary">Close</Text>
            </Button>
          </View>
          <ScrollView contentContainerClassName="gap-5 p-4">
            <View className="gap-1">
              <Text className="text-lg font-semibold">{name}</Text>
              {pages && <Text className="tabular-nums text-sm text-muted-foreground">{pages}</Text>}
            </View>

            {(source?.withdrawn || citation.state === 'unverified') && (
              <View className="gap-1 rounded-md bg-warning p-3">
                {source?.withdrawn && <Text className="text-warning-foreground">This edition has been withdrawn.</Text>}
                {citation.state === 'unverified' && (
                  <Text className="text-warning-foreground">
                    These words weren’t found in the passage. Check the source before relying on them.
                  </Text>
                )}
              </View>
            )}

            <View className="gap-2">
              <Eyebrow>Quoted</Eyebrow>
              <View className="border-l-2 border-primary pl-3">
                <Text className="text-base leading-6">{`“${citation.quote}”`}</Text>
              </View>
            </View>

            <View className="gap-2">
              <Eyebrow>Passage</Eyebrow>
              {!passageId ? (
                <Text className="text-muted-foreground">This passage isn’t in the knowledge base.</Text>
              ) : shown?.passage ? (
                <>
                  {shown.passage.headings.length > 0 && (
                    <Text className="text-sm text-muted-foreground">{shown.passage.headings.join(' › ')}</Text>
                  )}
                  <Text className="text-base leading-6">{shown.passage.text}</Text>
                </>
              ) : shown?.error ? (
                <Text className="text-destructive">{shown.error}</Text>
              ) : (
                // The web's wording (CitationPanel.tsx), not a spinner.
                <Text className="text-muted-foreground">Loading the passage…</Text>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      )}
    </Modal>
  )
}
