// The card that floats above the + in the chat box (MB-24), like ChatGPT's: Take photo, Choose photo and
// Choose PDF, each with a round icon. It is a transparent Modal, so a tap anywhere else closes it. `anchor`
// is where the + is in the window (measured when it was pressed, so it is right with the keyboard up);
// without one (tests) the card sits at the bottom left. Called by Composer, which runs the chosen action.
import { Camera, FileText, Image as ImageIcon } from 'lucide-react-native'
import { Modal, Pressable, useWindowDimensions, View } from 'react-native'
import { Text } from '@/components/ui/text'

export type Choice = 'camera' | 'library' | 'pdf'
export type Anchor = { x: number; y: number }

const ITEMS = [
  { kind: 'camera', label: 'Take photo', Icon: Camera },
  { kind: 'library', label: 'Choose photo', Icon: ImageIcon },
  { kind: 'pdf', label: 'Choose PDF', Icon: FileText },
] as const

type Props = { open: boolean; anchor: Anchor | null; onChoose(kind: Choice): void; onClose(): void }

export function AttachMenu({ open, anchor, onChoose, onClose }: Props) {
  const { height } = useWindowDimensions()
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {/* Anywhere outside the card closes it. */}
      <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} className="flex-1">
        {/* The card's bottom edge sits 8pt above the +. Stopping the touch here keeps a tap on the card from closing it. */}
        <View
          onStartShouldSetResponder={() => true}
          className="absolute w-64 gap-1 rounded-3xl border border-border bg-card p-2 shadow-lg shadow-black/20"
          style={anchor ? { left: Math.max(anchor.x, 8), bottom: height - anchor.y + 8 } : { left: 12, bottom: 96 }}
        >
          {ITEMS.map(({ kind, label, Icon }) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => onChoose(kind)}
              className="h-14 flex-row items-center gap-3 rounded-2xl px-2 active:bg-secondary"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <Icon color="#2c5488" size={22} />
              </View>
              <Text className="text-base font-medium">{label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  )
}
