// The design system's structural label: small, uppercase, letterspaced
// (docs/design-system.md, "the only uppercase is the 11px structural label").
// Used above sections in the workspace and the capture sheet. `required` adds the red star the
// other forms use (FieldLabel in new-assessment), read out as "required" rather than "star".
import { View } from 'react-native'
import { Text } from '@/components/ui/text'

export function Eyebrow({ children, required }: { children: string; required?: boolean }) {
  const label = <Text className="text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">{children}</Text>
  if (!required) return label
  return (
    <View accessible accessibilityLabel={`${children}, required`} className="flex-row items-center">
      {label}
      <Text accessibilityElementsHidden importantForAccessibility="no" className="ml-1 text-xs font-semibold text-destructive">*</Text>
    </View>
  )
}
