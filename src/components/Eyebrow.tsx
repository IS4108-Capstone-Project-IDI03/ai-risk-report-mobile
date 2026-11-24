// The design system's structural label: small, uppercase, letterspaced
// (docs/design-system.md, "the only uppercase is the 11px structural label").
// Used above sections in the workspace and the capture sheet.
import { Text } from '@/components/ui/text'

export function Eyebrow({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">{children}</Text>
  )
}
