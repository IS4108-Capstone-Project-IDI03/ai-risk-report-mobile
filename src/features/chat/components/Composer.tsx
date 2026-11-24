// The chat's question box (MB-06 AC2, AC9): a multi-line input and a 48px round
// Send button, which becomes Stop while an answer is being written.
import { ArrowUp, Square } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = { busy: boolean; onSend(text: string): void; onStop(): void }

export function Composer({ busy, onSend, onStop }: Props) {
  const [text, setText] = useState('')
  const canSend = !busy && text.trim().length > 0

  function send() {
    if (!canSend) return
    onSend(text)
    setText('')
  }

  return (
    <View className="flex-row items-end gap-2 border-t border-border bg-card px-3 py-2">
      <Input
        accessibilityLabel="Question"
        value={text}
        onChangeText={setText}
        placeholder="Ask about a standard or past report"
        multiline
        maxLength={2000}
        className="h-auto max-h-32 min-h-12 flex-1 py-3"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? 'Stop' : 'Send'}
        accessibilityState={{ disabled: !busy && !canSend }}
        disabled={!busy && !canSend}
        onPress={busy ? onStop : send}
        className={cn('h-12 w-12 items-center justify-center rounded-full', busy || canSend ? 'bg-primary' : 'bg-muted')}
      >
        {busy ? <Square color="#ffffff" fill="#ffffff" size={16} /> : <ArrowUp color={canSend ? '#ffffff' : '#545e6b'} size={22} />}
      </Pressable>
    </View>
  )
}
