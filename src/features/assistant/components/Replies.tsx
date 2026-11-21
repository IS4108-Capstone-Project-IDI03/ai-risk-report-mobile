// MarshBot's reply buttons under the newest turn (MB-20), as the web's ReplyButton and Actions: pill buttons, the primary one
// solid navy and the rest outlined, each at least 48px tall. A reply has the gateway's icon at its left (an unknown name
// draws none), and one that only opens a tab (it has a link, nothing is sent) an arrow at its right. The first hint the
// gateway sends, which says what a stage move does ("will move the assessment's status forward to ..."), is one line under
// the buttons. Greyed while one is sending or with no signal. Called by screens/Assistant.
import { ChevronRight, CornerDownRight } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { GatewayIcon, hasIcon } from '@/features/overview/icons'
import type { Reply } from '../types'

type Props = { replies: Reply[]; disabled: boolean; onPick(reply: Reply): void }

export function Replies({ replies, disabled, onPick }: Props) {
  const hint = replies.find((r) => r.hint)?.hint
  return (
    <View className="flex-row flex-wrap gap-2">
      {replies.map((r) => {
        const ink = r.primary ? '#ffffff' : '#000f47'
        return (
          <Pressable
            key={r.id}
            testID={`reply-${r.id}`}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            disabled={disabled}
            onPress={() => onPick(r)}
            className={`min-h-12 flex-row items-center justify-center gap-2 rounded-full px-5 active:opacity-80 ${r.primary ? 'bg-primary' : 'border border-primary bg-background'} ${disabled ? 'opacity-50' : ''}`}
          >
            {r.icon && hasIcon(r.icon) && (
              <View testID={`reply-icon-${r.id}`}>
                <GatewayIcon name={r.icon} color={ink} size={18} />
              </View>
            )}
            <Text className={`font-semibold ${r.primary ? 'text-primary-foreground' : 'text-primary'}`}>{r.label}</Text>
            {r.link && (
              <View testID={`reply-arrow-${r.id}`}>
                <ChevronRight color={ink} size={18} />
              </View>
            )}
          </Pressable>
        )
      })}
      {hint && (
        <View testID="reply-hint" className="w-full flex-row items-start gap-1.5 pl-1.5">
          <View className="pt-1">
            <CornerDownRight color="#545e6b" size={14} />
          </View>
          <Text className="flex-1 text-sm text-muted-foreground">{hint}</Text>
        </View>
      )}
    </View>
  )
}
