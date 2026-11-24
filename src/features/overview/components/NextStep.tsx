// The one next step (MB-20, web AS-06): a sentence and, when it points somewhere the phone
// has, a button with a verb. A step that points to a web-only tab says so instead of a button.
// Called by OverviewSheet.
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { View } from 'react-native'
import { targetOf, WEB_ONLY, type PhoneNext, type Target } from '../format'

type Props = { next: PhoneNext; onGo(target: Target): void }

export function NextStep({ next, onGo }: Props) {
  const target = targetOf(next.link, next.itemId)
  return (
    <View testID="next-step" className="gap-2 rounded-md bg-secondary p-3">
      <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next step</Text>
      <Text className="font-medium">{next.text}</Text>
      {next.link && target.kind !== 'web' && next.label ? (
        <Button accessibilityLabel={next.label} onPress={() => onGo(target)} className="self-start">
          <Text>{next.label}</Text>
        </Button>
      ) : next.link ? (
        <Text className="text-sm text-muted-foreground">{WEB_ONLY}</Text>
      ) : null}
    </View>
  )
}
