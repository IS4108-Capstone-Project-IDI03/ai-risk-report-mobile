// The chat's question box (MB-06 AC2, AC9), drawn as one rounded pill like ChatGPT's: a round + at the left
// (MB-24: opens a card above it with Take photo / Choose photo / Choose PDF), the multi-line input, and at the
// right one round button that changes with the box: the Speak microphone while it is empty (MB-25), Send once
// there is text, Stop while an answer is being written. Attached files sit in a row above the pill, and Send
// waits for an upload to finish. Attaching and speaking need signal. Called by screens/Chat.
// The + and the microphone have no word drawn (Miya's choice, 22 Nov, as the Inbox icon): they are read out.
import { ArrowUp, Mic, Plus, Square } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, View, type ViewInstance } from 'react-native'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { duration } from '@/features/capture/draft'
import { useOffline } from '@/features/offline/provider'
import { cn } from '@/lib/utils'
import { useAttachments, type Taken } from '../useAttachments'
import { useVoiceQuestion } from '../useVoiceQuestion'
import { AttachMenu, type Anchor, type Choice } from './AttachMenu'
import { AttachmentRow } from './AttachmentRow'

type Props = { busy: boolean; pdfsHeld: number; onSend(text: string, taken: Taken): void; onStop(): void }

export function Composer({ busy, pdfsHeld, onSend, onStop }: Props) {
  const [text, setText] = useState('')
  // The pill carries the focus ring (the input inside has none of its own), so the whole box turns navy.
  const [focused, setFocused] = useState(false)
  const { offline } = useOffline()
  const attach = useAttachments(pdfsHeld)
  // A spoken question lands in the box as text, to check and edit before it is sent (MB-25).
  const voice = useVoiceQuestion(setText)
  // The card that floats above the +, and where the + is in the window (measured as it opens, so it
  // is right with the keyboard up).
  const plus = useRef<ViewInstance>(null)
  const [menu, setMenu] = useState<{ open: boolean; anchor: Anchor | null }>({ open: false, anchor: null })
  const openMenu = () => {
    setMenu({ open: true, anchor: null })
    plus.current?.measureInWindow((x, y) => setMenu({ open: true, anchor: { x, y } }))
  }
  // The card stays until the picker is done. Closing it first made iOS refuse to show Files (a Modal cannot
  // be dismissed and a picker presented at once), and the next try failed with "Different document picking in progress".
  const choose = (kind: Choice) => {
    void attach.choose(kind).finally(() => setMenu({ open: false, anchor: null }))
  }
  // Not while a file is still going up: the question would leave without it.
  const canSend = !busy && attach.uploading === 0 && text.trim().length > 0

  function send() {
    if (!canSend) return
    onSend(text, attach.take())
    setText('')
  }

  // The right-hand button: Stop a recording, Stop an answer, Speak while empty, else Send. A recording comes
  // first: a starter tapped mid-recording starts an answer, and the microphone must not be left on with no way to stop it.
  const right = voice.recording
    ? { label: 'Stop recording', onPress: () => void voice.stop(), filled: true, danger: true, disabled: false, icon: <Square color="#ffffff" fill="#ffffff" size={14} /> }
    : busy
      ? { label: 'Stop', onPress: onStop, filled: true, disabled: false, icon: <Square color="#ffffff" fill="#ffffff" size={14} /> }
      : text.length === 0
        ? { label: 'Speak', onPress: () => void voice.start(), filled: false, disabled: offline || voice.transcribing, icon: <Mic color="#2c5488" size={20} /> }
        : { label: 'Send', onPress: send, filled: canSend, disabled: !canSend, icon: <ArrowUp color={canSend ? '#ffffff' : '#545e6b'} size={20} /> }

  return (
    <View className="gap-2 border-t border-border bg-card px-3 pb-2 pt-2">
      {offline && <Text className="px-1 text-sm text-muted-foreground">Connect to attach or speak.</Text>}
      {attach.error && <Text className="px-1 text-sm text-destructive">{attach.error}</Text>}
      {voice.problem && (
        <View className="flex-row flex-wrap items-center gap-x-3 px-1">
          <Text className="flex-shrink text-sm text-destructive">{voice.problem.message}</Text>
          {voice.problem.settings && (
            <Pressable accessibilityRole="button" accessibilityLabel="Open Settings" onPress={() => void Linking.openSettings()} className="h-12 justify-center active:opacity-70">
              <Text className="font-semibold text-primary">Open Settings</Text>
            </Pressable>
          )}
        </View>
      )}
      <AttachmentRow photos={attach.photos} pdfs={attach.pdfs} onRemovePhoto={attach.dropPhoto} onRemovePdf={attach.dropPdf} onBlur={attach.setBlur} />
      <View className={cn('flex-row items-end rounded-[26px] border px-1', focused ? 'border-primary bg-card' : 'border-border bg-background')}>
        {/* 48pt target around a bare plus. */}
        <Pressable
          ref={plus}
          accessibilityRole="button"
          accessibilityLabel="Attach"
          accessibilityState={{ disabled: offline || voice.recording }}
          disabled={offline || voice.recording}
          onPress={openMenu}
          className={cn('h-12 w-12 items-center justify-center rounded-full active:opacity-60', (offline || voice.recording) && 'opacity-40')}
        >
          <Plus color="#2c5488" size={26} />
        </Pressable>
        {voice.recording ? (
          <View className="min-h-12 flex-1 flex-row items-center gap-2 px-1">
            <View className="h-2.5 w-2.5 rounded-full bg-destructive" />
            <Text className="font-medium">{duration(voice.durationMillis)}</Text>
            <Text className="text-muted-foreground">Listening</Text>
          </View>
        ) : voice.transcribing ? (
          <View className="min-h-12 flex-1 flex-row items-center gap-2 px-1">
            <ActivityIndicator />
            <Text className="text-muted-foreground">Turning your voice into text</Text>
          </View>
        ) : (
          <Input
            accessibilityLabel="Question"
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ask the knowledge base"
            multiline
            maxLength={2000}
            // The pill draws the border, the background and the focus ring.
            className="h-auto max-h-32 min-h-12 flex-1 border-0 bg-transparent px-1 py-3 shadow-none focus:border-0 focus:bg-transparent"
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={right.label}
          accessibilityState={{ disabled: right.disabled }}
          disabled={right.disabled}
          onPress={right.onPress}
          className={cn('h-12 w-12 items-center justify-center', right.disabled && 'opacity-60')}
        >
          <View className={cn('h-9 w-9 items-center justify-center rounded-full', right.danger ? 'bg-destructive' : right.filled ? 'bg-primary' : 'bg-secondary')}>{right.icon}</View>
        </Pressable>
      </View>
      <AttachMenu open={menu.open} anchor={menu.anchor} onChoose={choose} onClose={() => setMenu({ open: false, anchor: null })} />
    </View>
  )
}
