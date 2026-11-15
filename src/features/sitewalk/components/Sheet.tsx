// A full-height page sheet with a title and Close, for the review's pickers and forms (MB-16 parts F-H).
// Used by PlaceSheet, LocationSheet, SamePlaceSheet, FilterBar and AddObservationSheet.
import { Modal, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

type Props = { title: string; testID: string; onClose(): void; children: React.ReactNode }

export function Sheet({ title, testID, onClose, children }: Props) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView testID={testID} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-2">
          <Text className="text-lg font-semibold">{title}</Text>
          <Button variant="ghost" accessibilityLabel="Close" onPress={onClose}>
            <Text className="text-primary">Close</Text>
          </Button>
        </View>
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}
